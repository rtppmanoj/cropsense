"""Authenticated report delivery through Brevo's HTTPS transactional email API."""
from __future__ import annotations

import base64
import binascii
from html import escape
import logging
import os
import re

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, ConfigDict, Field, field_validator

from backend.auth import FarmerUser, _check_origin, _rate_limit

router = APIRouter(prefix="/api")
logger = logging.getLogger(__name__)
MAX_PDF_BYTES = 8 * 1024 * 1024


class EmailReportRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    pdf_base64: str = Field(min_length=8, max_length=((MAX_PDF_BYTES + 2) // 3) * 4 + 4)
    filename: str = Field(default="cropsense-report.pdf", min_length=5, max_length=100)

    @field_validator("filename")
    @classmethod
    def safe_pdf_filename(cls, value: str) -> str:
        if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9._-]{0,95}\.pdf", value, re.IGNORECASE):
            raise ValueError("Filename must be a simple PDF filename.")
        return value


def decode_pdf(value: str) -> bytes:
    try:
        content = base64.b64decode(value, validate=True)
    except (binascii.Error, ValueError) as exc:
        raise HTTPException(status_code=422, detail="The report PDF is invalid. Generate it again and retry.") from exc
    if len(content) > MAX_PDF_BYTES:
        raise HTTPException(status_code=413, detail="The report PDF must be smaller than 8 MB.")
    if not content.startswith(b"%PDF-"):
        raise HTTPException(status_code=422, detail="The uploaded report is not a valid PDF.")
    return content


def send_brevo_email(*, recipient: str, subject: str, text_content: str,
                     sender_email: str, api_key: str, sender_name: str = "CropSense",
                     html_content: str | None = None,
                     attachment_name: str | None = None,
                     attachment_bytes: bytes | None = None) -> None:
    """Send transactional mail through Brevo's HTTPS API (works on Render Free)."""
    import json
    import urllib.error
    import urllib.request

    body: dict = {
        "sender": {"name": sender_name, "email": sender_email},
        "to": [{"email": recipient}],
        "subject": subject,
        "textContent": text_content,
    }
    if html_content:
        body["htmlContent"] = html_content
    if attachment_name and attachment_bytes is not None:
        body["attachment"] = [{"name": attachment_name,
                               "content": base64.b64encode(attachment_bytes).decode("ascii")}]
    request = urllib.request.Request(
        "https://api.brevo.com/v3/smtp/email",
        data=json.dumps(body).encode("utf-8"),
        headers={"api-key": api_key, "accept": "application/json",
                 "content-type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            if response.status not in {200, 201, 202}:
                raise RuntimeError(f"Brevo returned unexpected status {response.status}")
    except urllib.error.HTTPError as exc:
        # Do not log response bodies; provider responses can contain recipient data.
        raise BrevoDeliveryError(f"Brevo rejected the message (HTTP {exc.code}).", exc.code) from exc
    except (urllib.error.URLError, TimeoutError, OSError) as exc:
        raise BrevoDeliveryError("Could not reach Brevo over HTTPS.") from exc


class BrevoDeliveryError(Exception):
    def __init__(self, message: str, status_code: int | None = None):
        super().__init__(message)
        self.status_code = status_code


def send_password_reset_otp(*, recipient: str, otp: str, sender_email: str,
                            api_key: str, sender_name: str = "CropSense") -> None:
    send_brevo_email(
        recipient=recipient,
        subject="Your CropSense password reset code",
        text_content=(f"Your CropSense password reset code is {otp}.\n\n"
                      "It expires in 10 minutes and can be used once. "
                      "If you did not request this, ignore this email."),
        sender_email=sender_email, sender_name=sender_name, api_key=api_key,
    )


def send_pdf(*, recipient: str, recipient_name: str, filename: str, pdf_bytes: bytes,
             sender_email: str, api_key: str, sender_name: str = "CropSense") -> None:
    farmer_name = recipient_name.strip() or "Farmer"
    text_content = (
        f"Dear {farmer_name},\n\nGreetings from CropSense!\n\n"
        "Please find attached your personalized Crop Recommendation and Weather Report, "
        "prepared using the land and soil details you provided.\n\n"
        "Your report includes crop recommendations, weather outlook, and smart farming insights.\n\n"
        "CropSense ? A Smart Farm Labs Initiative"
    )
    safe_name = escape(farmer_name)
    html_content = f"""<!doctype html><html><body style="font-family:Arial,sans-serif;color:#203c2c;line-height:1.6">
    <p>Dear {safe_name},</p><p>Greetings from <strong>CropSense!</strong></p>
    <p>Please find attached your personalized <strong>Crop Recommendation and Weather Report</strong>.</p>
    <p>Your report includes suitable crop recommendations, weather outlook, and smart farming insights.</p>
    <p>Thank you for choosing CropSense ? Smarter Farming. Better Harvests.</p>
    <p>Best regards,<br><strong>Team CropSense</strong><br><em>CropSense ? A Smart Farm Labs Initiative</em></p>
    </body></html>"""
    send_brevo_email(
        recipient=recipient, subject="Your CropSense recommendation report",
        text_content=text_content, html_content=html_content, sender_email=sender_email,
        sender_name=sender_name, api_key=api_key, attachment_name=filename,
        attachment_bytes=pdf_bytes,
    )


@router.post("/email-report")
def email_report(payload: EmailReportRequest, request: Request, user: FarmerUser):
    _check_origin(request)
    _rate_limit(request, "email-report", 3, 600)
    # Always take the destination from the authenticated database user.
    recipient = str(user["email"])
    pdf_bytes = decode_pdf(payload.pdf_base64)
    api_key = os.getenv("BREVO_API_KEY", "").strip()
    sender_email = os.getenv("BREVO_SENDER_EMAIL", "").strip()
    sender_name = os.getenv("BREVO_SENDER_NAME", "CropSense").strip() or "CropSense"
    if not api_key or not sender_email:
        raise HTTPException(status_code=503, detail="Email delivery is not configured. Set BREVO_API_KEY and BREVO_SENDER_EMAIL on the API server.")

    try:
        send_pdf(recipient=recipient, recipient_name=str(user.get("display_name", "")),
                 filename=payload.filename, pdf_bytes=pdf_bytes, sender_email=sender_email,
                 sender_name=sender_name, api_key=api_key)
    except BrevoDeliveryError as exc:
        logger.error("Transactional report delivery failed user_id=%s error_type=%s provider_status=%s",
                     user["id"], type(exc).__name__, exc.status_code or "network")
        raise HTTPException(status_code=502, detail="The email provider could not send the report. Check the Brevo sender verification and API key, then try again.") from exc

    logger.info("Transactional report delivered user_id=%s", user["id"])
    return {"status": "sent"}
