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

    def get_storage_area_ids_by_owner(self, user_id: str) -> list[UUID]:
        """Returns all storage_area IDs that belong to households owned by the given user."""
        response = (
            self._db.table(STORAGE_AREAS_TABLE)
            .select("id, households!inner(owner_id)")
            .eq("households.owner_id", user_id)
            .execute()
        )
        return [row["id"] for row in (response.data or [])]

    def find_by_product_name_in_area(self, storage_area_id: UUID, name: str) -> list[dict]:
        """Find inventory rows in a storage area where catalog item name matches (fuzzy)."""
        response = (
            self._db.table(INVENTORY_TABLE)
            .select("id, quantity, expiry_date, catalog_item_id, catalog_items(id, name, emoji)")
            .eq("storage_area_id", str(storage_area_id))
            .execute()
        )
        name_lower = name.lower().strip()
        results = []
        for row in (response.data or []):
            item_name = (row.get("catalog_items") or {}).get("name", "").lower().strip()
            if not item_name:
                continue
            # Accept if either is a substring of the other
            if name_lower in item_name or item_name in name_lower:
                results.append(row)
        # FIFO: earliest expiry first
        results.sort(key=lambda r: r.get("expiry_date") or "9999-99-99")
        return results

    def update_quantity(self, inventory_id: str, new_quantity: int) -> dict:
        response = (
            self._db.table(INVENTORY_TABLE)
            .update({"quantity": new_quantity})
            .eq("id", inventory_id)
            .execute()
        )
        return response.data[0] if response.data else {}

    def delete_item(self, inventory_id: str) -> bool:
        response = (
            self._db.table(INVENTORY_TABLE)
            .delete()
            .eq("id", inventory_id)
            .execute()
        )
        return len(response.data) > 0

    def get_storage_area_owner(self, storage_area_id: UUID | None) -> str | None:
        """Returns the owner_id (profile_id) that owns the storage_area, or None.

        Note: .maybe_single() returns None (not a response object) when there
        are no matching rows in some versions of postgrest-py, so we guard
        against that explicitly before accessing .data.
        """
        if storage_area_id is None:
            return None
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
