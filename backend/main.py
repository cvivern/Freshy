from fastapi import FastAPI
from routers.detection import router as detection_router

app = FastAPI(title="Freshy API", version="0.1.0")

app.include_router(detection_router)


@app.get("/health")
def health():
    return {"status": "ok"}
