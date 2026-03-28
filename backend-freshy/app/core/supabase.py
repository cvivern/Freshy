from functools import lru_cache

from supabase import Client, create_client

from app.core.config import settings


@lru_cache(maxsize=1)
def get_supabase_client() -> Client:
    """
    Returns a cached Supabase client using the service-role key.
    The service-role key bypasses RLS — safe for backend use only.
    """
    return create_client(settings.supabase_url, settings.supabase_service_role_key)
