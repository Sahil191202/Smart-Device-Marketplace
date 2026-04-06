# ai-service/schemas.py
from pydantic import BaseModel, Field, field_validator
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
    title: str = Field(..., min_length=3, max_length=200)
    category: CategoryEnum
    brand: str = Field(..., min_length=1, max_length=50)
    condition: ConditionEnum
    listed_price: float = Field(..., gt=0, le=10_000_000)
    specs: dict = Field(default_factory=dict)

    @field_validator("brand")
    @classmethod
    def normalize_brand(cls, v):
        return v.strip().lower()


class PredictionResult(BaseModel):
    product_id: str
    predicted_price: float
    confidence: float = Field(..., ge=0.0, le=1.0)
    price_range: dict  # {"min": float, "max": float}
    deal_score: float  # 0-100: how good a deal vs AI prediction
    model_version: str


class HealthResponse(BaseModel):
    status: str
    model_loaded: bool
    model_version: str
    training_samples: int