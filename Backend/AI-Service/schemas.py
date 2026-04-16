# schemas.py
from pydantic import BaseModel, Field, validator  # validator not field_validator
from typing import Optional
from enum import Enum


class CategoryEnum(str, Enum):
    smartphones = "smartphones"
    laptops = "laptops"
    tablets = "tablets"
    smartwatches = "smartwatches"
    headphones = "headphones"
    cameras = "cameras"
    gaming = "gaming"
    accessories = "accessories"
    networking = "networking"
    other = "other"


class ConditionEnum(str, Enum):
    new = "new"
    like_new = "like-new"
    good = "good"
    fair = "fair"
    poor = "poor"


class PredictRequest(BaseModel):
    product_id: str
    title: str
    category: CategoryEnum
    brand: str
    condition: ConditionEnum
    listed_price: float
    specs: dict = {}

    # pydantic v1 uses @validator not @field_validator
    @validator("brand")
    def normalize_brand(cls, v):
        return v.strip().lower()

    class Config:
        use_enum_values = True


class PredictionResult(BaseModel):
    product_id: str
    predicted_price: float
    confidence: float
    price_range: dict
    deal_score: float
    model_version: str


class HealthResponse(BaseModel):
    status: str
    model_loaded: bool
    model_version: str
    training_samples: int