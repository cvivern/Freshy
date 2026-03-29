import base64
import json
from datetime import datetime

import httpx

from app.core.config import settings

_PROMPT = (
    "Analyze this image with high precision. "
    "Reply ONLY with a valid JSON object - no markdown, no extra text, no explanations.\n\n"
    
    "STRICT RULE FOR PACKAGED PRODUCTS:\n"
    "For every attribute (name, brand, expiry_date), you must be at least 95% certain based "
    "EXPLICITLY on the visual evidence in the image. If you are not 95% sure or the text is "
    "blurry/missing, you MUST return null for that specific field. Do not hallucinate or infer.\n\n"
    
    "CASE 1: FRUIT or VEGETABLE\n"
    '{"type": "fruit", "name": "<name in Spanish>", "freshness": "<fresco|medio|malo>", "emoji": "<single emoji that represents this item>"}\n\n'
    
    "CASE 2: PACKAGED PRODUCT\n"
    '{"type": "barcode_product", "name": "<product name or null>", "brand": "<brand or null>", '
    '"expiry_date": "<YYYY-MM-DD or null>"}\n\n'
    
    "CASE 3: NOTHING FOOD-RELATED\n"
    '{"type": "unknown"}'
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
