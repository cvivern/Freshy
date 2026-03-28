from fastapi import APIRouter, File, UploadFile, HTTPException
from services.product_scan import scan_product_image, scan_barcode_image

router = APIRouter(prefix="/detection", tags=["detection"])


@router.post("/scan/product")
async def scan_product(image: UploadFile = File(...)):
    """
    Receives a product photo and returns brand, name, barcode, expiry_date
    extracted via GPT-4o-mini vision.

    Response example:
    {
        "brand": "La Serenísima",
        "name": "Yogur frutilla",
        "barcode": "7790046020001",
        "expiry_date": "15/06/2026"
    }
    """
    if not image.content_type or not image.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")

    image_bytes = await image.read()
    try:
        result = await scan_product_image(image_bytes)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Vision API error: {e}")

    return result


@router.post("/scan/barcode")
async def scan_barcode(image: UploadFile = File(...)):
    """
    Receives a photo of a barcode / expiry date label and returns
    the barcode number and expiry date extracted via GPT-4o-mini vision.

    Response example:
    {
        "barcode": "7790046020001",
        "expiry_date": "15/06/2026"
    }
    """
    if not image.content_type or not image.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")

    image_bytes = await image.read()
    try:
        result = await scan_barcode_image(image_bytes)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Vision API error: {e}")

    return result
