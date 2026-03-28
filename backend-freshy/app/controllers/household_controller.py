from fastapi import APIRouter, Query, status
from pydantic import BaseModel

from app.core.supabase import get_supabase_client

router = APIRouter(prefix="/households", tags=["Households"])

HOUSEHOLDS_TABLE = "households"


def _get_db():
    return get_supabase_client()


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------

class HouseholdCreate(BaseModel):
    owner_id: str
    name: str


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/", summary="List households owned by a user")
def list_households(user_id: str = Query(..., description="Profile ID of the requesting user")):
    db = _get_db()
    response = (
        db.table(HOUSEHOLDS_TABLE)
        .select("id, name, owner_id")
        .eq("owner_id", user_id)
        .execute()
    )
    return response.data


@router.post("/", status_code=status.HTTP_201_CREATED, summary="Create a household")
def create_household(body: HouseholdCreate):
    db = _get_db()
    response = (
        db.table(HOUSEHOLDS_TABLE)
        .insert({"owner_id": body.owner_id, "name": body.name})
        .execute()
    )
    return response.data[0]


@router.delete("/{household_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete a household")
def delete_household(household_id: str):
    db = _get_db()
    db.table(HOUSEHOLDS_TABLE).delete().eq("id", household_id).execute()
