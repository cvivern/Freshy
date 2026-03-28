from datetime import date, datetime, timedelta
from uuid import UUID

from fastapi import HTTPException, status

from app.models.inventory import AddDetectedItemsRequest, InventoryItemResponse
from app.models.inventory import InventoryCreate, InventoryCreateResponse, InventoryItemResponse, AddDetectedItemsRequest
from app.repositories.catalog_item_repository import CatalogItemRepository
from app.repositories.inventory_repository import InventoryRepository


class InventoryService:
    def __init__(self, repo: InventoryRepository, catalog_repo: CatalogItemRepository | None = None) -> None:
        self._repo = repo
        self._catalog_repo = catalog_repo

    def add_item(self, data: InventoryCreate) -> InventoryCreateResponse:
        if self._catalog_repo is None:
            raise HTTPException(status_code=500, detail="catalog_repo not configured")

        # Find or create the catalog item
        catalog_item: dict | None = None
        if data.barcode:
            catalog_item = self._catalog_repo.get_product_by_barcode(data.barcode)
        if catalog_item is None:
            catalog_item = self._catalog_repo.find_by_name(data.product_name)
        if catalog_item is None:
            catalog_item = self._catalog_repo.create({
                "name": data.product_name,
                "marca": data.product_brand,
                "category": data.product_category,
                "barcode": data.barcode,
                "emoji": data.emoji,
                "est_shelf_life_days": 7,
            })

        row = self._repo.create({
            "storage_area_id": str(data.storage_area_id),
            "catalog_item_id": catalog_item["id"],
            "quantity": data.quantity,
            "unit": data.unit,
            "entry_date": date.today().isoformat(),
            "expiry_date": data.expiry_date.isoformat() if data.expiry_date else None,
            "freshness_state": "fresco",
        })

        return InventoryCreateResponse(
            id=row["id"],
            catalog_item_id=row["catalog_item_id"],
            storage_area_id=row["storage_area_id"],
            quantity=row["quantity"],
            expiry_date=row.get("expiry_date"),
        )

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

    def add_from_detection(self, request: AddDetectedItemsRequest) -> list[dict]:
        results = []
        for item_data in request.items:
            # Find or create catalog item by name
            catalog_item = self._catalog_repo.find_by_name(item_data.name)
            if not catalog_item:
                catalog_item = self._catalog_repo.create({
                    "name": item_data.name,
                    "category": "Frutas y Verduras",
                    "barcode": None,
                    "duracion_estimada_dias": 7,
                })

            shelf_life = catalog_item.get("duracion_estimada_dias") or 7
            expiry_date = date.today() + timedelta(days=shelf_life)

            row = self._repo.create({
                "storage_area_id": str(request.storage_area_id),
                "catalog_item_id": catalog_item["id"],
                "quantity": item_data.quantity,
                "unit": item_data.unit,
                "entry_date": date.today().isoformat(),
                "expiry_date": expiry_date.isoformat(),
                "freshness_state": "fresco",
            })
            results.append({"id": row["id"], "name": catalog_item["name"]})

        return results

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _map_row(row: dict) -> InventoryItemResponse:
        catalog = row.get("catalog_items") or {}
        logs: list[dict] = row.get("history_logs") or []

        last_used: datetime | None = None
        if logs:
            timestamps = [
                datetime.fromisoformat(log["created_at"])
                for log in logs
                if log.get("created_at")
            ]
            last_used = max(timestamps) if timestamps else None

        return InventoryItemResponse(
            id=row["id"],
            nombre=catalog.get("name", ""),
            marca=catalog.get("marca"),
            emoji=catalog.get("emoji"),
            foto=row.get("foto_url") or catalog.get("image_url"),
            categoria=catalog.get("category"),
            fecha_vencimiento=row.get("expiry_date"),
            estado=row.get("freshness_state") or "fresco",
            last_used=last_used,
        )
