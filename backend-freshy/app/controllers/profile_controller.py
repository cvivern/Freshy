from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from typing import Optional

from app.core.supabase import get_supabase_client

router = APIRouter(prefix="/profiles", tags=["Profiles"])


def _get_db():
    return get_supabase_client()


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------

class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None


class AddMemberRequest(BaseModel):
    email: str


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/{user_id}", summary="Get profile with household and members")
def get_profile(user_id: str):
    db = _get_db()

    profile_res = db.table("profiles").select("id, name, email, created_at").eq("id", user_id).single().execute()
    if not profile_res.data:
        raise HTTPException(status_code=404, detail="Profile not found")
    profile = profile_res.data

    household_res = db.table("households").select("id, name").eq("owner_id", user_id).limit(1).execute()
    household = household_res.data[0] if household_res.data else None

    members = []
    if household:
        members_res = (
            db.table("household_members")
            .select("user_id, profiles(id, name, email)")
            .eq("household_id", household["id"])
            .execute()
        )
        members = [
            {"id": row["profiles"]["id"], "name": row["profiles"]["name"], "email": row["profiles"]["email"]}
            for row in members_res.data
            if row.get("profiles")
        ]

    return {
        "id": profile["id"],
        "name": profile["name"],
        "email": profile["email"],
        "created_at": profile["created_at"],
        "household": household,
        "members": members,
    }


@router.patch("/{user_id}", summary="Update profile name and/or email")
def update_profile(user_id: str, body: ProfileUpdate):
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")
    db = _get_db()
    result = db.table("profiles").update(updates).eq("id", user_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Profile not found")
    return result.data[0]


@router.post("/{user_id}/members", status_code=status.HTTP_201_CREATED, summary="Add a member by email")
def add_member(user_id: str, body: AddMemberRequest):
    db = _get_db()

    household_res = db.table("households").select("id").eq("owner_id", user_id).limit(1).execute()
    if not household_res.data:
        raise HTTPException(status_code=404, detail="No household found for this user")
    household_id = household_res.data[0]["id"]

    member_res = db.table("profiles").select("id, name, email").eq("email", body.email).limit(1).execute()
    if not member_res.data:
        raise HTTPException(status_code=404, detail="No user found with that email")
    member = member_res.data[0]

    if member["id"] == user_id:
        raise HTTPException(status_code=400, detail="You can't add yourself")

    db.table("household_members").upsert(
        {"household_id": household_id, "user_id": member["id"]},
        on_conflict="household_id,user_id"
    ).execute()

    return {"id": member["id"], "name": member["name"], "email": member["email"]}
