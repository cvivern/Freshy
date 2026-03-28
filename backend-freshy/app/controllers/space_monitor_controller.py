from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.services.space_monitor_service import (
    analyze_space_change,
    register_removal,
    mark_as_returned,
    get_pending_removals,
)

router = APIRouter(prefix="/api/v1/monitor", tags=["Space Monitor"])


class AnalyzeFramesRequest(BaseModel):
    frame_before_b64: str   # base64 JPEG, no data: prefix
    frame_after_b64: str    # base64 JPEG, no data: prefix
    storage_area_id: str
    user_id: str
    auto_register: bool = True   # if True, auto-registers removals/entries


class ReturnRequest(BaseModel):
    removal_id: str


@router.post("/analyze")
async def analyze_frames(req: AnalyzeFramesRequest):
    """
    Sends two frames to GPT-4V to detect product changes.
    If auto_register=True and action='salida', registers the removal automatically.
    """
    try:
        result = await analyze_space_change(
            req.frame_before_b64,
            req.frame_after_b64,
            req.storage_area_id,
        )

        # Auto-register removal if action is 'salida' and confidence > 0.6
        if req.auto_register and result.get("accion") == "salida" and result.get("confianza", 0) > 0.6:
            removal = await register_removal(
                storage_area_id=req.storage_area_id,
                product_name=result["producto_nombre"],
                product_emoji=result.get("producto_emoji", "📦"),
                cantidad=result.get("cantidad", 1),
                user_id=req.user_id,
            )
            result["removal_id"] = removal.get("id")

        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/returned")
async def product_returned(req: ReturnRequest):
    """Marks a removed product as returned (put back)."""
    try:
        return await mark_as_returned(req.removal_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/pending/{user_id}")
async def pending_removals(user_id: str):
    """
    Returns products that were removed and NOT returned after the timeout.
    Frontend polls this to show 'ya no tenés X' notifications.
    """
    try:
        return await get_pending_removals(user_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
