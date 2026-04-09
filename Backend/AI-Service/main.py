# ai-service/main.py
import logging
import os
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from schemas import PredictRequest, PredictionResult, HealthResponse
from model import predictor, MODEL_VERSION

# ── Logging ───────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


# ── App lifecycle ─────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: model is already loaded in model.py module-level code
    logger.info(f"AI Service ready — model v{MODEL_VERSION}, "
                f"{predictor.training_samples} training samples, "
                f"MAPE: {predictor.mape:.2%}")
    yield
    # Shutdown: nothing to clean up for this service
    logger.info("AI Service shutting down")


app = FastAPI(
    title="SmartMarketplace AI Price Predictor",
    version=MODEL_VERSION,
    lifespan=lifespan,
    docs_url="/docs",   # Swagger UI (disable in production if needed)
    redoc_url=None,
)

# ── CORS: only allow internal Node.js service ─────────────────────────────────
# In Docker, Node.js calls FastAPI via internal network — no public access needed
allowed_origins = os.getenv("ALLOWED_ORIGINS", "http://api:5000").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type", "X-Internal-Key"],
)


# ── Request timing middleware ─────────────────────────────────────────────────
@app.middleware("http")
async def add_process_time(request: Request, call_next):
    start = time.perf_counter()
    response = await call_next(request)
    elapsed = round((time.perf_counter() - start) * 1000, 2)
    response.headers["X-Process-Time-Ms"] = str(elapsed)
    return response


# ── Internal API key guard ────────────────────────────────────────────────────
INTERNAL_API_KEY = os.getenv("AI_INTERNAL_KEY", "")

def verify_internal_key(request: Request):
    """
    Simple shared-secret auth between Node.js and FastAPI.
    Both services share AI_INTERNAL_KEY via Docker environment.
    Not exposed publicly — internal Docker network only.
    """
    if not INTERNAL_API_KEY:
        return  # key not configured → skip auth (dev mode)
    key = request.headers.get("X-Internal-Key", "")
    if key != INTERNAL_API_KEY:
        raise HTTPException(status_code=401, detail="Unauthorized")


# ── Routes ────────────────────────────────────────────────────────────────────

@app.get("/health", response_model=HealthResponse)
async def health():
    return HealthResponse(
        status="healthy" if predictor.pipeline is not None else "degraded",
        model_loaded=predictor.pipeline is not None,
        model_version=MODEL_VERSION,
        training_samples=predictor.training_samples,
    )


@app.post("/predict", response_model=PredictionResult)
async def predict(request: Request, body: PredictRequest):
    verify_internal_key(request)

    try:
        result = predictor.predict(
            category=body.category.value,
            brand=body.brand,
            condition=body.condition.value,
            specs=body.specs,
            listed_price=body.listed_price,
        )

        logger.info(
            f"Prediction: product={body.product_id} "
            f"listed=₹{body.listed_price:,.0f} "
            f"predicted=₹{result['predicted_price']:,.0f} "
            f"deal={result['deal_score']}"
        )

        return PredictionResult(
            product_id=body.product_id,
            predicted_price=result["predicted_price"],
            confidence=result["confidence"],
            price_range=result["price_range"],
            deal_score=result["deal_score"],
            model_version=MODEL_VERSION,
        )

    except Exception as e:
        logger.error(f"Prediction failed for product {body.product_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Prediction failed: {str(e)}")


# ── Global error handler ──────────────────────────────────────────────────────
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled error: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"},
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        workers=2,          # 2 workers for CPU-bound prediction
        log_level="info",
    )