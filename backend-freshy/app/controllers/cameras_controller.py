from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
import os
from supabase import create_client

router = APIRouter(prefix="/api/v1/cameras", tags=["Cameras"])

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY", os.environ.get("SUPABASE_SERVICE_ROLE_KEY", ""))

def _sb():
    return create_client(SUPABASE_URL, SUPABASE_KEY)


class CameraCreate(BaseModel):
    name: str
    storage_area_id: str
    user_id: str
    device_identifier: Optional[str] = ""
    is_active: bool = True


class CameraUpdate(BaseModel):
    name: Optional[str] = None
    storage_area_id: Optional[str] = None
    device_identifier: Optional[str] = None
    is_active: Optional[bool] = None


@router.get("/")
def list_cameras(user_id: str):
    """Returns all cameras for a user, joined with storage_area name and household name."""
    try:
        sb = _sb()
        # Get cameras for user
        res = sb.table("cameras").select("*, storage_areas(id, name, household_id, households(id, name))").eq("user_id", user_id).execute()
        return res.data or []
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/active")
def get_active_camera(user_id: str):
    """Returns the active camera for a user (used by desktop test script)."""
    try:
        sb = _sb()
        res = (
            sb.table("cameras")
            .select("*, storage_areas(id, name, households(id, name))")
            .eq("user_id", user_id)
            .eq("is_active", True)
            .limit(1)
            .execute()
        )
        if res.data:
            return res.data[0]
        raise HTTPException(status_code=404, detail="No active camera found")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/")
def create_camera(body: CameraCreate):
    try:
        sb = _sb()
        # If new camera is active, deactivate others for this user
        if body.is_active:
            sb.table("cameras").update({"is_active": False}).eq("user_id", body.user_id).execute()
        res = sb.table("cameras").insert(body.model_dump()).execute()
        return res.data[0] if res.data else {}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{camera_id}")
def update_camera(camera_id: str, body: CameraUpdate):
    try:
        sb = _sb()
        data = {k: v for k, v in body.model_dump().items() if v is not None}
        if not data:
            raise HTTPException(status_code=400, detail="Nothing to update")
        # If setting active=True, deactivate others first
        if data.get("is_active"):
            cam = sb.table("cameras").select("user_id").eq("id", camera_id).single().execute()
            if cam.data:
                sb.table("cameras").update({"is_active": False}).eq("user_id", cam.data["user_id"]).execute()
        res = sb.table("cameras").update(data).eq("id", camera_id).execute()
        return res.data[0] if res.data else {}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{camera_id}")
def delete_camera(camera_id: str):
    try:
        _sb().table("cameras").delete().eq("id", camera_id).execute()
        return {"ok": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
