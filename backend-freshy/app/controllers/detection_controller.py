from fastapi import APIRouter, HTTPException, UploadFile, File, status

from app.services.openai_detection_service import OpenAIDetectionService

router = APIRouter(prefix="/detection", tags=["Detection"])

ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp", "image/jpg"}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB


async def _get_image_bytes(image_file: UploadFile) -> bytes:
    if image_file.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"Tipo de archivo no soportado: '{image_file.content_type}'. Usá JPEG, PNG o WEBP.",
        )
    image_bytes = await image_file.read()
    if len(image_bytes) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="La imagen supera el límite de 10 MB.",
        )
    return image_bytes


@router.post(
    "/analyze",
    summary="Analyze an image with Gemini — detects fruits, vegetables or packaged products",
    status_code=status.HTTP_200_OK,
)
async def analyze_image(image: UploadFile = File(...)):
    """
    Upload an image and get back what Gemini identifies:

    - **Fruit/Vegetable**: name in Spanish + freshness state (fresco / medio / malo)
    - **Packaged product**: name, brand, expiry date, scan timestamp
    - **Unknown**: when nothing food-related is detected
    """
    image_bytes = await _get_image_bytes(image)
    service = OpenAIDetectionService()
    try:
        return service.analyze(image_bytes)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"OpenAI analysis failed: {exc}",
        )


# Keep /fruits alias so existing mobile code keeps working during transition
@router.post(
    "/fruits",
    summary="[Legacy] Fruit detection — now powered by OpenAI",
    status_code=status.HTTP_200_OK,
)
async def detect_fruits(image: UploadFile = File(...)):
    image_bytes = await _get_image_bytes(image)
    service = OpenAIDetectionService()
    try:
        result = service.analyze(image_bytes)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"OpenAI analysis failed: {exc}",
        )

    # Map to old {detections: [{label, confidence}]} format for frontend compatibility
    if result.get("type") in ("fruit", "vegetable"):
        label = result.get("name", "desconocido")
        freshness = result.get("freshness", "fresco")
        if freshness != "fresco":
            label = f"{label} ({freshness})"
        return {"detections": [{"label": label, "confidence": 1.0}]}

    return {"detections": []}
