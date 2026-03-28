from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.controllers.fruit_controller import router as fruit_router
from app.controllers.inventory_controller import router as inventory_router
from app.controllers.product_controller import router as product_router
from app.core.config import settings

app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description="Backend API for the Freshy smart-pantry application.",
    docs_url="/docs",
    redoc_url="/redoc",
)

# ---------------------------------------------------------------------------
# CORS — allow the React Native app (and dev tools) to reach the API
# ---------------------------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Tighten this in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Routers
# ---------------------------------------------------------------------------
API_PREFIX = "/api/v1"

app.include_router(product_router, prefix=API_PREFIX)
app.include_router(fruit_router, prefix=API_PREFIX)
app.include_router(inventory_router, prefix=API_PREFIX)


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------
@app.get("/health", tags=["Health"])
def health_check():
    return {"status": "ok", "version": settings.app_version}
