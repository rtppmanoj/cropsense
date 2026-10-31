import json

import pytest

from backend.train import MODEL_DIR, train


@pytest.fixture(scope="session", autouse=True)
def trained_model():
    metadata_path = MODEL_DIR / "metadata.json"
    metadata = json.loads(metadata_path.read_text(encoding="utf-8")) if metadata_path.exists() else {}
    if not (MODEL_DIR / "crop_model.joblib").exists() or not metadata.get("artifact_sha256"):
        train()
    yield
