import base64
from fastapi.testclient import TestClient

import pytest
from backend import api, auth
from backend.auth_store import AuthStore
from backend import email_report


PDF = b"%PDF-1.4\nmock report\n%%EOF"


@pytest.fixture
def farmer_client(tmp_path, monkeypatch):
    store = AuthStore(tmp_path / "test-email-auth.sqlite3")
    monkeypatch.setattr(auth, "store", store)
    monkeypatch.setattr(api, "auth_store", store)
    with auth._rate_lock:
        auth._requests.clear()
    with TestClient(api.app) as client:
        response = client.post("/api/auth/farmer/register", json={
            "email": "farmer@example.test", "password": "Farmersafe-pass-123",
            "display_name": "Test Farmer", "mobile_number": "9876543210",
        })
        assert response.status_code == 201, response.text
        yield client


class FakeSMTP:
    instances = []
    fail_on_starttls = False

    def __init__(self, host, port, timeout):
        self.host, self.port, self.timeout = host, port, timeout
        self.calls = []
        type(self).instances.append(self)

    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return False

    def ehlo(self):
        self.calls.append(("ehlo",))

    def starttls(self, context):
        self.calls.append(("starttls", context))
        if type(self).fail_on_starttls:
            raise TimeoutError("mock timeout")

    def login(self, username, password):
        self.calls.append(("login", username, password))

    def send_message(self, message):
        self.calls.append(("send_message", message))


def setup_smtp(monkeypatch):
    FakeSMTP.instances.clear()
    FakeSMTP.fail_on_starttls = False
    monkeypatch.setattr(email_report.smtplib, "SMTP", FakeSMTP)
    monkeypatch.setenv("SMTP_EMAIL", "cropsensevit@gmail.com")
    monkeypatch.setenv("SMTP_APP_PASSWORD", "test-only-secret")


def test_email_report_sends_pdf_to_authenticated_farmer(farmer_client, monkeypatch):
    setup_smtp(monkeypatch)
    response = farmer_client.post("/api/email-report", json={
        "pdf_base64": base64.b64encode(PDF).decode(), "filename": "cropsense-report.pdf",
    })
    assert response.status_code == 200
    assert response.json() == {"status": "sent"}
    smtp = FakeSMTP.instances[0]
    assert (smtp.host, smtp.port, smtp.timeout) == ("smtp.gmail.com", 587, 10)
    assert [call[0] for call in smtp.calls] == ["ehlo", "starttls", "ehlo", "login", "send_message"]
    assert smtp.calls[3] == ("login", "cropsensevit@gmail.com", "test-only-secret")
    message = smtp.calls[-1][1]
    assert message["From"] == "cropsensevit@gmail.com"
    assert message["To"] == "farmer@example.test"
    assert "Dear Test Farmer," in message.get_body(preferencelist=("plain",)).get_content()
    html_body = message.get_body(preferencelist=("html",)).get_content()
    assert "Dear Test Farmer," in html_body
    assert "Smart Farming Insights" in html_body
    assert "A Smart Farm Labs Initiative" in html_body
    attachment = list(message.iter_attachments())[0]
    assert attachment.get_filename() == "cropsense-report.pdf"
    assert attachment.get_content_type() == "application/pdf"
    assert attachment.get_payload(decode=True) == PDF


def test_email_report_normalizes_google_app_password_spacing(farmer_client, monkeypatch):
    setup_smtp(monkeypatch)
    monkeypatch.setenv("SMTP_APP_PASSWORD", "abcd efgh ijkl mnop")
    response = farmer_client.post("/api/email-report", json={"pdf_base64": base64.b64encode(PDF).decode()})
    assert response.status_code == 200
    assert FakeSMTP.instances[0].calls[3] == ("login", "cropsensevit@gmail.com", "abcdefghijklmnop")


def test_email_report_requires_farmer_authentication(monkeypatch):
    setup_smtp(monkeypatch)
    with TestClient(api.app) as client:
        response = client.post("/api/email-report", json={"pdf_base64": base64.b64encode(PDF).decode()})
    assert response.status_code == 401
    assert not FakeSMTP.instances


def test_email_report_rejects_recipient_from_frontend(farmer_client, monkeypatch):
    setup_smtp(monkeypatch)
    response = farmer_client.post("/api/email-report", json={
        "pdf_base64": base64.b64encode(PDF).decode(), "email": "attacker@example.test",
    })
    assert response.status_code == 422
    assert not FakeSMTP.instances


def test_email_report_rejects_invalid_pdf_and_filename(farmer_client, monkeypatch):
    setup_smtp(monkeypatch)
    bad_pdf = farmer_client.post("/api/email-report", json={"pdf_base64": base64.b64encode(b"not a pdf").decode()})
    bad_name = farmer_client.post("/api/email-report", json={
        "pdf_base64": base64.b64encode(PDF).decode(), "filename": "../report.pdf",
    })
    assert bad_pdf.status_code == 422
    assert bad_name.status_code == 422
    assert not FakeSMTP.instances


def test_email_report_returns_safe_error_for_smtp_timeout(farmer_client, monkeypatch, caplog):
    setup_smtp(monkeypatch)
    FakeSMTP.fail_on_starttls = True
    response = farmer_client.post("/api/email-report", json={"pdf_base64": base64.b64encode(PDF).decode()})
    assert response.status_code == 502
    assert "Gmail could not send" in response.json()["detail"]
    assert "test-only-secret" not in caplog.text


def test_email_report_is_unavailable_without_smtp_configuration(farmer_client, monkeypatch):
    FakeSMTP.instances.clear()
    monkeypatch.delenv("SMTP_EMAIL", raising=False)
    monkeypatch.delenv("SMTP_APP_PASSWORD", raising=False)
    response = farmer_client.post("/api/email-report", json={"pdf_base64": base64.b64encode(PDF).decode()})
    assert response.status_code == 503
    assert not FakeSMTP.instances
