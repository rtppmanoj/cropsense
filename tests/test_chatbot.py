"""CropSaathi API contract tests using a mocked OpenRouter response."""
from fastapi.testclient import TestClient

from backend import api, chatbot


class MockOpenRouterResponse:
    def raise_for_status(self):
        return None

    @staticmethod
    def json():
        return {"choices": [{"message": {"content": "Mocked CropSaathi response."}}]}


class MockOpenRouterClient:
    requests = []

    def __init__(self, *args, **kwargs):
        pass

    async def __aenter__(self):
        return self

    async def __aexit__(self, *args):
        return False

    async def post(self, url, *, headers, json):
        self.requests.append({"url": url, "headers": headers, "body": json})
        return MockOpenRouterResponse()


class MockRateLimitedOpenRouterResponse:
    def raise_for_status(self):
        import httpx
        raise httpx.HTTPStatusError(
            "rate limited",
            request=httpx.Request("POST", "https://openrouter.ai/api/v1/chat/completions"),
            response=httpx.Response(429, json={"error": {"code": 429, "message": "free-models-per-day"}}),
        )

    @staticmethod
    def json():
        return {"error": {"code": 429, "message": "free-models-per-day"}}


class MockRateLimitedOpenRouterClient(MockOpenRouterClient):
    async def post(self, url, *, headers, json):
        self.requests.append({"url": url, "headers": headers, "body": json})
        return MockRateLimitedOpenRouterResponse()


def test_chatbot_passes_conversation_page_and_language_context(monkeypatch):
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    monkeypatch.setenv("OPENROUTER_MODEL", "test/model")
    monkeypatch.setenv("OPENROUTER_FALLBACK_MODELS", "backup/fast,backup/free")
    monkeypatch.setattr(chatbot.httpx, "AsyncClient", MockOpenRouterClient)
    monkeypatch.setattr(chatbot, "_rate_limit", lambda *args: None)
    MockOpenRouterClient.requests.clear()

    payload = {
        "message": "What about fertilizer?",
        "history": [
            {"role": "user", "content": "Why was rice recommended?"},
            {"role": "assistant", "content": "Rice is ranked first in this result."},
        ],
        "page_path": "/farmer/result",
        "page_state": {
            "report_id": "00014",
            "form_values": {"nitrogen": "90", "farm_state": "Tamil Nadu"},
            "recommendations": [{
                "crop": "Rice", "score": 0.42, "explanation": "Matched the submitted field pattern.",
                "fertilizer": {
                    "fertilizers": "Source listed fertilizer", "nutrients": "N, P, K",
                    "timing": "See linked crop guide", "dosage": None,
                    "source": "Official guide", "url": "https://example.gov.in/guide", "checked_on": "2026-10-28",
                },
            }],
            "weather": {"location": "Test village", "forecast": [{"month": "November", "precipitation_mm": 12.0}]},
        },
        "language": "ta",
    }

    with TestClient(api.app) as client:
        response = client.post("/api/chatbot", json=payload)

    assert response.status_code == 200, response.text
    assert response.json() == {"reply": "Mocked CropSaathi response."}
    body = MockOpenRouterClient.requests[-1]["body"]
    assert body["model"] == "test/model"
    assert body["models"] == ["backup/fast", "backup/free"]
    assert body["max_tokens"] == 700
    system_messages = [message["content"] for message in body["messages"] if message["role"] == "system"]
    assert any("Tamil" in message for message in system_messages)
    assert any("Rice" in message and "00014" in message and "Test village" in message for message in system_messages)
    assert body["messages"][-3]["content"] == "Why was rice recommended?"
    assert body["messages"][-1]["content"] == "What about fertilizer?"


def test_scheme_follow_up_uses_recent_scheme_name_and_catalogue(monkeypatch):
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    monkeypatch.setenv("OPENROUTER_MODEL", "test/model")
    monkeypatch.setattr(chatbot.httpx, "AsyncClient", MockOpenRouterClient)
    monkeypatch.setattr(chatbot, "_rate_limit", lambda *args: None)
    MockOpenRouterClient.requests.clear()

    with TestClient(api.app) as client:
        response = client.post("/api/chatbot", json={
            "message": "Am I eligible for this scheme?",
            "history": [{"role": "user", "content": "Tell me about PM-KISAN."}],
            "page_path": "/farmer/schemes",
            "language": "en",
        })

    assert response.status_code == 200, response.text
    context = "\n".join(message["content"] for message in MockOpenRouterClient.requests[-1]["body"]["messages"] if message["role"] == "system")
    assert "PM-KISAN" in context
    assert "official_url" in context
    assert "not proof of farmer eligibility" in context


def test_chatbot_rejects_unauthorized_context_fields():
    with TestClient(api.app) as client:
        response = client.post("/api/chatbot", json={
            "message": "Hi", "page_state": {"email": "farmer@example.test"},
        })
    assert response.status_code == 422


