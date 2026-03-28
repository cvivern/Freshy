import base64
import json
from datetime import datetime

from google import genai

from app.core.config import settings

_PROMPT = """
Analyze this image and identify what you see. Reply ONLY with a valid JSON object — no markdown, no extra text.

If you see a FRUIT or VEGETABLE:
{
  "type": "fruit" or "vegetable",
  "name": "<name in Spanish, e.g. Manzana, Banana, Tomate>",
  "freshness": "fresco" if it looks fresh and in good condition,
               "medio" if it shows some browning, spots, or slight deterioration,
               "malo" if it is clearly rotten, moldy, or very deteriorated
}

If you see a PACKAGED PRODUCT (with or without a visible barcode):
{
  "type": "barcode_product",
  "name": "<product name>",
  "brand": "<brand name, or null if not visible>",
  "expiry_date": "<YYYY-MM-DD if visible on the packaging, otherwise null>"
}

If you cannot identify anything food-related:
{
  "type": "unknown"
}
"""


class GeminiDetectionService:
    def __init__(self) -> None:
        self._client = genai.Client(api_key=settings.gemini_api_key)

    def analyze(self, image_bytes: bytes) -> dict:
        """
        Send image to Gemini and return structured detection result.

        Returns one of:
          {"type": "fruit"|"vegetable", "name": str, "freshness": "fresco"|"medio"|"malo", "scanned_at": str}
          {"type": "barcode_product", "name": str, "brand": str|None, "expiry_date": str|None, "scanned_at": str}
          {"type": "unknown", "scanned_at": str}
        """
        from google.genai import types as genai_types
        image_part = genai_types.Part.from_bytes(data=image_bytes, mime_type="image/jpeg")

        response = self._client.models.generate_content(
            model="gemini-2.0-flash-lite",
            contents=[_PROMPT, image_part],
        )
        raw = response.text.strip()

        # Strip markdown code fences if Gemini adds them anyway
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
            raw = raw.strip()

        result = json.loads(raw)
        result["scanned_at"] = datetime.now().isoformat()
        return result
