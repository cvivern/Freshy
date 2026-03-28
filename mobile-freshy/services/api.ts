const API_BASE_URL = 'http://localhost:8000';

export type InventoryItemResponse = {
  id: string;
  nombre: string;
  marca: string | null;
  emoji: string | null;
  foto: string | null;
  categoria: string | null;
  fecha_vencimiento: string | null; // 'YYYY-MM-DD'
  estado: 'fresco' | 'por_vencer' | 'vencido';
  last_used: string | null;
};

export async function fetchInventory(
  userId: string,
  storageAreaId: string
): Promise<InventoryItemResponse[]> {
  const url = `${API_BASE_URL}/api/v1/inventory/?user_id=${encodeURIComponent(userId)}&storage_area_id=${encodeURIComponent(storageAreaId)}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Error ${response.status}: ${response.statusText}`);
  }
  return response.json();
}
