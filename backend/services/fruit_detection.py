import base64
import httpx
import os
from dotenv import load_dotenv

load_dotenv()

ROBOFLOW_API_KEY = os.getenv("ROBOFLOW_API_KEY")
MODEL_ID = "fruit-b2sy0"
MODEL_VERSION = 1
INFERENCE_URL = f"https://detect.roboflow.com/{MODEL_ID}/{MODEL_VERSION}"


async def detect_fruits(image_bytes: bytes) -> dict:
    """
    Sends an image to the Roboflow fruit detection model.
    Returns the raw predictions from the model.

    Model: peng-majiz/fruit-b2sy0
    Detects fruits and their state (fresh / ripe / rotten).
    """
    image_b64 = base64.b64encode(image_bytes).decode("utf-8")

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            INFERENCE_URL,
            params={"api_key": ROBOFLOW_API_KEY},
            content=image_b64,
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
        response.raise_for_status()
        return response.json()


def parse_predictions(raw: dict) -> list[dict]:
    """
    Normalizes the Roboflow response into a list of detections.

    Each detection:
        {
            "label": str,        # class name (e.g. "apple_fresh")
            "confidence": float, # 0–1
            "x": float,          # center x (pixels)
            "y": float,          # center y (pixels)
            "width": float,
            "height": float,
        }
    """
    return [
        {
            "label": p["class"],
            "confidence": round(p["confidence"], 4),
            "x": p["x"],
            "y": p["y"],
            "width": p["width"],
            "height": p["height"],
        }
        for p in raw.get("predictions", [])
    ]
