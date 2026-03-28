// Change this to your computer's local IP when testing on a physical device
// e.g. 'http://192.168.1.100:8000'
const API_BASE = 'http://localhost:8000/api/v1';

export type DetectionResult = {
  predictions: { class: string; confidence: number }[];
  detected_items: string[];
};

export type AddItemsPayload = {
  storage_area_id: string;
  items: { name: string; quantity: number; unit: string }[];
};

export async function detectFruits(imageUri: string): Promise<DetectionResult> {
  const formData = new FormData();
  formData.append('file', {
    uri: imageUri,
    name: 'photo.jpg',
    type: 'image/jpeg',
  } as any);

  const response = await fetch(`${API_BASE}/detection/identify`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail ?? `Error ${response.status}`);
  }

  return response.json();
}

export async function addToInventory(payload: AddItemsPayload): Promise<void> {
  const response = await fetch(`${API_BASE}/inventory/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail ?? `Error ${response.status}`);
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
