from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel


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
