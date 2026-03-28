from fastapi import APIRouter, File, UploadFile, HTTPException
from services.fruit_detection import detect_fruits, parse_predictions

router = APIRouter(prefix="/detection", tags=["detection"])


@router.post("/fruits")
async def detect_fruits_endpoint(image: UploadFile = File(...)):
    """
    Receives an image file and returns fruit detections.

    Response example:
    {
        "detections": [
            {"label": "apple_fresh", "confidence": 0.91, "x": 120, "y": 80, "width": 60, "height": 55}
        ]
    }
    """
    if not image.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")

    image_bytes = await image.read()
    raw = await detect_fruits(image_bytes)
    detections = parse_predictions(raw)
    return {"detections": detections}
