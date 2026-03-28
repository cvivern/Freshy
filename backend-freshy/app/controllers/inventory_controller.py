from uuid import UUID

from fastapi import APIRouter, Depends, Query, status

from app.core.supabase import get_supabase_client
from app.models.inventory import InventoryCreate, InventoryCreateResponse, InventoryItemResponse, AddDetectedItemsRequest
from app.repositories.catalog_item_repository import CatalogItemRepository
from app.repositories.inventory_repository import InventoryRepository
from app.services.inventory_service import InventoryService

router = APIRouter(prefix="/inventory", tags=["Inventory"])


# ---------------------------------------------------------------------------
# Dependency injection
# ---------------------------------------------------------------------------

def get_inventory_service() -> InventoryService:
    client = get_supabase_client()
    repo = InventoryRepository(client)
    catalog_repo = CatalogItemRepository(client)
    return InventoryService(repo, catalog_repo)


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post(
    "/",
    response_model=InventoryCreateResponse,
    status_code=201,
    summary="Add an item to inventory (find-or-create catalog entry)",
)
def add_inventory_item(
    body: InventoryCreate,
    service: InventoryService = Depends(get_inventory_service),
):
    return service.add_item(body)


@router.get(
    "/",
    response_model=list[InventoryItemResponse],
    summary="List inventory items for a storage area",
)
def list_inventory(
    user_id: str = Query(..., description="Profile ID of the requesting user"),
    storage_area_id: UUID = Query(..., description="UUID of the storage area"),
    categoria: str | None = Query(None, description="Filter by category (partial match)"),
    nombre: str | None = Query(None, description="Filter by product name (partial match)"),
    marca: str | None = Query(None, description="Filter by brand (partial match)"),
    estado: str | None = Query(None, description="Filter by status: fresco | por_vencer | vencido"),
    service: InventoryService = Depends(get_inventory_service),
):
    return service.get_inventory(
        storage_area_id=storage_area_id,
        user_id=user_id,
        categoria=categoria,
        nombre=nombre,
        marca=marca,
        estado=estado,
    )


@router.post(
    "/",
    status_code=status.HTTP_201_CREATED,
    summary="Add detected items to inventory",
)
def add_detected_items(
    body: AddDetectedItemsRequest,
    service: InventoryService = Depends(get_inventory_service),
):
    return service.add_from_detection(body)


@router.get(
    "/stats",
    summary="Aggregate stats for a storage area",
)
def get_stats(
    user_id: str = Query(...),
    storage_area_id: UUID = Query(...),
    service: InventoryService = Depends(get_inventory_service),
):
    from collections import Counter
    items = service.get_inventory(storage_area_id=storage_area_id, user_id=user_id)

    fresco = sum(1 for i in items if i.estado == "fresco")
    por_vencer = sum(1 for i in items if i.estado == "por_vencer")
    vencido = sum(1 for i in items if i.estado == "vencido")

    name_counts: Counter = Counter()
    name_meta: dict = {}
    for i in items:
        name_counts[i.nombre] += 1
        if i.nombre not in name_meta:
            name_meta[i.nombre] = {"emoji": i.emoji or "📦", "marca": i.marca or ""}
    top_productos = [
        {"emoji": name_meta[n]["emoji"], "name": n, "brand": name_meta[n]["marca"], "cantidad": c}
        for n, c in name_counts.most_common(5)
    ]

    cat_counts: Counter = Counter()
    for i in items:
        cat_counts[i.categoria or "Sin categoría"] += 1
    categorias = [{"nombre": k, "cantidad": v} for k, v in cat_counts.most_common()]

    return {
        "total": len(items),
        "fresco": fresco,
        "por_vencer": por_vencer,
        "vencido": vencido,
        "top_productos": top_productos,
        "categorias": categorias,
    }
