from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from services.supabase_client import get_supabase

router = APIRouter(prefix="/inventory", tags=["inventory"])


class InventoryItemIn(BaseModel):
    nombre: str
    emoji: Optional[str] = "📦"
    marca: Optional[str] = None
    categoria: Optional[str] = None
    fecha_vencimiento: Optional[str] = None  # "DD/MM/AAAA"


def parse_date(date_str: str | None) -> str | None:
    """Converts DD/MM/AAAA → YYYY-MM-DD for Supabase date column."""
    if not date_str:
        return None
    for fmt in ("%d/%m/%Y", "%d/%m/%y"):
        try:
            return datetime.strptime(date_str.strip(), fmt).strftime("%Y-%m-%d")
        except ValueError:
            continue
    return None


@router.get("/products")
async def get_distinct_products():
    """Returns distinct (nombre, emoji) pairs ever inserted into inventory."""
    try:
        supabase = get_supabase()
        result = supabase.table("inventory").select("nombre, emoji").execute()
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Database error: {e}")

    seen: set[str] = set()
    products = []
    for row in result.data:
        if row["nombre"] not in seen:
            seen.add(row["nombre"])
            products.append({"nombre": row["nombre"], "emoji": row.get("emoji") or "📦"})
    return products


@router.post("/items/batch", status_code=201)
async def add_items_batch(items: list[InventoryItemIn]):
    """
    Inserts multiple inventory items at once (used by restock flow).

    Request body example:
    [
      { "nombre": "Pan", "emoji": "🍞", "fecha_vencimiento": "25/04/2026" },
      { "nombre": "Pan", "emoji": "🍞", "fecha_vencimiento": "30/04/2026" }
    ]
    """
    if not items:
        raise HTTPException(status_code=400, detail="items list cannot be empty")

    rows = [
        {
            "nombre": item.nombre,
            "emoji": item.emoji,
            "marca": item.marca,
            "categoria": item.categoria,
            "fecha_vencimiento": parse_date(item.fecha_vencimiento),
            "estado": "fresco",
        }
        for item in items
    ]

    try:
        supabase = get_supabase()
        result = supabase.table("inventory").insert(rows).execute()
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Database error: {e}")

    return {"inserted": len(result.data), "items": result.data}
