import base64
import json
from datetime import datetime

import httpx

from app.core.config import settings

_PROMPT = (
    "Analyze this image and identify what you see. "
    "Reply ONLY with a valid JSON object - no markdown, no extra text.\n\n"
    "If you see a FRUIT or VEGETABLE return:\n"
    '{"type": "fruit", "name": "<name in Spanish e.g. Manzana Banana Tomate>", '
    '"freshness": "fresco" if fresh and good, "medio" if slightly bad, "malo" if rotten}\n\n'
    "If you see a PACKAGED PRODUCT return:\n"
    '{"type": "barcode_product", "name": "<product name>", "brand": "<brand or null>", '
    '"expiry_date": "<YYYY-MM-DD if visible or null>"}\n\n'
    'If nothing food-related: {"type": "unknown"}'
)


class OpenAIDetectionService:
    def analyze(self, image_bytes: bytes) -> dict:
        # Strip any non-ASCII characters that may have been introduced by copy-paste
        api_key = "".join(c for c in settings.openai_api_key if ord(c) < 128).strip()
        image_b64 = base64.b64encode(image_bytes).decode("ascii")

        payload = {
            "model": "gpt-4o-mini",
            "max_tokens": 300,
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": _PROMPT},
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": "data:image/jpeg;base64," + image_b64
                            },
                        },
                    ],
                }
            ],
        }

        response = httpx.post(
            "https://api.openai.com/v1/chat/completions",
            headers={
                "Authorization": "Bearer " + api_key,
                "Content-Type": "application/json",
            },
            json=payload,
            timeout=30.0,
        )
        response.raise_for_status()

        raw = response.json()["choices"][0]["message"]["content"].strip()

        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
            raw = raw.strip()

        result = json.loads(raw)
        result["scanned_at"] = datetime.now().isoformat()
        return result
