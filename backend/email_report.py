"""Authenticated delivery of recommendation PDFs through Gmail SMTP."""
from __future__ import annotations

import base64
import binascii
from html import escape
import logging
import os
import re
import smtplib
import socket
import ssl
from email.message import EmailMessage

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, ConfigDict, Field, field_validator

from backend.auth import FarmerUser, _check_origin, _rate_limit

router = APIRouter(prefix="/api")
logger = logging.getLogger(__name__)
MAX_PDF_BYTES = 8 * 1024 * 1024
SENDER_ADDRESS = "cropsensevit@gmail.com"


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


def send_password_reset_otp(*, recipient: str, otp: str, smtp_email: str, smtp_app_password: str) -> None:
    message = EmailMessage()
    message["Subject"] = "Your CropSense password reset code"
    message["From"] = smtp_email
    message["To"] = recipient
    message.set_content(
        f"Your CropSense password reset code is {otp}.\n\n"
        "It expires in 10 minutes and can be used once. If you did not request this, ignore this email.\n"
    )
    with smtplib.SMTP("smtp.gmail.com", 587, timeout=10) as smtp:
        smtp.ehlo()
        smtp.starttls(context=ssl.create_default_context())
        smtp.ehlo()
        smtp.login(smtp_email, smtp_app_password)
        smtp.send_message(message)


def send_pdf(*, recipient: str, recipient_name: str, filename: str, pdf_bytes: bytes,
             smtp_email: str, smtp_app_password: str) -> None:
    """Build and send one report. SMTP is only called by the API and mocked in tests."""
    message = EmailMessage()
    message["Subject"] = "Your CropSense recommendation report"
    message["From"] = smtp_email
    message["To"] = recipient
    farmer_name = recipient_name.strip() or "Farmer"
    message.set_content(
        f"Dear {farmer_name},\n\n"
        "Greetings from CropSense!\n\n"
        "Please find attached your personalized Crop Recommendation and Weather Report, prepared using the land and soil details you provided.\n\n"
        "Your report includes:\n\n"
        "- Crop Recommendations: Suitable crop options based on your soil and environmental parameters.\n"
        "- Weather Outlook: Weather insights for your selected location to support farm planning.\n"
        "- Smart Farming Insights: Data-driven information to help you make informed and sustainable farming decisions.\n\n"
        "We hope CropSense helps you plan your farming activities with greater confidence.\n\n"
        "Thank you for choosing CropSense — Smarter Farming. Better Harvests.\n\n"
        "Best regards,\nTeam CropSense\nCropSense — A Smart Farm Labs Initiative\n"
        "AI-powered insights for smarter, more sustainable agriculture.\n"
    )
    safe_name = escape(farmer_name)
    message.add_alternative(
        f"""<!doctype html><html><body style="font-family:Arial,sans-serif;color:#203c2c;line-height:1.6">
        <p>Dear {safe_name},</p>
        <p>Greetings from <strong>CropSense!</strong></p>
        <p>Please find attached your personalized <strong>Crop Recommendation and Weather Report</strong>, prepared using the land and soil details you provided.</p>
        <p>Your report includes:</p>
        <ul>
          <li><strong>Crop Recommendations:</strong> Suitable crop options based on your soil and environmental parameters.</li>
          <li><strong>Weather Outlook:</strong> Weather insights for your selected location to support farm planning.</li>
          <li><strong>Smart Farming Insights:</strong> Data-driven information to help you make informed and sustainable farming decisions.</li>
        </ul>
        <p>We hope CropSense helps you plan your farming activities with greater confidence.</p>
        <p>Thank you for choosing <strong>CropSense — Smarter Farming. Better Harvests.</strong></p>
        <p>Best regards,<br><strong>Team CropSense</strong><br>
        <em>CropSense — A Smart Farm Labs Initiative</em><br>
        <em>AI-powered insights for smarter, more sustainable agriculture.</em></p>
        </body></html>""",
        subtype="html",
    )
    message.add_attachment(pdf_bytes, maintype="application", subtype="pdf", filename=filename)

    with smtplib.SMTP("smtp.gmail.com", 587, timeout=10) as smtp:
        smtp.ehlo()
        smtp.starttls(context=ssl.create_default_context())
        smtp.ehlo()
        smtp.login(smtp_email, smtp_app_password)
        smtp.send_message(message)


@router.post("/email-report")
def email_report(payload: EmailReportRequest, request: Request, user: FarmerUser):
    _check_origin(request)
    _rate_limit(request, "email-report", 3, 600)
    # Always take the destination from the authenticated database user.
    recipient = str(user["email"])
    pdf_bytes = decode_pdf(payload.pdf_base64)
    smtp_email = os.getenv("SMTP_EMAIL", "").strip()
    # Google presents App Passwords in groups with spaces; normalize that copy format.
    smtp_app_password = "".join(os.getenv("SMTP_APP_PASSWORD", "").split())
    if not smtp_email or not smtp_app_password:
        raise HTTPException(status_code=503, detail="Email delivery is not configured. Set SMTP_EMAIL and SMTP_APP_PASSWORD on the API server.")
    if smtp_email.lower() != SENDER_ADDRESS:
        raise HTTPException(status_code=503, detail=f"SMTP_EMAIL must be set to {SENDER_ADDRESS}.")

    try:
        send_pdf(recipient=recipient, recipient_name=str(user.get("display_name", "")),
                 filename=payload.filename, pdf_bytes=pdf_bytes, smtp_email=smtp_email,
                 smtp_app_password=smtp_app_password)
    except (smtplib.SMTPException, socket.timeout, TimeoutError, OSError) as exc:
        # Avoid logging exception text, which may contain server-provided data.
        logger.error("SMTP report delivery failed user_id=%s error_type=%s", user["id"], type(exc).__name__)
        raise HTTPException(status_code=502, detail="Gmail could not send the report right now. Please try again shortly.") from exc

    logger.info("SMTP report delivered user_id=%s", user["id"])
    return {"status": "sent"}
