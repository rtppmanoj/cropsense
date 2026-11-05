"""Send generated report PDFs with an approved WhatsApp Cloud API template."""
from __future__ import annotations

import base64
import binascii
import json
import logging
import os
import re
import urllib.error
import urllib.request
import uuid

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, ConfigDict, Field, field_validator

from backend.auth import FarmerUser, _check_origin, _rate_limit

router = APIRouter(prefix="/api")
logger = logging.getLogger(__name__)
MAX_PDF_BYTES = 8 * 1024 * 1024
DEFAULT_GRAPH_VERSION = "v26.0"


class WhatsAppReportRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    pdf_base64: str = Field(min_length=8, max_length=((MAX_PDF_BYTES + 2) // 3) * 4 + 4)
    filename: str = Field(default="cropsense-report.pdf", min_length=5, max_length=100)
    report_id: str | None = Field(default=None, max_length=20)

    @field_validator("filename")
    @classmethod
    def safe_pdf_filename(cls, value: str) -> str:
        if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9._-]{0,95}\.pdf", value, re.IGNORECASE):
            raise ValueError("Filename must be a simple PDF filename.")
        return value

    @field_validator("report_id")
    @classmethod
    def valid_report_id(cls, value: str | None) -> str | None:
        if value is not None and not re.fullmatch(r"[A-Za-z0-9-]{1,20}", value):
            raise ValueError("Report ID is invalid.")
        return value


class WhatsAppDeliveryError(Exception):
    def __init__(self, message: str, *, status: int | None = None,
                 code: int | str | None = None, subcode: int | str | None = None,
                 operation: str = "request", provider_message: str = ""):
        super().__init__(message)
        self.status = status
        self.code = code
        self.subcode = subcode
        self.operation = operation
        self.provider_message = provider_message


def _config() -> tuple[str, str, str, str, str, list[str]]:
    token = os.getenv("WHATSAPP_ACCESS_TOKEN", "").strip()
    phone_number_id = os.getenv("WHATSAPP_PHONE_NUMBER_ID", "").strip()
    template_name = os.getenv("WHATSAPP_TEMPLATE_NAME", "").strip()
    language = os.getenv("WHATSAPP_TEMPLATE_LANGUAGE", "").strip()
    version = os.getenv("WHATSAPP_GRAPH_API_VERSION", DEFAULT_GRAPH_VERSION).strip()
    body_fields = [part.strip() for part in os.getenv("WHATSAPP_TEMPLATE_BODY_FIELDS", "").split(",") if part.strip()]
    missing = [
        name for name, value in (
            ("WHATSAPP_ACCESS_TOKEN", token),
            ("WHATSAPP_PHONE_NUMBER_ID", phone_number_id),
            ("WHATSAPP_TEMPLATE_NAME", template_name),
            ("WHATSAPP_TEMPLATE_LANGUAGE", language),
        )
        if not value
    ]
    if missing:
        raise HTTPException(status_code=503, detail=(
            "WhatsApp report delivery is not configured. Missing or empty API environment variable(s): "
            + ", ".join(missing)
            + ". Add them to the Render backend service environment and redeploy."
        ))
    if not re.fullmatch(r"v[0-9]+\.[0-9]+", version):
        raise HTTPException(status_code=503, detail="WHATSAPP_GRAPH_API_VERSION must look like v26.0.")
    if any(field not in {"farmer_name", "report_id"} for field in body_fields):
        raise HTTPException(status_code=503, detail="WHATSAPP_TEMPLATE_BODY_FIELDS accepts farmer_name and report_id.")
    if len(set(body_fields)) != len(body_fields):
        raise HTTPException(status_code=503, detail="WHATSAPP_TEMPLATE_BODY_FIELDS cannot repeat a field.")
    return token, phone_number_id, template_name, language, version, body_fields


def _recipient_number(value: str | None) -> str:
    digits = re.sub(r"\D", "", value or "")
    # CropSense serves Indian farmers; existing ten-digit profiles are treated as Indian mobile numbers.
    if len(digits) == 10:
        digits = "91" + digits
    elif len(digits) == 11 and digits.startswith("0"):
        digits = "91" + digits[1:]
    if not 11 <= len(digits) <= 15:
        raise HTTPException(status_code=422, detail="Add a valid WhatsApp mobile number, including its country code, to your profile.")
    return digits


def _api_call(url: str, token: str, data: bytes, content_type: str) -> dict:
    operation = "media upload" if url.endswith("/media") else "template send"
    request = urllib.request.Request(
        url, data=data,
        headers={"Authorization": f"Bearer {token}", "Content-Type": content_type, "Accept": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=35) as response:
            raw = response.read()
            result = json.loads(raw.decode("utf-8")) if raw else {}
            if not isinstance(result, dict):
                raise WhatsAppDeliveryError("Meta returned an unexpected response.")
            return result
    except urllib.error.HTTPError as exc:
        try:
            error_payload = json.loads(exc.read().decode("utf-8")).get("error", {})
        except (ValueError, AttributeError):
            error_payload = {}
        provider_message = str(error_payload.get("message") or "")[:300]
        error_data = error_payload.get("error_data")
        if isinstance(error_data, dict) and error_data.get("details"):
            provider_message = f"{provider_message} — {str(error_data['details'])[:300]}".strip(" —")
        raise WhatsAppDeliveryError(
            "Meta rejected the WhatsApp report request.", status=exc.code,
            code=error_payload.get("code"), subcode=error_payload.get("error_subcode"),
            operation=operation, provider_message=provider_message,
        ) from exc
    except (urllib.error.URLError, TimeoutError, OSError) as exc:
        raise WhatsAppDeliveryError("Could not connect to the WhatsApp Cloud API.", operation=operation) from exc


def _upload_pdf(token: str, phone_number_id: str, version: str, filename: str, pdf_bytes: bytes) -> str:
    boundary = "----CropSense" + uuid.uuid4().hex
    chunks = [
        f"--{boundary}\r\nContent-Disposition: form-data; name=\"messaging_product\"\r\n\r\nwhatsapp\r\n".encode(),
        f"--{boundary}\r\nContent-Disposition: form-data; name=\"type\"\r\n\r\napplication/pdf\r\n".encode(),
        (f"--{boundary}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"{filename}\"\r\n"
         "Content-Type: application/pdf\r\n\r\n").encode(),
        pdf_bytes,
        f"\r\n--{boundary}--\r\n".encode(),
    ]
    response = _api_call(
        f"https://graph.facebook.com/{version}/{phone_number_id}/media",
        token, b"".join(chunks), f"multipart/form-data; boundary={boundary}",
    )
    media_id = response.get("id")
    if not isinstance(media_id, str) or not media_id:
        raise WhatsAppDeliveryError("Meta did not return an uploaded media ID.")
    return media_id


def _send_template(token: str, phone_number_id: str, version: str, recipient: str,
                   template_name: str, language: str, media_id: str, filename: str,
                   body_fields: list[str], farmer_name: str, report_id: str | None) -> dict:
    components: list[dict] = [{
        "type": "header",
        "parameters": [{"type": "document", "document": {"id": media_id, "filename": filename}}],
    }]
    values = {"farmer_name": farmer_name or "Farmer", "report_id": report_id or ""}
    if body_fields:
        if "report_id" in body_fields and not report_id:
            raise HTTPException(status_code=422, detail="The WhatsApp template expects a report ID, but this report has none.")
        components.append({"type": "body", "parameters": [
            {"type": "text", "parameter_name": field, "text": values[field]}
            for field in body_fields
        ]})
    payload = {
        "messaging_product": "whatsapp",
        "recipient_type": "individual",
        "to": recipient,
        "type": "template",
        "template": {"name": template_name, "language": {"code": language}, "components": components},
    }
    response = _api_call(
        f"https://graph.facebook.com/{version}/{phone_number_id}/messages",
        token, json.dumps(payload, ensure_ascii=False).encode("utf-8"), "application/json",
    )
    if not response.get("messages"):
        raise WhatsAppDeliveryError("Meta did not confirm message acceptance.")
    return response


@router.post("/whatsapp-report")
def whatsapp_report(payload: WhatsAppReportRequest, request: Request, user: FarmerUser):
    _check_origin(request)
    _rate_limit(request, "whatsapp-report", 3, 600)
    try:
        pdf_bytes = base64.b64decode(payload.pdf_base64, validate=True)
    except (binascii.Error, ValueError) as exc:
        raise HTTPException(status_code=422, detail="The report PDF is invalid. Generate it again and retry.") from exc
    if len(pdf_bytes) > MAX_PDF_BYTES:
        raise HTTPException(status_code=413, detail="The report PDF must be smaller than 8 MB.")
    if not pdf_bytes.startswith(b"%PDF-"):
        raise HTTPException(status_code=422, detail="The uploaded report is not a valid PDF.")

    token, phone_id, template, language, version, body_fields = _config()
    recipient = _recipient_number(user.get("mobile_number"))
    try:
        media_id = _upload_pdf(token, phone_id, version, payload.filename, pdf_bytes)
        result = _send_template(token, phone_id, version, recipient, template, language,
                                media_id, payload.filename, body_fields,
                                str(user.get("display_name", "")), payload.report_id)
    except WhatsAppDeliveryError as exc:
        logger.error("WhatsApp report delivery rejected user_id=%s step=%s status=%s code=%s subcode=%s detail=%s",
                     user["id"], exc.operation, exc.status or "network", exc.code or "unknown",
                     exc.subcode or "unknown", exc.provider_message or "unavailable")
        code = f" (Meta code {exc.code})" if exc.code else ""
        provider_detail = f" Meta says: {exc.provider_message}" if exc.provider_message else ""
        raise HTTPException(status_code=502, detail=(
            f"WhatsApp could not send the report during {exc.operation}{code}.{provider_detail}"
        )) from exc

    message_ids = [item.get("id") for item in result.get("messages", []) if item.get("id")]
    logger.info("WhatsApp report accepted user_id=%s message_id_count=%s", user["id"], len(message_ids))
    return {"status": "accepted", "message_ids": message_ids}
