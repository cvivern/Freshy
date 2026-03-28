from uuid import UUID

from fastapi import APIRouter, Depends, status

from app.core.supabase import get_supabase_client
from app.models.catalog_item import CatalogItemResponse, ProductCreate, ProductUpdate
from app.repositories.catalog_item_repository import CatalogItemRepository
from app.services.product_service import ProductService

router = APIRouter(prefix="/products", tags=["Products"])


# ---------------------------------------------------------------------------
# Dependency injection helpers
# ---------------------------------------------------------------------------

def get_product_service() -> ProductService:
    client = get_supabase_client()
    repo = CatalogItemRepository(client)
    return ProductService(repo)


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get(
    "/",
    response_model=list[CatalogItemResponse],
    summary="List all general products",
)
def list_products(service: ProductService = Depends(get_product_service)):
    return service.get_all()


@router.get(
    "/{product_id}",
    response_model=CatalogItemResponse,
    summary="Get a product by ID",
)
def get_product(
    product_id: UUID,
    service: ProductService = Depends(get_product_service),
):
    return service.get_by_id(product_id)


@router.post(
    "/",
    response_model=CatalogItemResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new general product",
)
def create_product(
    body: ProductCreate,
    service: ProductService = Depends(get_product_service),
):
    return service.create(body)


@router.patch(
    "/{product_id}",
    response_model=CatalogItemResponse,
    summary="Partially update a product",
)
def update_product(
    product_id: UUID,
    body: ProductUpdate,
    service: ProductService = Depends(get_product_service),
):
    return service.update(product_id, body)


@router.delete(
    "/{product_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a product",
)
def delete_product(
    product_id: UUID,
    service: ProductService = Depends(get_product_service),
):
    service.delete(product_id)
