// ------- Config -------
export const API_BASE = 'https://backend-freshy.vercel.app';

// Default household for seed data
export const DEFAULT_HOUSEHOLD_ID = '00000000-0000-0000-0000-000000000001';

// Fallback IDs used by background monitor when no selection is available
export const DEFAULT_STORAGE_AREA_ID = '';
export const DEFAULT_USER_ID = '';

// ------- Auth helper -------
function authHeaders(token?: string | null): Record<string, string> {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// ------- Types -------
export type Detection = { label: string; confidence: number; freshness?: string; shelf_life_days?: number; emoji?: string };

export type ProductInfo = { category: string; brand: string; name: string };

export type BarcodeInfo = { barcode: string; expiryDate: string };

export type GeminiResult =
  | { type: 'fruit' | 'vegetable'; name: string; freshness: 'fresco' | 'medio' | 'malo'; scanned_at: string }
  | { type: 'barcode_product'; name: string; brand: string | null; expiry_date: string | null; scanned_at: string }
  | { type: 'unknown'; scanned_at: string };

export type PackagedScanResult = {
  name: string | null;
  brand: string | null;
  expiry_date: string | null;
};

export type InventoryItem = {
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

export type AddInventoryPayload = {
  storage_area_id: string;
  product_name: string;
  product_brand?: string;
  product_category?: string;
  barcode?: string;
  emoji?: string;
  quantity: number;
  unit?: string;
  expiry_date?: string;
};

// ------- Label mapping (Roboflow fruit-b2sy0) -------
const LABEL_MAP: Record<string, string> = {
  // Plain labels (returned by /api/v1/detection/identify)
  strawberry:        'Frutilla',
  apple:             'Manzana',
  banana:            'Banana',
  orange:            'Naranja',
  mango:             'Mango',
  grapes:            'Uvas',
  watermelon:        'Sandía',
  pineapple:         'Ananá',
  lemon:             'Limón',
  // _fresh / _rotten labels (legacy /detection/fruits endpoint)
  apple_fresh:       'Manzana',
  apple_rotten:      'Manzana (en mal estado)',
  banana_fresh:      'Banana',
  banana_rotten:     'Banana (en mal estado)',
  orange_fresh:      'Naranja',
  orange_rotten:     'Naranja (en mal estado)',
  mango_fresh:       'Mango',
  mango_rotten:      'Mango (en mal estado)',
  strawberry_fresh:  'Frutilla',
  strawberry_rotten: 'Frutilla (en mal estado)',
  grapes_fresh:      'Uvas',
  grapes_rotten:     'Uvas (en mal estado)',
  watermelon_fresh:  'Sandía',
  pineapple_fresh:   'Ananá',
  lemon_fresh:       'Limón',
};

// ------- Helpers -------
export function getFruitName(label: string): string {
  return LABEL_MAP[label] ?? label.replace(/_/g, ' ');
}

export function parseFruitDetections(detections: Detection[]): ProductInfo {
  if (!detections.length) return { category: 'Frutas y verduras', brand: '—', name: 'No reconocido' };
  const best = detections.reduce((a, b) => (a.confidence > b.confidence ? a : b));
  const name = LABEL_MAP[best.label] ?? best.label.replace(/_/g, ' ');
  return { category: 'Frutas y verduras', brand: '—', name };
}

export function calcEstado(
  fechaVencimiento: string | null
): 'fresco' | 'por_vencer' | 'vencido' {
  if (!fechaVencimiento) return 'fresco';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(fechaVencimiento);
  expiry.setHours(0, 0, 0, 0);
  const daysLeft = Math.floor((expiry.getTime() - today.getTime()) / 86_400_000);
  return daysLeft < 0 ? 'vencido' : daysLeft <= 7 ? 'por_vencer' : 'fresco';
}

/** Convierte DD/MM/AAAA o DD/MM/AA → YYYY-MM-DD. Si ya está en ISO lo devuelve igual. */
export function toISODate(input: string): string {
  const trimmed = input.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const parts = trimmed.split('/');
  if (parts.length === 3) {
    const [d, m, y] = parts;
    const year = y.length === 2 ? `20${y}` : y;
    return `${year}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  return trimmed;
}

// ------- Base fetch con timeout -------
export async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs = 30000
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    return response;
  } catch (err: any) {
    if (err?.name === 'AbortError')
      throw new Error('La solicitud tardó demasiado. Verificá que el backend esté corriendo.');
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

// ------- Detection endpoints -------

/** Main Gemini endpoint — detects fruits, vegetables and packaged products */
export async function analyzeImage(uri: string): Promise<GeminiResult> {
  const formData = new FormData();
  formData.append('image', { uri, name: 'photo.jpg', type: 'image/jpeg' } as any);
  const response = await fetchWithTimeout(
    `${API_BASE}/api/v1/detection/analyze`,
    { method: 'POST', body: formData }
  );
  if (!response.ok) throw new Error(`Error del servidor: ${response.status}`);
  return response.json();
}

export async function scanPackagedProduct(uri: string): Promise<PackagedScanResult> {
  const formData = new FormData();
  formData.append('file', { uri, name: 'photo.jpg', type: 'image/jpeg' } as any);
  const response = await fetchWithTimeout(`${API_BASE}/api/v1/detection/scan`, { method: 'POST', body: formData });
  if (!response.ok) throw new Error(`Error del servidor: ${response.status}`);
  const data = await response.json();
  // Only extract packaged-product fields when the model identified a barcode product.
  // Any other type (fruit, unknown) yields all nulls so prior scan data is preserved.
  if (data.type !== 'barcode_product') {
    return { name: null, brand: null, expiry_date: null };
  }
  return {
    name: data.name ?? null,
    brand: data.brand ?? null,
    expiry_date: data.expiry_date ?? null,
  };
}


export async function identifyFruits(uri: string): Promise<Detection[]> {
  const formData = new FormData();
  formData.append('file', { uri, name: 'photo.jpg', type: 'image/jpeg' } as any);
  const response = await fetchWithTimeout(`${API_BASE}/api/v1/detection/identify`, { method: 'POST', body: formData });
  if (!response.ok) throw new Error(`Error del servidor: ${response.status}`);
  const data = await response.json();
  return (data.detections ?? []) as Detection[];
}

export async function detectFrutaVerdura(uri: string): Promise<ProductInfo> {
  const formData = new FormData();
  formData.append('image', { uri, name: 'photo.jpg', type: 'image/jpeg' } as any);
  const response = await fetchWithTimeout(`${API_BASE}/api/v1/detection/fruits`, { method: 'POST', body: formData });
  if (!response.ok) throw new Error(`Error del servidor: ${response.status}`);
  const data = await response.json();
  return parseFruitDetections((data.detections ?? []) as Detection[]);
}

export async function detectOtroProducto(uri: string): Promise<ProductInfo> {
  const formData = new FormData();
  formData.append('image', { uri, name: 'photo.jpg', type: 'image/jpeg' } as any);
  const response = await fetchWithTimeout(`${API_BASE}/api/v1/detection/scan/product`, { method: 'POST', body: formData });
  if (!response.ok) throw new Error(`Error del servidor: ${response.status}`);
  const data = await response.json();
  return {
    category: 'Producto envasado',
    brand: data.brand ?? '—',
    name: data.name ?? '—',
  };
}

export async function scanBarcodeImage(uri: string): Promise<BarcodeInfo> {
  const formData = new FormData();
  formData.append('image', { uri, name: 'photo.jpg', type: 'image/jpeg' } as any);
  const response = await fetchWithTimeout(`${API_BASE}/detection/scan/barcode`, { method: 'POST', body: formData });
  if (!response.ok) throw new Error(`Error del servidor: ${response.status}`);
  const data = await response.json();
  return {
    barcode: data.barcode ?? '',
    expiryDate: data.expiry_date ?? '',
  };
}

// ------- Inventory endpoints -------
export async function fetchInventoryItems(
  userId: string,
  storageAreaId?: string,
  token?: string | null
): Promise<InventoryItem[]> {
  const params = new URLSearchParams({ user_id: userId });
  if (storageAreaId) params.append('storage_area_id', storageAreaId);
  const url = `${API_BASE}/api/v1/inventory/?${params.toString()}`;
  const response = await fetchWithTimeout(url, { method: 'GET', headers: authHeaders(token) }, 10000);
  if (!response.ok) return [];
  return response.json();
}

/** @deprecated Usá fetchInventoryItems. Mantenido para compatibilidad con stock.tsx */
export type InventoryItemResponse = InventoryItem;

/** @deprecated Usá fetchInventoryItems. Mantenido para compatibilidad con stock.tsx */
export async function fetchInventory(
  userId: string,
  storageAreaId?: string,
  token?: string | null
): Promise<InventoryItem[]> {
  return fetchInventoryItems(userId, storageAreaId, token);
}

// ------- Households & Storage Areas -------

export type Household = { id: string; name: string; owner_id: string };
export type StorageArea = { id: string; name: string; climate: 'refrigerado' | 'seco' | 'congelado'; household_id: string; emoji?: string };

export const CLIMATE_EMOJI: Record<string, string> = {
  refrigerado: '🧊',
  seco: '🗄️',
  congelado: '🥶',
};

export async function fetchHouseholds(userId: string, token?: string | null): Promise<Household[]> {
  const url = `${API_BASE}/api/v1/households/?user_id=${encodeURIComponent(userId)}`;
  const response = await fetchWithTimeout(url, { method: 'GET', headers: authHeaders(token) }, 10000);
  if (!response.ok) return [];
  return response.json();
}

export async function createHousehold(ownerId: string, name: string, token?: string | null): Promise<Household> {
  const response = await fetchWithTimeout(
    `${API_BASE}/api/v1/households/`,
    { method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders(token) }, body: JSON.stringify({ owner_id: ownerId, name }) },
    10000
  );
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Error del servidor (${response.status}): ${text}`);
  }
  return response.json();
}

export async function deleteHousehold(householdId: string, token?: string | null): Promise<void> {
  const response = await fetchWithTimeout(
    `${API_BASE}/api/v1/households/${encodeURIComponent(householdId)}`,
    { method: 'DELETE', headers: authHeaders(token) },
    10000
  );
  if (!response.ok && response.status !== 204) {
    const text = await response.text();
    throw new Error(`Error del servidor (${response.status}): ${text}`);
  }
}

export async function fetchStorageAreas(householdId: string, token?: string | null): Promise<StorageArea[]> {
  const url = `${API_BASE}/api/v1/storage-areas/?household_id=${encodeURIComponent(householdId)}`;
  const response = await fetchWithTimeout(url, { method: 'GET', headers: authHeaders(token) }, 10000);
  if (!response.ok) return [];
  return response.json();
}

export async function createStorageArea(householdId: string, name: string, climate: StorageArea['climate'], token?: string | null): Promise<StorageArea> {
  const response = await fetchWithTimeout(
    `${API_BASE}/api/v1/storage-areas/`,
    { method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders(token) }, body: JSON.stringify({ household_id: householdId, name, climate }) },
    10000
  );
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Error del servidor (${response.status}): ${text}`);
  }
  return response.json();
}

export async function deleteStorageArea(storageAreaId: string, token?: string | null): Promise<void> {
  const response = await fetchWithTimeout(
    `${API_BASE}/api/v1/storage-areas/${encodeURIComponent(storageAreaId)}`,
    { method: 'DELETE', headers: authHeaders(token) },
    10000
  );
  if (!response.ok && response.status !== 204) {
    const text = await response.text();
    throw new Error(`Error del servidor (${response.status}): ${text}`);
  }
}

// Maps Roboflow class names to readable Spanish labels
// Valid classes from this model: apple, kiwi, orange, pear, strawberry, tomato
export function formatItemName(cls: string): string {
  // Valid classes from this model: apple, kiwi, orange, pear, strawberry, tomato
  const map: Record<string, string> = {
    apple: 'Manzana',
    kiwi: 'Kiwi',
    orange: 'Naranja',
    pear: 'Pera',
    strawberry: 'Frutilla',
    tomato: 'Tomate',
  };
  return map[cls.toLowerCase()] ?? cls.replace(/_/g, ' ');
}

export async function addToInventory(payload: AddInventoryPayload, token?: string | null): Promise<void> {
  const response = await fetchWithTimeout(
    `${API_BASE}/api/v1/inventory/`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
      body: JSON.stringify(payload),
    }
  );
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Error del servidor (${response.status}): ${text}`);
  }
}

