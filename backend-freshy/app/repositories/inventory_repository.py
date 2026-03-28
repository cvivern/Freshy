from uuid import UUID

from supabase import Client

INVENTORY_TABLE = "inventory"
STORAGE_AREAS_TABLE = "storage_areas"


class InventoryRepository:
    """
    Low-level data access layer for the inventory table.
    Uses PostgREST nested selects to join catalog_items and history_logs.
    """

    def __init__(self, client: Client) -> None:
        self._db = client

    def get_by_storage_area(self, storage_area_id: UUID) -> list[dict]:
        """
        Returns all inventory rows for a given storage_area, with nested:
          - catalog_items (nombre, marca, emoji, image_url, category)
          - history_logs  (created_at) — para calcular last_used en el servicio
        """
        response = (
            self._db.table(INVENTORY_TABLE)
            .select(
                "id, fecha_vencimiento, estado, foto_url, "
                "catalog_items(name, marca, emoji, image_url, category), "
                "history_logs(created_at)"
            )
            .eq("storage_area_id", str(storage_area_id))
            .execute()
        )
        return response.data

    def get_storage_area_owner(self, storage_area_id: UUID) -> str | None:
        """Returns the user_id (profile_id) that owns the storage_area, or None."""
        response = (
            self._db.table(STORAGE_AREAS_TABLE)
            .select("households(user_id)")
            .eq("id", str(storage_area_id))
            .maybe_single()
            .execute()
        )
        if not response.data:
            return None
        households = response.data.get("households")
        if not households:
            return None
        return households.get("user_id")
