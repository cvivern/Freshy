from fastapi import FastAPI
from routers.detection import router as detection_router
from routers.scan import router as scan_router
from routers.inventory import router as inventory_router
from routers.profiles import router as profiles_router
from routers.auth import router as auth_router

app = FastAPI(title="Freshy API", version="0.1.0")

app.include_router(detection_router)
app.include_router(scan_router)
app.include_router(inventory_router)
app.include_router(profiles_router)
app.include_router(auth_router)


@app.get("/health")
def health():
    return {"status": "ok"}
