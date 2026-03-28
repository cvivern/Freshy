from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel


class DetectedItemInput(BaseModel):
    name: str
    quantity: int = 1
    unit: str = "unidad"


class AddDetectedItemsRequest(BaseModel):
    storage_area_id: UUID
    items: list[DetectedItemInput]


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

    model_config = {"from_attributes": True}
