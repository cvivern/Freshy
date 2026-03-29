from uuid import UUID

from fastapi import APIRouter, Form, HTTPException, UploadFile, File, status

from app.core.supabase import get_supabase_client
from app.repositories.catalog_item_repository import CatalogItemRepository
from app.repositories.inventory_repository import InventoryRepository
from app.services.inventory_service import InventoryService
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
            detail="La imagen supera el límite de 10 MB.",
        )

    service = OpenAIDetectionService()
    try:
        result = service.analyze(image_bytes)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"OpenAI analysis failed: {exc}",
        )

    # Map to {detections: [{label, confidence, freshness, shelf_life_days, emoji}]} format expected by the mobile app
    if result.get("type") in ("fruit", "vegetable"):
        _FRESHNESS_DAYS = {"fresco": 5, "medio": 3, "malo": 1}
        freshness = result.get("freshness", "fresco")
        shelf_life_days = _FRESHNESS_DAYS.get(freshness, 3)
        return {"detections": [{"label": result.get("name", "desconocido"), "confidence": 1.0, "freshness": freshness, "shelf_life_days": shelf_life_days, "emoji": result.get("emoji")}]}

    return {"detections": []}


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

    # TODO: replace mock with real Roboflow call when integrating
    return {
        "detections": [
            {"label": "strawberry", "confidence": 0.968}
        ]
    }


@router.post(
    "/scan",
    summary="Scan a packaged product label for name, brand and expiry date",
    status_code=status.HTTP_200_OK,
)
async def scan_packaged_product(file: UploadFile = File(...)):
    """
    Upload an image of a packaged product and get back name, brand and expiry date.
    Fields that could not be read are returned as null.
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

    service = OpenAIDetectionService()
    try:
        return service.analyze(image_bytes)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"OpenAI analysis failed: {exc}",
        )


@router.post(
    "/quick-update",
    summary="Detect a product and update its inventory quantity (+1 or -1)",
    status_code=status.HTTP_200_OK,
)
async def quick_update(
    file: UploadFile = File(...),
    storage_area_id: str = Form(...),
    action: str = Form(...),  # 'in' | 'out'
):
    """
    Upload a photo of a product already in inventory.
    The AI identifies it and automatically increments (action='in')
    or decrements (action='out') the matching inventory row's quantity.

    Returns:
    - matched=True  → {matched, item_id, name, emoji, quantity_before, quantity_after, action}
    - matched=False → {matched, detected_name}  (no item found in inventory)
    - matched=False → {matched, detected_name='unknown'}  (AI couldn't identify product)
    """
    if action not in ("in", "out"):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="action must be 'in' or 'out'",
        )

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

    # 1. Detect product name via OpenAI
    detection_service = OpenAIDetectionService()
    try:
        result = detection_service.analyze(image_bytes)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"OpenAI analysis failed: {exc}",
        )

    detected_name = result.get("name") or result.get("brand")
    if not detected_name or result.get("type") == "unknown":
        return {"matched": False, "detected_name": "unknown"}

    # 2. Find match in inventory and update quantity
    client = get_supabase_client()
    inv_service = InventoryService(
        repo=InventoryRepository(client),
        catalog_repo=CatalogItemRepository(client),
    )
    try:
        area_uuid = UUID(storage_area_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Invalid storage_area_id UUID",
        )

    return inv_service.quick_update_from_scan(area_uuid, detected_name, action)
