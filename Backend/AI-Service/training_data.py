# ai-service/training_data.py
"""
Synthetic training data for the price prediction model.
In production, this is replaced by real historical transaction data
from your MongoDB orders collection (exported + cleaned).

Feature engineering rationale:
- Base price by category reflects real Indian market ranges
- Condition multipliers reflect actual depreciation curves
- Brand premium reflects market positioning
- Age_months simulates listing age (newer = higher price)
"""
import numpy as np
import pandas as pd

np.random.seed(42)

# ── Market parameters (Indian market, INR) ────────────────────────────────────

CATEGORY_BASE_PRICES = {
    "smartphones": 25000,
    "laptops": 55000,
    "tablets": 30000,
    "smartwatches": 15000,
    "headphones": 8000,
    "cameras": 40000,
    "gaming": 35000,
    "accessories": 3000,
    "networking": 5000,
    "other": 10000,
}

CONDITION_MULTIPLIERS = {
    "new": 1.0,
    "like-new": 0.82,
    "good": 0.65,
    "fair": 0.48,
    "poor": 0.30,
}

BRAND_PREMIUMS = {
    # Premium brands
    "apple": 1.35, "sony": 1.15, "samsung": 1.10, "dell": 1.08,
    "lg": 1.05, "bose": 1.20, "canon": 1.12, "nikon": 1.10,
    # Mid-range
    "oneplus": 0.95, "xiaomi": 0.85, "realme": 0.80, "oppo": 0.82,
    "lenovo": 0.90, "hp": 0.92, "asus": 0.95, "acer": 0.88,
    # Budget
    "jbl": 0.88, "boat": 0.70, "ptron": 0.65, "noise": 0.72,
}

CATEGORIES = list(CATEGORY_BASE_PRICES.keys())
CONDITIONS = list(CONDITION_MULTIPLIERS.keys())
BRANDS = list(BRAND_PREMIUMS.keys())


def generate_training_data(n_samples: int = 5000) -> pd.DataFrame:
    """
    Generate realistic synthetic training samples.
    Each sample represents a device listing with its fair market price.
    """
    records = []

    for _ in range(n_samples):
        category = np.random.choice(CATEGORIES)
        condition = np.random.choice(CONDITIONS, p=[0.15, 0.25, 0.30, 0.20, 0.10])
        brand = np.random.choice(BRANDS)
        age_months = np.random.randint(0, 48)

        base = CATEGORY_BASE_PRICES[category]
        cond_mult = CONDITION_MULTIPLIERS[condition]
        brand_mult = BRAND_PREMIUMS.get(brand, 0.90)

        # Age depreciation: ~1.5% per month, floored at 40% of base
        age_depreciation = max(0.40, 1.0 - (age_months * 0.015))

        # Market noise: ±12% to simulate real price variation
        noise = np.random.uniform(0.88, 1.12)

        fair_price = base * cond_mult * brand_mult * age_depreciation * noise

        # Specs features (extracted from common spec keys)
        ram_gb = np.random.choice([2, 4, 6, 8, 12, 16, 32], p=[0.05, 0.15, 0.20, 0.25, 0.15, 0.12, 0.08])
        storage_gb = np.random.choice([32, 64, 128, 256, 512, 1024], p=[0.05, 0.15, 0.30, 0.25, 0.15, 0.10])

        records.append({
            "category": category,
            "brand": brand,
            "condition": condition,
            "age_months": age_months,
            "ram_gb": ram_gb,
            "storage_gb": storage_gb,
            "fair_price": round(fair_price, 2),
        })

    return pd.DataFrame(records)