FROM python:3.11-slim AS base

# System deps for numpy/scikit-learn
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install deps first (layer cache)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Non-root user
RUN addgroup --gid 1001 aiservice && \
    adduser --uid 1001 --gid 1001 --no-create-home aiservice
USER aiservice

EXPOSE 8000

# Train model on first start (cached to /tmp/price_model.joblib)
CMD ["python", "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]