from uuid import UUID

from fastapi import HTTPException, status

from app.models.catalog_item import (
    CatalogItemResponse,
    ProductCreate,
    ProductUpdate,
)
from app.repositories.catalog_item_repository import CatalogItemRepository


class ProductService:
    """
    Business logic for general products (items that carry a barcode).
    Validates uniqueness and maps between Pydantic models and raw dicts.
    """

    def __init__(self, repo: CatalogItemRepository) -> None:
        self._repo = repo

    def get_all(self) -> list[CatalogItemResponse]:
        rows = self._repo.get_all_products()
        return [CatalogItemResponse(**r) for r in rows]

    def get_by_id(self, item_id: UUID) -> CatalogItemResponse:
        row = self._repo.get_product_by_id(item_id)
        if not row:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Product {item_id} not found.",
            )
        return CatalogItemResponse(**row)

    def create(self, data: ProductCreate) -> CatalogItemResponse:
        # Barcode must be unique across the catalog
        existing = self._repo.get_product_by_barcode(data.barcode)
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"A product with barcode '{data.barcode}' already exists.",
            )
        row = self._repo.create(data.model_dump())
        return CatalogItemResponse(**row)

    def update(self, item_id: UUID, data: ProductUpdate) -> CatalogItemResponse:
        # Ensure the product exists and belongs to the "with barcode" group
        self.get_by_id(item_id)

        # If updating barcode, check it's not already taken by another item
        if data.barcode:
            existing = self._repo.get_product_by_barcode(data.barcode)
            if existing and existing["id"] != str(item_id):
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Barcode '{data.barcode}' is already in use.",
                )

        payload = data.model_dump(exclude_none=True)
        row = self._repo.update(item_id, payload)
        if not row:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Product {item_id} not found.",
            )
        return CatalogItemResponse(**row)

    def delete(self, item_id: UUID) -> None:
        self.get_by_id(item_id)
        deleted = self._repo.delete(item_id)
        if not deleted:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Product {item_id} not found.",
            )
