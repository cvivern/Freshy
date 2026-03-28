"""
Space monitor service: uses GPT-4V to detect products entering/leaving a storage space.
Receives two base64 frames (before/after movement) and returns what changed.
"""
import base64
import json
import os
from datetime import datetime, timedelta
from openai import AsyncOpenAI
from supabase import create_client

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "")
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")

async def analyze_space_change(
    frame_before_b64: str,
    frame_after_b64: str,
    storage_area_id: str,
) -> dict:
    """
    Sends two frames to GPT-4V and asks what product entered or left.
    Returns: { product_name, action: 'entrada'|'salida'|'ninguno', confidence, emoji }
    """
    client = AsyncOpenAI(api_key=OPENAI_API_KEY)

    prompt = """Sos un sistema de detección de inventario. Compará estas dos imágenes de un espacio de almacenamiento (heladera, alacena, etc.).

Imagen 1: ANTES del movimiento
Imagen 2: DESPUÉS del movimiento

Detectá si algún producto:
- Fue RETIRADO (estaba en imagen 1, no está en imagen 2) → accion = "salida"
- Fue AGREGADO (no estaba en imagen 1, está en imagen 2) → accion = "entrada"
- No cambió nada → accion = "ninguno"

Respondé SOLO con JSON válido, sin markdown:
{
  "accion": "salida" | "entrada" | "ninguno",
  "producto_nombre": "nombre del producto en español",
  "producto_emoji": "emoji representativo",
  "cantidad": 1,
  "confianza": 0.0 a 1.0,
  "descripcion": "descripción breve de lo que cambió"
}"""

    response = await client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": prompt},
                    {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{frame_before_b64}", "detail": "low"}},
                    {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{frame_after_b64}", "detail": "low"}},
                ],
            }
        ],
        max_tokens=300,
    )

    raw = response.choices[0].message.content.strip()
    # Strip markdown if present
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    result = json.loads(raw)
    result["storage_area_id"] = storage_area_id
    result["timestamp"] = datetime.utcnow().isoformat()
    return result


async def register_removal(
    storage_area_id: str,
    product_name: str,
    product_emoji: str,
    cantidad: int,
    user_id: str,
    return_timeout_minutes: int = 10,
) -> dict:
    """
    Registers a product removal event in Supabase.
    After return_timeout_minutes, if not returned, a notification should fire.
    """
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    expires_at = (datetime.utcnow() + timedelta(minutes=return_timeout_minutes)).isoformat()

    data = {
        "storage_area_id": storage_area_id,
        "product_name": product_name,
        "product_emoji": product_emoji,
        "cantidad": cantidad,
        "user_id": user_id,
        "removed_at": datetime.utcnow().isoformat(),
        "returned": False,
        "expires_at": expires_at,
    }

    res = supabase.table("product_removals").insert(data).execute()
    return res.data[0] if res.data else data


async def mark_as_returned(removal_id: str) -> dict:
    """Marks a removal as returned (product put back)."""
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    res = (
        supabase.table("product_removals")
        .update({"returned": True, "returned_at": datetime.utcnow().isoformat()})
        .eq("id", removal_id)
        .execute()
    )
    return res.data[0] if res.data else {}


async def get_pending_removals(user_id: str) -> list:
    """Returns removals that have NOT been returned and have expired (timeout passed)."""
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    now = datetime.utcnow().isoformat()
    res = (
        supabase.table("product_removals")
        .select("*")
        .eq("user_id", user_id)
        .eq("returned", False)
        .lt("expires_at", now)
        .execute()
    )
    return res.data or []
