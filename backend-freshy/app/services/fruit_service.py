from uuid import UUID

from fastapi import HTTPException, status

from app.models.catalog_item import (
    CatalogItemResponse,
    FruitCreate,
    FruitUpdate,
)
from app.repositories.catalog_item_repository import CatalogItemRepository


class FruitService:
    """
    Business logic for fruits and vegetables (items without a barcode).
    Ensures the barcode field is never set for this type.
    """

    def __init__(self, repo: CatalogItemRepository) -> None:
        self._repo = repo

    def get_all(self) -> list[CatalogItemResponse]:
        rows = self._repo.get_all_fruits()
        return [CatalogItemResponse(**r) for r in rows]

    def get_by_id(self, item_id: UUID) -> CatalogItemResponse:
        row = self._repo.get_fruit_by_id(item_id)
        if not row:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Fruit/vegetable {item_id} not found.",
            )
        return CatalogItemResponse(**row)

    def create(self, data: FruitCreate) -> CatalogItemResponse:
        # Fruits never have a barcode — enforce at service level
        payload = data.model_dump()
        payload["barcode"] = None
        row = self._repo.create(payload)
        return CatalogItemResponse(**row)

    def update(self, item_id: UUID, data: FruitUpdate) -> CatalogItemResponse:
        # Ensure the fruit exists and belongs to the "no barcode" group
        self.get_by_id(item_id)

        payload = data.model_dump(exclude_none=True)
        row = self._repo.update(item_id, payload)
        if not row:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Fruit/vegetable {item_id} not found.",
            )
        return CatalogItemResponse(**row)

    def delete(self, item_id: UUID) -> None:
        self.get_by_id(item_id)
        deleted = self._repo.delete(item_id)
        if not deleted:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Fruit/vegetable {item_id} not found.",
            )
