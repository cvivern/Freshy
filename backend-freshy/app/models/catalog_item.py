from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Shared base — fields common to every catalog item
# ---------------------------------------------------------------------------
class CatalogItemBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255, examples=["Leche entera"])
    category: str | None = Field(None, examples=["lácteo"])
    est_shelf_life_days: int = Field(..., gt=0, examples=[7])
    image_url: str | None = Field(None, examples=["https://cdn.freshy.app/img/leche.png"])


# ---------------------------------------------------------------------------
# General Products  (barcode is REQUIRED)
# ---------------------------------------------------------------------------
class ProductCreate(CatalogItemBase):
    barcode: str = Field(..., min_length=1, examples=["7790580100015"])


class ProductUpdate(BaseModel):
    """All fields optional for PATCH-style updates."""

    name: str | None = Field(None, min_length=1, max_length=255)
    barcode: str | None = Field(None, min_length=1)
    category: str | None = None
    est_shelf_life_days: int | None = Field(None, gt=0)
    image_url: str | None = None


# ---------------------------------------------------------------------------
# Fruits / Vegetables  (no barcode)
# ---------------------------------------------------------------------------
class FruitCreate(CatalogItemBase):
    """
    Fruits and vegetables are identified only by name + category.
    The barcode field is intentionally absent.
    """

    category: str = Field(..., examples=["fruta"])  # required for fruits


class FruitUpdate(BaseModel):
    """All fields optional for PATCH-style updates."""

    name: str | None = Field(None, min_length=1, max_length=255)
    category: str | None = None
    est_shelf_life_days: int | None = Field(None, gt=0)
    image_url: str | None = None


# ---------------------------------------------------------------------------
# Response schema — returned to the client for both types
# ---------------------------------------------------------------------------
class CatalogItemResponse(CatalogItemBase):
    id: UUID
    barcode: str | None
    created_at: datetime

    model_config = {"from_attributes": True}
