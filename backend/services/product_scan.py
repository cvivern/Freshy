import base64
import httpx
import json
import os
from dotenv import load_dotenv

load_dotenv()

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

PRODUCT_PROMPT = """Analyze this product image and extract the following fields.
Return ONLY valid JSON, no markdown, no extra text.

{
  "brand": "<brand name or null>",
  "name": "<product name or null>",
  "barcode": "<barcode/EAN number if visible or null>",
  "expiry_date": "<expiry date in DD/MM/YYYY format if visible or null>"
}"""

BARCODE_PROMPT = """Look at this image and extract:
- The barcode or EAN number (digits under the barcode or QR)
- The expiry / best-before date (vencimiento / fecha)

Return ONLY valid JSON, no markdown, no extra text.

{
  "barcode": "<digits or null>",
  "expiry_date": "<DD/MM/YYYY or null>"
}"""


async def scan_product_image(image_bytes: bytes) -> dict:
    """
    Sends an image to GPT-4o-mini vision and extracts brand, name, barcode, expiry_date.
    """
    image_b64 = base64.b64encode(image_bytes).decode("utf-8")

    payload = {
        "model": "gpt-4o-mini",
        "messages": [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": PRODUCT_PROMPT},
                    {
                        "type": "image_url",
                        "image_url": {"url": f"data:image/jpeg;base64,{image_b64}"},
                    },
                ],
            }
        ],
        "max_tokens": 200,
    }

    return await _call_openai(payload)


async def scan_barcode_image(image_bytes: bytes) -> dict:
    """
    Sends an image to GPT-4o-mini vision and extracts barcode + expiry_date.
    """
    image_b64 = base64.b64encode(image_bytes).decode("utf-8")

    payload = {
        "model": "gpt-4o-mini",
        "messages": [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": BARCODE_PROMPT},
                    {
                        "type": "image_url",
                        "image_url": {"url": f"data:image/jpeg;base64,{image_b64}"},
                    },
                ],
            }
        ],
        "max_tokens": 100,
    }

    return await _call_openai(payload)


async def _call_openai(payload: dict) -> dict:
    headers = {
        "Authorization": f"Bearer {OPENAI_API_KEY}",
        "Content-Type": "application/json",
    }
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            "https://api.openai.com/v1/chat/completions",
            headers=headers,
            json=payload,
        )
        response.raise_for_status()

    content = response.json()["choices"][0]["message"]["content"].strip()
    # Strip markdown code blocks if the model adds them despite the prompt
    if content.startswith("```"):
        content = content.split("```")[1]
        if content.startswith("json"):
            content = content[4:]
    return json.loads(content)
