from fastapi import FastAPI
from routers.detection import router as detection_router
from routers.scan import router as scan_router
from routers.inventory import router as inventory_router

app = FastAPI(title="Freshy API", version="0.1.0")

app.include_router(detection_router)
app.include_router(scan_router)
app.include_router(inventory_router)


@app.get("/health")
def health():
    return {"status": "ok"}
