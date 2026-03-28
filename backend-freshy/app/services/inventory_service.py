from uuid import UUID

from fastapi import HTTPException, status

from app.models.inventory import InventoryItemResponse
from app.repositories.inventory_repository import InventoryRepository


class InventoryService:
    def __init__(self, repo: InventoryRepository) -> None:
        self._repo = repo

    def get_inventory(
        self,
        storage_area_id: UUID,
        user_id: str,
        *,
        categoria: str | None = None,
        nombre: str | None = None,
        marca: str | None = None,
        estado: str | None = None,
    ) -> list[InventoryItemResponse]:
        # Validate that the storage_area belongs to the given user
        owner = self._repo.get_storage_area_owner(storage_area_id)
        if owner is not None and owner != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="storage_area does not belong to this user.",
            )

        rows = self._repo.get_by_storage_area(storage_area_id)
        items = [self._map_row(row) for row in rows]

        # Apply optional filters in-memory (hackathon scale)
        if estado:
            items = [i for i in items if i.estado == estado]
        if categoria:
            items = [i for i in items if i.categoria and categoria.lower() in i.categoria.lower()]
        if nombre:
            items = [i for i in items if nombre.lower() in i.nombre.lower()]
        if marca:
            items = [i for i in items if i.marca and marca.lower() in i.marca.lower()]

        return items

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _map_row(row: dict) -> InventoryItemResponse:
        catalog = row.get("catalog_items") or {}

        return InventoryItemResponse(
            id=row["id"],
            nombre=catalog.get("name", ""),
            marca=catalog.get("marca"),
            emoji=catalog.get("emoji"),
            foto=None,  # foto_url not present in inventory table
            categoria=catalog.get("category"),
            # DB uses expiry_date / freshness_state; API surface keeps Spanish names.
            fecha_vencimiento=row.get("expiry_date"),
            estado=row.get("freshness_state", "fresco"),
            # history_logs has no FK to inventory in the current schema.
            last_used=None,
        )
