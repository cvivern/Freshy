from fastapi import APIRouter, HTTPException, UploadFile, File, status

router = APIRouter(prefix="/detection", tags=["Detection"])

ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp", "image/jpg"}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB


@router.post(
    "/identify",
    summary="Detect fruits and vegetables in an image",
    status_code=status.HTTP_200_OK,
)
async def identify_image(file: UploadFile = File(...)):
    """
    Upload an image and get back the detected fruits/vegetables.

    Returns a list of predictions with class names and confidence scores,
    plus a deduplicated `detected_items` list ready to add to the inventory.
    """
    if file.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"Unsupported file type '{file.content_type}'. Use JPEG, PNG or WEBP.",
        )

    image_bytes = await file.read()

    if len(image_bytes) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Image exceeds 10 MB limit.",
        )

    # TODO: replace mock with real Roboflow call when integrating
    return {
        "detections": [
            {"label": "strawberry", "confidence": 0.968}
        ]
    }
