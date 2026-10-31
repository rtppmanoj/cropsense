import re
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
from typing import Literal


class CropInput(BaseModel):
    nitrogen: float = Field(allow_inf_nan=False, ge=0, le=500)
    phosphorus: float = Field(allow_inf_nan=False, ge=0, le=500)
    potassium: float = Field(allow_inf_nan=False, ge=0, le=500)
    temperature: float = Field(allow_inf_nan=False, ge=-10, le=70)
    humidity: float = Field(allow_inf_nan=False, ge=0, le=100)
    ph: float = Field(allow_inf_nan=False, ge=0, le=14)
    soil_moisture: float = Field(allow_inf_nan=False, ge=0, le=100)

    @field_validator("nitrogen", "phosphorus", "potassium", "temperature", "humidity", "ph", "soil_moisture", mode="before")
    @classmethod
    def reject_boolean_measurements(cls, value):
        if isinstance(value, bool):
            raise ValueError("Boolean values are not valid measurements.")
        return value


class CropMatch(BaseModel):
    crop: str
    score: float = Field(allow_inf_nan=False, ge=0, le=1)
    explanation: str
    expected_yield_quintals_per_acre: float | None = Field(default=None, allow_inf_nan=False, ge=0)
    expected_harvest_quintals: float | None = Field(default=None, allow_inf_nan=False, ge=0)
    yield_benchmark_source: str | None = None


class RecommendationResponse(BaseModel):
    report_id: str | None = None
    recommendations: list[CropMatch]
    within_observed_feature_ranges: bool
    warnings: list[str]
    score_interpretation: str
    model_name: str
    model_version: str
    evaluated_accuracy: float
    evaluated_macro_f1: float


class Credentials(BaseModel):
    model_config = ConfigDict(extra="forbid")
    email: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=8, max_length=128)

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        normalized = value.strip().lower()
        if not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", normalized):
            raise ValueError("Enter a valid email address.")
        return normalized


class FarmerRegistration(Credentials):
    model_config = ConfigDict(extra="forbid")
    display_name: str = Field(min_length=1, max_length=100)
    mobile_number: str = Field(min_length=10, max_length=16)

    @field_validator("display_name")
    @classmethod
    def normalize_display_name(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Enter your name.")
        return value

    @field_validator("mobile_number")
    @classmethod
    def normalize_mobile_number(cls, value: str) -> str:
        value = re.sub(r"[\s()-]", "", value)
        if not re.fullmatch(r"\+?[0-9]{10,15}", value):
            raise ValueError("Enter a valid mobile number including country code if needed.")
        return value


class ProfileUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    display_name: str = Field(max_length=100)
    mobile_number: str = Field(min_length=10, max_length=16)

    @field_validator("display_name")
    @classmethod
    def normalize_display_name(cls, value: str) -> str:
        return value.strip()

    @field_validator("mobile_number")
    @classmethod
    def normalize_mobile_number(cls, value: str) -> str:
        value = re.sub(r"[\s()-]", "", value)
        if not re.fullmatch(r"\+?[0-9]{10,15}", value):
            raise ValueError("Enter a valid mobile number including country code if needed.")
        return value


class FarmerRecommendationRequest(CropInput):
    model_config = ConfigDict(extra="forbid")
    location_name: str = Field(min_length=2, max_length=200)
    village_town: str = Field(min_length=2, max_length=100)
    farm_district: str = Field(min_length=2, max_length=100)
    farm_state: str = Field(min_length=2, max_length=100)
    latitude: float | None = Field(default=None, allow_inf_nan=False, ge=-90, le=90)
    longitude: float | None = Field(default=None, allow_inf_nan=False, ge=-180, le=180)
    location_source: str = Field(default="manual", pattern="^(manual|map|gps|google)$")
    land_area_acres: float = Field(gt=0, le=100000, allow_inf_nan=False)

    @field_validator("location_name")
    @classmethod
    def normalize_location(cls, value: str) -> str:
        return value.strip()

    @model_validator(mode="after")
    def require_coordinate_pair(self):
        if (self.latitude is None) != (self.longitude is None):
            raise ValueError("Latitude and longitude must be supplied together.")
        if self.location_source in {"map", "gps", "google"} and self.latitude is None:
            raise ValueError("Choose a map point or enter a manual location.")
        return self


class PasswordChange(BaseModel):
    model_config = ConfigDict(extra="forbid")
    current_password: str = Field(min_length=1, max_length=128)
    new_password: str = Field(min_length=8, max_length=128)


class FarmerStatusUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    active: bool


class SchemeStatusUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    application_status: Literal["not_started", "preparing", "applied", "follow_up", "completed"]

