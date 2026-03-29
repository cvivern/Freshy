from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel


class InventoryPatch(BaseModel):
    product_name: str | None = None
    expiry_date: date | None = None


class DetectedItemInput(BaseModel):
    name: str
    quantity: int = 1
    unit: str = "unidad"


class AddDetectedItemsRequest(BaseModel):
    storage_area_id: UUID
    items: list[DetectedItemInput]
class InventoryCreate(BaseModel):
    storage_area_id: UUID
    product_name: str
    product_brand: str | None = None
    product_category: str | None = None
    barcode: str | None = None
    emoji: str | None = None
    quantity: int = 1
    unit: str = "unit"
    expiry_date: date | None = None


class InventoryCreateResponse(BaseModel):
    id: UUID
    catalog_item_id: UUID
    storage_area_id: UUID
    quantity: int
    expiry_date: date | None


class InventoryItemResponse(BaseModel):
    id: UUID
    nombre: str
    marca: str | None
    emoji: str | None
    foto: str | None           # inventory.foto_url
    categoria: str | None
    fecha_vencimiento: date | None
    estado: str                # fresco | por_vencer | vencido
    last_used: datetime | None  # max(history_logs.created_at) para este item
    entry_date: date | None    # cuando fue agregado al inventario

    model_config = {"from_attributes": True}