def test_chatbot_friendly_configuration_error_does_not_expose_secrets(monkeypatch):
    monkeypatch.delenv("OPENROUTER_API_KEY", raising=False)
    monkeypatch.delenv("OPENROUTER_MODEL", raising=False)
    with TestClient(api.app) as client:
        response = client.post("/api/chatbot", json={"message": "Who are you?"})
    assert response.status_code == 503
    assert "CropSaathi AI is not configured" in response.json()["detail"]
    assert "test-key" not in response.text


def test_unrelated_question_is_redirected_without_calling_openrouter(monkeypatch):
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    monkeypatch.setenv("OPENROUTER_MODEL", "test/model")
    monkeypatch.setattr(chatbot, "_rate_limit", lambda *args: None)
    MockOpenRouterClient.requests.clear()
    with TestClient(api.app) as client:
        response = client.post("/api/chatbot", json={"message": "Who is the Prime Minister of India?", "language": "en"})
    assert response.status_code == 200
    assert "I'm CropSaathi AI" in response.json()["reply"]
    assert MockOpenRouterClient.requests == []


def test_dashboard_help_uses_concise_prompt_and_faq_facts(monkeypatch):
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    monkeypatch.setenv("OPENROUTER_MODEL", "test/model")
    monkeypatch.setattr(chatbot.httpx, "AsyncClient", MockOpenRouterClient)
    monkeypatch.setattr(chatbot, "_rate_limit", lambda *args: None)
    MockOpenRouterClient.requests.clear()
    with TestClient(api.app) as client:
        response = client.post("/api/chatbot", json={"message": "What should I do here?", "page_path": "/farmer/dashboard"})
    assert response.status_code == 200
    system = " ".join(message["content"] for message in MockOpenRouterClient.requests[-1]["body"]["messages"] if message["role"] == "system")
    assert "at most three bullets" in system
    assert "Getting started" in system


def test_about_page_supplies_smart_farm_labs_and_team_facts(monkeypatch):
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    monkeypatch.setenv("OPENROUTER_MODEL", "test/model")
    monkeypatch.setattr(chatbot.httpx, "AsyncClient", MockOpenRouterClient)
    monkeypatch.setattr(chatbot, "_rate_limit", lambda *args: None)
    MockOpenRouterClient.requests.clear()
    with TestClient(api.app) as client:
        response = client.post("/api/chatbot", json={
            "message": "Who is Manoj mentioned on this page?",
            "page_path": "/about",
            "language": "en",
        })
    assert response.status_code == 200, response.text
    system = "\n".join(message["content"] for message in MockOpenRouterClient.requests[-1]["body"]["messages"] if message["role"] == "system")
    assert "Manoj P" in system and "Founder & CTO" in system
    assert "Abdul Basheeruddin R" in system and "Hariharan B" in system
    assert "Smart Farm Labs" in system and "legal ownership title" in system


def test_home_page_supplies_current_plans_for_tamil_price_questions(monkeypatch):
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    monkeypatch.setenv("OPENROUTER_MODEL", "test/model")
    monkeypatch.setattr(chatbot.httpx, "AsyncClient", MockOpenRouterClient)
    monkeypatch.setattr(chatbot, "_rate_limit", lambda *args: None)
    MockOpenRouterClient.requests.clear()
    with TestClient(api.app) as client:
        response = client.post("/api/chatbot", json={
            "message": "இந்த வெப்சைட் ல நான் சப்ஸ்கிரைப் பண்ணணும்னா எவ்வளோ ஆகும்?",
            "page_path": "/",
            "language": "ta",
        })
    assert response.status_code == 200, response.text
    system = "\n".join(message["content"] for message in MockOpenRouterClient.requests[-1]["body"]["messages"] if message["role"] == "system")
    assert "Current plan catalogue" in system
    assert "price_inr_per_year" in system and "recommendations_per_year" in system
    assert "Never reveal or narrate internal analysis" in system


def test_openrouter_free_model_rate_limit_returns_retryable_service_error(monkeypatch):
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    monkeypatch.setenv("OPENROUTER_MODEL", "test/model")
    monkeypatch.setattr(chatbot.httpx, "AsyncClient", MockRateLimitedOpenRouterClient)
    monkeypatch.setattr(chatbot, "_rate_limit", lambda *args: None)
    with TestClient(api.app) as client:
        response = client.post("/api/chatbot", json={"message": "What is CropSense?", "language": "en"})
    assert response.status_code == 503
    assert response.json()["detail"] == "CropSaathi is temporarily at capacity. Please try again later."


def test_chatbot_asks_what_to_summarize_without_calling_provider(monkeypatch):
    monkeypatch.delenv("OPENROUTER_API_KEY", raising=False)
    monkeypatch.delenv("OPENROUTER_MODEL", raising=False)
    monkeypatch.setattr(chatbot, "_rate_limit", lambda *args: None)
    with TestClient(api.app) as client:
        response = client.post("/api/chatbot", json={"message": "Summarize this", "language": "en"})
    assert response.status_code == 200
    assert "send the farming details" in response.json()["reply"].lower()
