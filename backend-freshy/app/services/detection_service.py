import base64

import httpx

from app.core.config import settings


class DetectionService:
    """
    Calls the Roboflow hosted inference API to detect fruits/vegetables in an image.
    Model: peng-majiz/fruit-b2sy0 v1
    """

    def __init__(self) -> None:
        self._url = f"{settings.roboflow_api_url}/{settings.roboflow_model_id}"
        self._api_key = settings.roboflow_api_key

    def detect(self, image_bytes: bytes, confidence: float = 0.4) -> dict:
        """
        Send image bytes to Roboflow and return parsed predictions.

        Returns:
            {
                "predictions": [{"class": "apple", "confidence": 0.92, "x": ..., "y": ..., "width": ..., "height": ...}],
                "detected_items": ["apple", "banana"]   # unique, deduplicated
            }
        """
        image_b64 = base64.b64encode(image_bytes).decode("utf-8")

        response = httpx.post(
            self._url,
            params={"api_key": self._api_key, "confidence": confidence},
            content=image_b64,
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            timeout=30.0,
        )
        response.raise_for_status()
        data = response.json()

        VALID_CLASSES = {"apple", "kiwi", "orange", "pear", "strawberry", "tomato"}

        predictions = [
            p for p in data.get("predictions", [])
            if p.get("class", "").lower() in VALID_CLASSES
        ]
        detected_items = list({p["class"] for p in predictions})

        return {
            "predictions": [
                {
                    "class": p["class"],
                    "confidence": round(p["confidence"], 3),
                    "x": p["x"],
                    "y": p["y"],
                    "width": p["width"],
                    "height": p["height"],
                }
                for p in predictions
            ],
            "detected_items": detected_items,
        }
