# ai-service/model.py
import numpy as np
import pandas as pd
import joblib
import logging
from pathlib import Path

from sklearn.pipeline import Pipeline
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_percentage_error

from training_data import generate_training_data

logger = logging.getLogger(__name__)

MODEL_PATH = Path("/tmp/price_model.joblib")
MODEL_VERSION = "1.0.0"

# ── Feature definitions ───────────────────────────────────────────────────────

CATEGORICAL_FEATURES = ["category", "brand", "condition"]
NUMERICAL_FEATURES = ["age_months", "ram_gb", "storage_gb"]
ALL_FEATURES = CATEGORICAL_FEATURES + NUMERICAL_FEATURES


def build_pipeline() -> Pipeline:
    """
    Scikit-learn pipeline:
    1. ColumnTransformer: OHE for categoricals, StandardScaler for numerics
    2. GradientBoostingRegressor: handles non-linear interactions well
       (better than LinearRegression for mixed feature types)
    """
    preprocessor = ColumnTransformer(
        transformers=[
            (
                "cat",
                OneHotEncoder(handle_unknown="ignore", sparse_output=False),
                CATEGORICAL_FEATURES,
            ),
            (
                "num",
                StandardScaler(),
                NUMERICAL_FEATURES,
            ),
        ],
        remainder="drop",
    )

    model = Pipeline(
        steps=[
            ("preprocessor", preprocessor),
            (
                "regressor",
                GradientBoostingRegressor(
                    n_estimators=200,
                    learning_rate=0.08,
                    max_depth=5,
                    min_samples_split=10,
                    subsample=0.85,
                    random_state=42,
                ),
            ),
        ]
    )

    return model


class PricePredictor:
    def __init__(self):
        self.pipeline: Pipeline | None = None
        self.training_samples: int = 0
        self.mape: float = 0.0  # mean absolute percentage error on test set
        self._load_or_train()

    def _load_or_train(self):
        """Load cached model from disk, or train fresh if not found."""
        if MODEL_PATH.exists():
            logger.info(f"Loading cached model from {MODEL_PATH}")
            self.pipeline, meta = joblib.load(MODEL_PATH)
            self.training_samples = meta["training_samples"]
            self.mape = meta["mape"]
            logger.info(
                f"Model loaded — {self.training_samples} samples, MAPE: {self.mape:.2%}"
            )
        else:
            self._train()

    def _train(self):
        """Train model on synthetic data and cache to disk."""
        logger.info("Training price prediction model...")

        df = generate_training_data(n_samples=5000)
        self.training_samples = len(df)

        X = df[ALL_FEATURES]
        y = df["fair_price"]

        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.2, random_state=42
        )

        pipeline = build_pipeline()
        pipeline.fit(X_train, y_train)

        # Evaluate on held-out test set
        y_pred = pipeline.predict(X_test)
        self.mape = mean_absolute_percentage_error(y_test, y_pred)

        logger.info(f"Training complete — MAPE: {self.mape:.2%} on {len(X_test)} test samples")

        # Cache trained model + metadata
        joblib.dump((pipeline, {"training_samples": self.training_samples, "mape": self.mape}), MODEL_PATH)
        self.pipeline = pipeline

    def predict(self, category: str, brand: str, condition: str,
                specs: dict, listed_price: float) -> dict:
        """
        Generate price prediction with confidence interval.

        Confidence is derived from how close listed_price is to predicted_price
        and the model's overall MAPE — honest uncertainty quantification.
        """
        if self.pipeline is None:
            raise RuntimeError("Model not initialized")

        # Extract known spec features, default unknown specs to median values
        ram_gb = self._extract_spec(specs, ["ram", "ram_gb"], default=8)
        storage_gb = self._extract_spec(specs, ["storage", "storage_gb", "ssd", "hdd"], default=128)
        age_months = self._extract_spec(specs, ["age_months", "age"], default=12)

        features = pd.DataFrame([{
            "category": category,
            "brand": brand.lower().strip(),
            "condition": condition,
            "age_months": age_months,
            "ram_gb": ram_gb,
            "storage_gb": storage_gb,
        }])

        predicted_price = float(self.pipeline.predict(features)[0])
        predicted_price = max(100, round(predicted_price, 2))  # floor at ₹100

        # Confidence interval: ±MAPE * predicted_price
        margin = predicted_price * self.mape
        price_range = {
            "min": round(max(100, predicted_price - margin), 2),
            "max": round(predicted_price + margin, 2),
        }

        # Confidence score: 1.0 = prediction interval is tight (low MAPE)
        # Degrades as MAPE increases — honest about model uncertainty
        confidence = round(max(0.0, min(1.0, 1.0 - self.mape)), 4)

        # Deal score: 0-100
        # 100 = listed price is far below AI prediction (great deal)
        # 50  = listed price matches AI prediction (fair price)
        # 0   = listed price is far above AI prediction (overpriced)
        if predicted_price > 0:
            ratio = listed_price / predicted_price
            # ratio < 1: listed < predicted → good deal
            # ratio > 1: listed > predicted → overpriced
            deal_score = round(max(0, min(100, (2 - ratio) * 50)), 1)
        else:
            deal_score = 50.0

        return {
            "predicted_price": predicted_price,
            "confidence": confidence,
            "price_range": price_range,
            "deal_score": deal_score,
        }

    def _extract_spec(self, specs: dict, keys: list, default: float) -> float:
        """Extract a numeric spec value from flexible key names."""
        for key in keys:
            val = specs.get(key)
            if val is not None:
                try:
                    # Handle "8GB" → 8, "256 GB" → 256
                    return float(str(val).lower().replace("gb", "").replace(" ", "").strip())
                except (ValueError, AttributeError):
                    continue
        return float(default)


# Singleton — loaded once at startup, reused for all requests
predictor = PricePredictor()