// ------- Profile -------

export type ProfileMember = { id: string; name: string; email: string };

export type UserProfile = {
  id: string;
  name: string;
  email: string;
  created_at: string;
  household: { id: string; name: string } | null;
  members: ProfileMember[];
};

export async function fetchProfile(userId: string, token?: string | null): Promise<UserProfile | null> {
  const url = `${API_BASE}/api/v1/profiles/${encodeURIComponent(userId)}`;
  try {
    const response = await fetchWithTimeout(url, { method: 'GET', headers: authHeaders(token) }, 10000);
    if (!response.ok) return null;
    return response.json();
  } catch {
    return null;
  }
}

export async function updateProfile(userId: string, fields: { name?: string; email?: string }, token?: string | null): Promise<void> {
  const response = await fetchWithTimeout(
    `${API_BASE}/api/v1/profiles/${encodeURIComponent(userId)}`,
    { method: 'PATCH', headers: { 'Content-Type': 'application/json', ...authHeaders(token) }, body: JSON.stringify(fields) },
    10000
  );
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Error del servidor (${response.status}): ${text}`);
  }
}

export async function addHouseholdMember(userId: string, email: string, token?: string | null): Promise<ProfileMember> {
  const response = await fetchWithTimeout(
    `${API_BASE}/api/v1/profiles/${encodeURIComponent(userId)}/members`,
    { method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders(token) }, body: JSON.stringify({ email }) },
    10000
  );
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.detail ?? `Error del servidor (${response.status})`);
  }
  return response.json();
}

// ------- Cameras -------

export type Camera = {
  id: string;
  name: string;
  storage_area_id: string;
  device_identifier: string;
  is_active: boolean;
  last_scan_at: string | null;
  created_at: string;
  user_id: string;
  storage_areas?: {
    id: string;
    name: string;
    household_id: string;
    households?: { id: string; name: string };
  };
};

export async function fetchCameras(userId: string): Promise<Camera[]> {
  const res = await fetchWithTimeout(`${API_BASE}/api/v1/cameras/?user_id=${userId}`, {});
  if (!res.ok) return [];
  return res.json();
}

export async function createCamera(data: {
  name: string;
  storage_area_id: string;
  user_id: string;
  device_identifier?: string;
  is_active?: boolean;
}): Promise<Camera> {
  const res = await fetchWithTimeout(`${API_BASE}/api/v1/cameras/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function updateCamera(cameraId: string, data: Partial<Camera>): Promise<Camera> {
  const res = await fetchWithTimeout(`${API_BASE}/api/v1/cameras/${cameraId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function deleteCamera(cameraId: string): Promise<void> {
  await fetchWithTimeout(`${API_BASE}/api/v1/cameras/${cameraId}`, { method: 'DELETE' });
}
