from fastapi import APIRouter, Query, status
from pydantic import BaseModel
from typing import Literal

from app.core.supabase import get_supabase_client

router = APIRouter(prefix="/storage-areas", tags=["Storage Areas"])

STORAGE_AREAS_TABLE = "storage_areas"

ClimateType = Literal["refrigerado", "seco", "congelado"]


def _get_db():
    return get_supabase_client()


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------

class StorageAreaCreate(BaseModel):
    household_id: str
    name: str
    climate: ClimateType = "seco"


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/", summary="List storage areas for a household")
def list_storage_areas(household_id: str = Query(..., description="UUID of the household")):
    db = _get_db()
    response = (
        db.table(STORAGE_AREAS_TABLE)
        .select("id, name, climate, household_id")
        .eq("household_id", household_id)
        .execute()
    )
    return response.data


@router.post("/", status_code=status.HTTP_201_CREATED, summary="Create a storage area")
def create_storage_area(body: StorageAreaCreate):
    db = _get_db()
    response = (
        db.table(STORAGE_AREAS_TABLE)
        .insert({"household_id": body.household_id, "name": body.name, "climate": body.climate})
        .execute()
    )
    return response.data[0]


@router.delete("/{storage_area_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete a storage area")
def delete_storage_area(storage_area_id: str):
    db = _get_db()
    db.table(STORAGE_AREAS_TABLE).delete().eq("id", storage_area_id).execute()
