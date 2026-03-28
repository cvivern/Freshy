from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.services.space_monitor_service import (
    analyze_space_change,
    broadcast_monitor_event,
    decrement_inventory,
    increment_inventory,
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
    auto_register: bool = True   # if True, auto-updates inventory and registers removals


class ReturnRequest(BaseModel):
    removal_id: str


@router.post("/analyze")
async def analyze_frames(req: AnalyzeFramesRequest):
    """
    1. Fetches known products for the area from Supabase.
    2. Sends both frames + product list to GPT-4o for precise identification.
    3. If product matched + salida → decrements inventory, registers removal event.
    4. If product matched + entrada → increments inventory.
    Returns the result including inventory_item_id and cantidad_restante.
    """
    try:
        result = await analyze_space_change(
            req.frame_before_b64,
            req.frame_after_b64,
            req.storage_area_id,
        )

        accion     = result.get("accion")
        confianza  = result.get("confianza", 0)
        item_id    = result.get("inventory_item_id")
        cantidad   = result.get("cantidad", 1)

        if req.auto_register and confianza > 0.55:
            if accion == "salida":
                if item_id:
                    new_qty = await decrement_inventory(item_id, cantidad)
                    result["cantidad_restante"] = new_qty

                removal = await register_removal(
                    storage_area_id=req.storage_area_id,
                    product_name=result.get("producto_nombre", "producto"),
                    product_emoji=result.get("producto_emoji", "📦"),
                    cantidad=cantidad,
                    user_id=req.user_id,
                )
                result["removal_id"] = removal.get("id")

            elif accion == "entrada" and item_id:
                new_qty = await increment_inventory(item_id, cantidad)
                result["cantidad_restante"] = new_qty

            # ── Broadcast via Supabase Realtime → celular recibe el toast ──
            if accion in ("salida", "entrada"):
                await broadcast_monitor_event(
                    user_id=req.user_id,
                    storage_area_id=req.storage_area_id,
                    accion=accion,
                    producto_nombre=result.get("producto_nombre", "producto"),
                    producto_emoji=result.get("producto_emoji", "📦"),
                    cantidad=cantidad,
                    cantidad_restante=result.get("cantidad_restante"),
                    inventory_item_id=item_id,
                    confianza=confianza,
                    descripcion=result.get("descripcion", ""),
                )

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
