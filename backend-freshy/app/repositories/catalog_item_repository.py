from uuid import UUID

from supabase import Client

TABLE = "catalog_items"


class CatalogItemRepository:
    """
    Low-level data access layer for the catalog_items table.
    No business logic here — only raw Supabase queries.
    """

    def __init__(self, client: Client) -> None:
        self._db = client

    # ------------------------------------------------------------------
    # General Products  (barcode IS NOT NULL)
    # ------------------------------------------------------------------

    def get_all_products(self) -> list[dict]:
        response = (
            self._db.table(TABLE)
            .select("*")
            .not_.is_("barcode", "null")
            .order("created_at", desc=True)
            .execute()
        )
        return response.data

    def get_product_by_id(self, item_id: UUID) -> dict | None:
        response = (
            self._db.table(TABLE)
            .select("*")
            .eq("id", str(item_id))
            .not_.is_("barcode", "null")
            .maybe_single()
            .execute()
        )
        return response.data

    def get_product_by_barcode(self, barcode: str) -> dict | None:
        response = (
            self._db.table(TABLE)
            .select("*")
            .eq("barcode", barcode)
            .maybe_single()
            .execute()
        )
        return response.data

    def find_by_name(self, name: str) -> dict | None:
        response = (
            self._db.table(TABLE)
            .select("*")
            .ilike("name", f"%{name}%")
            .limit(1)
            .execute()
        )
        return response.data[0] if response.data else None

    # ------------------------------------------------------------------
    # Fruits / Vegetables  (barcode IS NULL)
    # ------------------------------------------------------------------

    def find_by_name(self, name: str) -> dict | None:
        response = (
            self._db.table(TABLE)
            .select("*")
            .ilike("name", name)
            .limit(1)
            .execute()
        )
        return response.data[0] if response.data else None

    def get_all_fruits(self) -> list[dict]:
        response = (
            self._db.table(TABLE)
            .select("*")
            .is_("barcode", "null")
            .order("created_at", desc=True)
            .execute()
        )
        return response.data

    def get_fruit_by_id(self, item_id: UUID) -> dict | None:
        response = (
            self._db.table(TABLE)
            .select("*")
            .eq("id", str(item_id))
            .is_("barcode", "null")
            .maybe_single()
            .execute()
        )
        return response.data

    # ------------------------------------------------------------------
    # Shared write operations (used by both services)
    # ------------------------------------------------------------------

    def create(self, payload: dict) -> dict:
        response = self._db.table(TABLE).insert(payload).execute()
        return response.data[0]

    def update_name(self, item_id: str, name: str) -> dict | None:
        response = (
            self._db.table(TABLE)
            .update({"name": name})
            .eq("id", item_id)
            .execute()
        )
        return response.data[0] if response.data else None

    def update(self, item_id: UUID, payload: dict) -> dict | None:
        response = (
            self._db.table(TABLE)
            .update(payload)
            .eq("id", str(item_id))
            .execute()
        )
        return response.data[0] if response.data else None

    def delete(self, item_id: UUID) -> bool:
        response = (
            self._db.table(TABLE)
            .delete()
            .eq("id", str(item_id))
            .execute()
        )
        return len(response.data) > 0
