"""
Space monitor service: uses GPT-4V to detect products entering/leaving a storage space.
Receives two base64 frames (before/after movement) and returns what changed.
Fetches the real inventory from Supabase so GPT-4o can match exactly.
"""
import json
import os
from datetime import datetime, timedelta
from openai import AsyncOpenAI
from supabase import create_client

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY", os.environ.get("SUPABASE_SERVICE_ROLE_KEY", ""))
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")


def _get_supabase():
    return create_client(SUPABASE_URL, SUPABASE_KEY)


async def fetch_inventory_for_area(storage_area_id: str) -> list[dict]:
    """Returns the current inventory items for a storage area from Supabase."""
    try:
        supabase = _get_supabase()
        res = (
            supabase.table("inventory")
            .select("id, name, brand, quantity, emoji")
            .eq("storage_area_id", storage_area_id)
            .gt("quantity", 0)
            .execute()
        )
        return res.data or []
    except Exception:
        return []


async def analyze_space_change(
    frame_before_b64: str,
    frame_after_b64: str,
    storage_area_id: str,
) -> dict:
    """
    Fetches known products for the area, then sends both frames + product list
    to GPT-4o so it can match exactly what it sees to a real inventory item.

    Returns:
      {
        accion: 'entrada'|'salida'|'ninguno',
        producto_nombre: str,
        producto_emoji: str,
        inventory_item_id: str | None,   ← matched DB row id
        cantidad: int,
        confianza: float,
        descripcion: str,
        cantidad_restante: int | None,   ← remaining after this action
      }
    """
    client = AsyncOpenAI(api_key=OPENAI_API_KEY)

    # ── Fetch known products from DB ──
    known = await fetch_inventory_for_area(storage_area_id)

    if known:
        product_lines = "\n".join(
            f'  - id={p["id"]} | {p.get("emoji","📦")} {p["name"]}'
            f'{" — " + p["brand"] if p.get("brand") else ""}'
            f' (stock actual: {p.get("quantity", "?")} unidades)'
            for p in known
        )
        known_section = f"""
INVENTARIO ACTUAL DE ESTE ESPACIO (usá estos datos para identificar el producto):
{product_lines}

Si el producto que ves en las imágenes coincide con alguno de la lista, devolvé su id exacto en el campo "inventory_item_id".
Si no coincide con ninguno, devolvé null en ese campo.
"""
    else:
        known_section = "\n(No hay inventario registrado para este espacio todavía.)\n"

    prompt = f"""Sos un sistema de detección de inventario doméstico.
Compará estas dos imágenes de un espacio de almacenamiento (heladera, alacena, etc.).

Imagen 1: ANTES del movimiento
Imagen 2: DESPUÉS del movimiento
{known_section}
Detectá si algún producto:
- Fue RETIRADO (estaba en imagen 1, no está en imagen 2) → accion = "salida"
- Fue AGREGADO  (no estaba en imagen 1, está en imagen 2) → accion = "entrada"
- No cambió nada relevante → accion = "ninguno"

Respondé SOLO con JSON válido, sin markdown ni texto extra:
{{
  "accion": "salida" | "entrada" | "ninguno",
  "inventory_item_id": "<id del producto de la lista de arriba, o null>",
  "producto_nombre": "nombre exacto del producto (de la lista si matchea, sino tu descripción)",
  "producto_emoji": "emoji representativo",
  "cantidad": 1,
  "confianza": 0.0,
  "descripcion": "descripción breve de lo que cambió"
}}"""

    response = await client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": prompt},
                    {"type": "image_url", "image_url": {
                        "url": f"data:image/jpeg;base64,{frame_before_b64}", "detail": "low"}},
                    {"type": "image_url", "image_url": {
                        "url": f"data:image/jpeg;base64,{frame_after_b64}", "detail": "low"}},
                ],
            }
        ],
        max_tokens=350,
    )

    raw = response.choices[0].message.content.strip()
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    result = json.loads(raw)
    result["storage_area_id"] = storage_area_id
    result["timestamp"] = datetime.utcnow().isoformat()

    # ── Attach remaining quantity from known list ──
    item_id = result.get("inventory_item_id")
    if item_id:
        matched = next((p for p in known if str(p["id"]) == str(item_id)), None)
        if matched:
            current_qty = matched.get("quantity", 0)
            delta = result.get("cantidad", 1)
            if result["accion"] == "salida":
                result["cantidad_restante"] = max(0, current_qty - delta)
            elif result["accion"] == "entrada":
                result["cantidad_restante"] = current_qty + delta
            else:
                result["cantidad_restante"] = current_qty
        else:
            result["cantidad_restante"] = None
    else:
        result["cantidad_restante"] = None

    return result


async def decrement_inventory(inventory_item_id: str, cantidad: int = 1) -> int:
    """
    Decrements the quantity of an inventory item by `cantidad`.
    Returns the new quantity (floored at 0).
    """
    supabase = _get_supabase()
    # Fetch current quantity
    res = supabase.table("inventory").select("quantity").eq("id", inventory_item_id).single().execute()
    current = res.data.get("quantity", 0) if res.data else 0
    new_qty = max(0, current - cantidad)
    supabase.table("inventory").update({"quantity": new_qty}).eq("id", inventory_item_id).execute()
    return new_qty


async def increment_inventory(inventory_item_id: str, cantidad: int = 1) -> int:
    """Increments the quantity of an inventory item by `cantidad`."""
    supabase = _get_supabase()
    res = supabase.table("inventory").select("quantity").eq("id", inventory_item_id).single().execute()
    current = res.data.get("quantity", 0) if res.data else 0
    new_qty = current + cantidad
    supabase.table("inventory").update({"quantity": new_qty}).eq("id", inventory_item_id).execute()
    return new_qty


async def broadcast_monitor_event(
    user_id: str,
    storage_area_id: str,
    accion: str,
    producto_nombre: str,
    producto_emoji: str,
    cantidad: int,
    cantidad_restante: int | None,
    inventory_item_id: str | None,
    confianza: float,
    descripcion: str,
) -> None:
    """
    Inserts a row in monitor_events so any subscribed mobile client
    receives it instantly via Supabase Realtime.
    """
    try:
        supabase = _get_supabase()
        supabase.table("monitor_events").insert({
            "user_id":            user_id,
            "storage_area_id":    storage_area_id,
            "accion":             accion,
            "producto_nombre":    producto_nombre,
            "producto_emoji":     producto_emoji,
            "inventory_item_id":  inventory_item_id,
            "cantidad":           cantidad,
            "cantidad_restante":  cantidad_restante,
            "confianza":          confianza,
            "descripcion":        descripcion,
        }).execute()
    except Exception:
        pass  # Never block the main flow


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
