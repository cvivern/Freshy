from fastapi import APIRouter, HTTPException, UploadFile, File, status

from app.services.detection_service import DetectionService

router = APIRouter(prefix="/detection", tags=["Detection"])

ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp", "image/jpg"}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB


async def _run_detection(image_file: UploadFile) -> dict:
    if image_file.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"Unsupported file type '{image_file.content_type}'. Use JPEG, PNG or WEBP.",
        )
    image_bytes = await image_file.read()
    if len(image_bytes) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Image exceeds 10 MB limit.",
        )
    service = DetectionService()
    try:
        return service.detect(image_bytes)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Roboflow inference failed: {exc}",
        )


@router.post(
    "/fruits",
    summary="Detect fruits and vegetables (mobile app endpoint)",
    status_code=status.HTTP_200_OK,
)
async def detect_fruits(image: UploadFile = File(...)):
    """
    Used by the mobile app. Accepts field name 'image'.
    Returns: { detections: [{label, confidence}] }
    """
    result = await _run_detection(image)
    detections = [
        {"label": p["class"], "confidence": p["confidence"]}
        for p in result["predictions"]
    ]
    return {"detections": detections}


@router.post(
    "/identify",
    summary="Detect fruits and vegetables (raw endpoint)",
    status_code=status.HTTP_200_OK,
)
async def identify_image(file: UploadFile = File(...)):
    """
    Returns full Roboflow response: { predictions: [...], detected_items: [...] }
    """
    return await _run_detection(file)
