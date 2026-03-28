from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from services.supabase_client import get_supabase

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])


class LoginRequest(BaseModel):
    email: str
    password: str


class ChangePasswordRequest(BaseModel):
    user_id: str
    email: str
    current_password: str
    new_password: str


@router.post("/login")
async def login(body: LoginRequest):
    """Sign in with email and password via Supabase Auth."""
    try:
        supabase = get_supabase()
        response = supabase.auth.sign_in_with_password({"email": body.email, "password": body.password})
    except Exception as e:
        raise HTTPException(status_code=401, detail="Credenciales inválidas")

    if not response.user:
        raise HTTPException(status_code=401, detail="Credenciales inválidas")

    user_id = str(response.user.id)

    # Fetch profile data
    try:
        profile_res = supabase.table("profiles").select("id, name, email, created_at").eq("id", user_id).single().execute()
    except Exception:
        profile_res = None

    profile = profile_res.data if profile_res else None

    return {
        "user_id": user_id,
        "name": profile["name"] if profile else response.user.email,
        "email": response.user.email,
        "created_at": profile["created_at"] if profile else None,
    }


@router.post("/change-password")
async def change_password(body: ChangePasswordRequest):
    """Verifies current password then updates to new password."""
    if len(body.new_password) < 6:
        raise HTTPException(status_code=400, detail="La nueva contraseña debe tener al menos 6 caracteres")

    supabase = get_supabase()

    # Verify current password by attempting sign in
    try:
        supabase.auth.sign_in_with_password({"email": body.email, "password": body.current_password})
    except Exception:
        raise HTTPException(status_code=401, detail="La contraseña actual es incorrecta")

    # Update to new password using admin API
    try:
        supabase.auth.admin.update_user_by_id(body.user_id, {"password": body.new_password})
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"No se pudo actualizar la contraseña: {e}")

    return {"message": "Contraseña actualizada correctamente"}
