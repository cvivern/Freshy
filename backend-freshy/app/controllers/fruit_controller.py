from uuid import UUID

from fastapi import APIRouter, Depends, status

from app.core.supabase import get_supabase_client
from app.models.catalog_item import CatalogItemResponse, FruitCreate, FruitUpdate
from app.repositories.catalog_item_repository import CatalogItemRepository
from app.services.fruit_service import FruitService

router = APIRouter(prefix="/fruits", tags=["Fruits & Vegetables"])


# ---------------------------------------------------------------------------
# Dependency injection helpers
# ---------------------------------------------------------------------------

def get_fruit_service() -> FruitService:
    client = get_supabase_client()
    repo = CatalogItemRepository(client)
    return FruitService(repo)


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get(
    "/",
    response_model=list[CatalogItemResponse],
    summary="List all fruits and vegetables",
)
def list_fruits(service: FruitService = Depends(get_fruit_service)):
    return service.get_all()


@router.get(
    "/{fruit_id}",
    response_model=CatalogItemResponse,
    summary="Get a fruit or vegetable by ID",
)
def get_fruit(
    fruit_id: UUID,
    service: FruitService = Depends(get_fruit_service),
):
    return service.get_by_id(fruit_id)


@router.post(
    "/",
    response_model=CatalogItemResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new fruit or vegetable",
)
def create_fruit(
    body: FruitCreate,
    service: FruitService = Depends(get_fruit_service),
):
    return service.create(body)


@router.patch(
    "/{fruit_id}",
    response_model=CatalogItemResponse,
    summary="Partially update a fruit or vegetable",
)
def update_fruit(
    fruit_id: UUID,
    body: FruitUpdate,
    service: FruitService = Depends(get_fruit_service),
):
    return service.update(fruit_id, body)


@router.delete(
    "/{fruit_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a fruit or vegetable",
)
def delete_fruit(
    fruit_id: UUID,
    service: FruitService = Depends(get_fruit_service),
):
    service.delete(fruit_id)
