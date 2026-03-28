from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from services.supabase_client import get_supabase

router = APIRouter(prefix="/api/v1/profiles", tags=["profiles"])


class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None


class AddMemberRequest(BaseModel):
    email: str


@router.get("/{user_id}")
async def get_profile(user_id: str):
    """Returns profile + household for a given user."""
    try:
        supabase = get_supabase()
        profile_res = supabase.table("profiles").select("id, name, email, created_at").eq("id", user_id).single().execute()
    except Exception as e:
        raise HTTPException(status_code=404, detail=f"Profile not found: {e}")

    profile = profile_res.data
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")

    try:
        household_res = supabase.table("households").select("id, name").eq("owner_id", user_id).limit(1).execute()
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Database error: {e}")

    household = household_res.data[0] if household_res.data else None

    members = []
    if household:
        try:
            members_res = (
                supabase.table("household_members")
                .select("user_id, profiles(id, name, email)")
                .eq("household_id", household["id"])
                .execute()
            )
            members = [
                {"id": row["profiles"]["id"], "name": row["profiles"]["name"], "email": row["profiles"]["email"]}
                for row in members_res.data
                if row.get("profiles")
            ]
        except Exception:
            members = []

    return {
        "id": profile["id"],
        "name": profile["name"],
        "email": profile["email"],
        "created_at": profile["created_at"],
        "household": household,
        "members": members,
    }


@router.patch("/{user_id}")
async def update_profile(user_id: str, body: ProfileUpdate):
    """Updates name and/or email for a given user."""
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")
    try:
        supabase = get_supabase()
        result = supabase.table("profiles").update(updates).eq("id", user_id).execute()
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Database error: {e}")
    if not result.data:
        raise HTTPException(status_code=404, detail="Profile not found")
    return result.data[0]


@router.post("/{user_id}/members")
async def add_member(user_id: str, body: AddMemberRequest):
    """Adds a member to the owner's household by email. The user must exist in profiles."""
    try:
        supabase = get_supabase()

        # Find the household owned by user_id
        household_res = supabase.table("households").select("id").eq("owner_id", user_id).limit(1).execute()
        if not household_res.data:
            raise HTTPException(status_code=404, detail="No household found for this user")
        household_id = household_res.data[0]["id"]

        # Find the profile with the given email
        member_res = supabase.table("profiles").select("id, name, email").eq("email", body.email).limit(1).execute()
        if not member_res.data:
            raise HTTPException(status_code=404, detail="No user found with that email")
        member = member_res.data[0]

        if member["id"] == user_id:
            raise HTTPException(status_code=400, detail="You can't add yourself")

        # Insert into household_members (ignore if already exists)
        supabase.table("household_members").upsert(
            {"household_id": household_id, "user_id": member["id"]},
            on_conflict="household_id,user_id"
        ).execute()

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Database error: {e}")

    return {"id": member["id"], "name": member["name"], "email": member["email"]}
