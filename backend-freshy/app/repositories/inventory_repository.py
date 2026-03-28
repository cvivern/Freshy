from uuid import UUID

from supabase import Client

INVENTORY_TABLE = "inventory"
STORAGE_AREAS_TABLE = "storage_areas"


class InventoryRepository:
    """
    Low-level data access layer for the inventory table.

    Real schema (discovered from Supabase):
      inventory  : id, storage_area_id, catalog_item_id, quantity, unit,
                   entry_date, expiry_date, freshness_state
      history_logs: id, user_id, catalog_item_id, storage_area_id, action,
                   quantity, unit  ← NOT linked to inventory via FK
    """

    def __init__(self, client: Client) -> None:
        self._db = client

    def get_by_storage_area(self, storage_area_id: UUID) -> list[dict]:
        """
        Returns all inventory rows for a given storage_area, with nested
        catalog_items (name, category).
        """
        response = (
            self._db.table(INVENTORY_TABLE)
            .select(
                "id, expiry_date, freshness_state, quantity, unit, entry_date, "
                "catalog_items(name, category, marca, emoji)"
            )
            .eq("storage_area_id", str(storage_area_id))
            .execute()
        )
        return response.data

    def create(self, payload: dict) -> dict:
        response = self._db.table(INVENTORY_TABLE).insert(payload).execute()
        return response.data[0]

    def get_storage_area_owner(self, storage_area_id: UUID) -> str | None:
        """Returns the owner_id (profile_id) that owns the storage_area, or None.

        Note: .maybe_single() returns None (not a response object) when there
        are no matching rows in some versions of postgrest-py, so we guard
        against that explicitly before accessing .data.
        """
        response = (
            self._db.table(STORAGE_AREAS_TABLE)
            .select("households(owner_id)")
            .eq("id", str(storage_area_id))
            .maybe_single()
            .execute()
        )
        if response is None or not response.data:
            return None
        households = response.data.get("households")
        if not households:
            return None
        return households.get("owner_id")
