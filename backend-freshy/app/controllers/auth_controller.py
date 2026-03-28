from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.core.supabase import get_supabase_client

router = APIRouter(prefix="/auth", tags=["Auth"])


def _get_db():
    return get_supabase_client()


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------

class LoginRequest(BaseModel):
    email: str
    password: str


class RegisterRequest(BaseModel):
    email: str
    password: str
    name: str


class ChangePasswordRequest(BaseModel):
    user_id: str
    email: str
    current_password: str
    new_password: str


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("/login", summary="Sign in with email and password")
def login(body: LoginRequest):
    db = _get_db()

    try:
        data = db.auth.sign_in_with_password({"email": body.email, "password": body.password})
    except Exception as e:
        raise HTTPException(status_code=401, detail=str(e))

    if not data.user:
        raise HTTPException(status_code=401, detail="Credenciales inválidas")

    user_id = str(data.user.id)

    profile_res = db.table("profiles").select("id, name, email, created_at").eq("id", user_id).limit(1).execute()
    profile = profile_res.data[0] if profile_res.data else None

    return {
        "user_id": user_id,
        "name": profile["name"] if profile else data.user.email,
        "email": data.user.email,
        "created_at": profile["created_at"] if profile else None,
        "access_token": data.session.access_token if data.session else None,
    }


@router.post("/register", status_code=201, summary="Create a new user account")
def register(body: RegisterRequest):
    if len(body.password) < 6:
        raise HTTPException(status_code=400, detail="La contraseña debe tener al menos 6 caracteres")

    db = _get_db()

    try:
        data = db.auth.admin.create_user({
            "email": body.email,
            "password": body.password,
            "email_confirm": True,
        })
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    if not data.user:
        raise HTTPException(status_code=400, detail="No se pudo crear el usuario")

    user_id = str(data.user.id)

    try:
        db.table("profiles").insert({
            "id": user_id,
            "email": body.email,
            "name": body.name,
        }).execute()
    except Exception as e:
        # Roll back the auth user so the state stays consistent
        db.auth.admin.delete_user(user_id)
        raise HTTPException(status_code=500, detail=f"Error al crear el perfil: {e}")

    return {
        "user_id": user_id,
        "name": body.name,
        "email": body.email,
    }


@router.post("/change-password", summary="Change password after verifying current one")
def change_password(body: ChangePasswordRequest):
    if len(body.new_password) < 6:
        raise HTTPException(status_code=400, detail="La nueva contraseña debe tener al menos 6 caracteres")

    db = _get_db()

    try:
        data = db.auth.sign_in_with_password({"email": body.email, "password": body.current_password})
        if not data.user:
            raise HTTPException(status_code=401, detail="La contraseña actual es incorrecta")
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=401, detail="La contraseña actual es incorrecta")

    try:
        db.auth.admin.update_user_by_id(body.user_id, {"password": body.new_password})
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"No se pudo actualizar la contraseña: {e}")

    return {"message": "Contraseña actualizada correctamente"}
