"""
Freshy - Space Monitor Tester
==============================
Abre la cámara de la computadora y detecta:
  1. Movimiento (frame differencing)
  2. Qué producto entró o salió (GPT-4o vision)

Controles:
  Q  → salir
  R  → resetear frame de referencia manualmente
  S  → forzar análisis ahora (captura antes/después manual)

Flujo automático:
  - Guarda el frame justo ANTES de que empiece el movimiento
  - Espera a que el movimiento se detenga
  - Captura el frame DESPUÉS
  - Manda ambos a GPT-4o y muestra qué cambió
"""

import cv2
import base64
import json
import time
import threading
import collections
import numpy as np
from openai import OpenAI
from datetime import datetime

# ── Configuración ──────────────────────────────────────────────────────────────
OPENAI_API_KEY = "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"

# URL del backend
BACKEND_URL = "https://backend-freshy.vercel.app"

# Usuario activo (el mismo que está logueado en la app)
MONITOR_USER_ID = "00000000-0000-0000-0000-000000000101"  # cambiar por el user_id real

# Se auto-completa al inicio consultando la cámara activa del usuario
STORAGE_AREA_ID = ""


def fetch_active_camera_area() -> str:
    """Fetches the storage_area_id of the active camera for MONITOR_USER_ID."""
    import urllib.request
    url = f"{BACKEND_URL}/api/v1/cameras/active?user_id={MONITOR_USER_ID}"
    try:
        req = urllib.request.Request(url, headers={"Accept": "application/json"})
        with urllib.request.urlopen(req, timeout=5) as r:
            data = json.loads(r.read().decode())
            area_id = data.get("storage_area_id", "")
            area_name = data.get("storage_areas", {}).get("name", "?") if data.get("storage_areas") else "?"
            cam_name  = data.get("name", "?")
            print(f"📷  Cámara activa: {cam_name}  →  área: {area_name}  ({area_id})")
            return area_id
    except Exception as e:
        print(f"⚠️  No se pudo obtener la cámara activa: {e}")
        print("   Configurá una cámara en la app → Perfil → Cámaras")
        return ""

MOTION_THRESHOLD   = 1500   # píxeles en movimiento para disparar detección
MOTION_COOLDOWN    = 2.0    # segundos de quietud antes de capturar "después"
BUFFER_SECONDS     = 1.5    # cuántos segundos de frames guardar (para el "antes")
CAMERA_INDEX       = 0      # 0 = cámara principal
# ───────────────────────────────────────────────────────────────────────────────

client = OpenAI(api_key=OPENAI_API_KEY)


def frame_to_b64(frame: np.ndarray, quality: int = 60) -> str:
    """Convierte un frame OpenCV a base64 JPEG."""
    _, buf = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, quality])
    return base64.b64encode(buf).decode("utf-8")


def fetch_inventory(storage_area_id: str) -> list[dict]:
    """Obtiene el inventario actual del área desde Supabase."""
    import urllib.request, urllib.error
    url = f"{BACKEND_URL}/api/v1/inventory/?storage_area_id={storage_area_id}"
    try:
        req = urllib.request.Request(url, headers={"Accept": "application/json"})
        with urllib.request.urlopen(req, timeout=5) as r:
            return json.loads(r.read().decode())
    except Exception:
        return []


def build_product_list(items: list[dict]) -> str:
    if not items:
        return "(No hay productos registrados en este espacio todavía.)"
    lines = []
    for p in items:
        emoji = p.get("emoji") or p.get("producto_emoji") or "📦"
        name  = p.get("name") or p.get("nombre") or "?"
        brand = p.get("brand") or ""
        qty   = p.get("quantity") or p.get("cantidad") or "?"
        pid   = p.get("id", "")
        line  = f"  - id={pid} | {emoji} {name}"
        if brand:
            line += f" — {brand}"
        line += f" (stock: {qty})"
        lines.append(line)
    return "\n".join(lines)


def analyze_with_gpt4v(frame_before: np.ndarray, frame_after: np.ndarray,
                        storage_area_id: str = "") -> dict:
    """Manda dos frames a GPT-4o (con lista de inventario) y devuelve qué producto entró/salió."""
    b64_before = frame_to_b64(frame_before)
    b64_after  = frame_to_b64(frame_after)

    # Traer inventario actual para que GPT-4o matchee con productos reales
    known = fetch_inventory(storage_area_id) if storage_area_id else []
    product_section = ""
    if known:
        product_section = f"""
INVENTARIO ACTUAL DE ESTE ESPACIO (intentá matchear con uno de estos):
{build_product_list(known)}

Si identificás el producto en las imágenes, devolvé su id exacto en "inventory_item_id".
Si no coincide con ninguno, devolvé null.
"""

    prompt = f"""Sos un sistema de detección de inventario doméstico.
Compará estas dos imágenes tomadas con una cámara fija.

Imagen 1: ANTES del movimiento
Imagen 2: DESPUÉS del movimiento
{product_section}
Detectá si algún producto u objeto:
- Fue RETIRADO (está en imagen 1 pero NO en imagen 2) → accion = "salida"
- Fue AGREGADO  (NO está en imagen 1 pero SÍ en imagen 2) → accion = "entrada"
- No cambió nada relevante → accion = "ninguno"

Respondé SOLO con JSON válido, sin markdown ni texto extra:
{{
  "accion": "salida" | "entrada" | "ninguno",
  "inventory_item_id": "<id de la lista o null>",
  "producto_nombre": "nombre exacto (de la lista si matchea, sino tu descripción)",
  "producto_emoji": "emoji representativo",
  "cantidad": 1,
  "confianza": 0.0,
  "descripcion": "descripción breve de lo que cambió"
}}"""

    try:
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[{
                "role": "user",
                "content": [
                    {"type": "text", "text": prompt},
                    {"type": "image_url", "image_url": {
                        "url": f"data:image/jpeg;base64,{b64_before}", "detail": "low"}},
                    {"type": "image_url", "image_url": {
                        "url": f"data:image/jpeg;base64,{b64_after}",  "detail": "low"}},
                ],
            }],
            max_tokens=350,
        )
        raw = response.choices[0].message.content.strip()
        if raw.startswith("```"):
            raw = "\n".join(raw.split("\n")[1:])
            if raw.endswith("```"):
                raw = raw[:-3]
        return json.loads(raw)
    except Exception as e:
        return {"accion": "error", "descripcion": str(e),
                "producto_nombre": "?", "producto_emoji": "❓", "confianza": 0.0}


def draw_overlay(frame: np.ndarray, state: dict) -> np.ndarray:
    """Dibuja el estado actual sobre el frame."""
    overlay = frame.copy()
    h, w = frame.shape[:2]

    # ── Barra de estado (arriba) ──
    bar_color = {
        "waiting":   (40, 40, 40),
        "motion":    (0, 140, 255),
        "cooldown":  (0, 200, 200),
        "analyzing": (180, 80, 0),
        "result":    (30, 140, 30),
        "error":     (0, 0, 200),
    }.get(state["status"], (40, 40, 40))

    cv2.rectangle(overlay, (0, 0), (w, 52), bar_color, -1)

    status_text = {
        "waiting":   "⏳  Esperando movimiento...",
        "motion":    "🟠  Movimiento detectado!",
        "cooldown":  "⏱   Esperando que se detenga...",
        "analyzing": "🤖  Analizando con GPT-4o...",
        "result":    "✅  Resultado listo",
        "error":     "❌  Error en análisis",
    }.get(state["status"], "")

    cv2.putText(overlay, status_text, (12, 34),
                cv2.FONT_HERSHEY_SIMPLEX, 0.75, (255, 255, 255), 2)

    # ── Indicador de movimiento (barra lateral) ──
    motion_pct = min(state.get("motion_pixels", 0) / (MOTION_THRESHOLD * 3), 1.0)
    bar_h = int((h - 60) * motion_pct)
    cv2.rectangle(overlay, (w - 20, h - bar_h - 4), (w - 4, h - 4),
                  (0, 200, 255) if motion_pct < 0.5 else (0, 80, 255), -1)
    cv2.rectangle(overlay, (w - 20, 56), (w - 4, h - 4), (80, 80, 80), 1)

    # ── Resultado del último análisis (abajo) ──
    if state.get("last_result"):
        r = state["last_result"]
        accion = r.get("accion", "ninguno")
        if accion != "ninguno":
            res_color = (30, 30, 180) if accion == "salida" else (30, 140, 30)
            cv2.rectangle(overlay, (0, h - 90), (w, h), res_color, -1)

            nombre = r.get("producto_nombre", "?")
            emoji  = r.get("producto_emoji", "")
            conf   = int(r.get("confianza", 0) * 100)
            accion_str = "SALIÓ  📤" if accion == "salida" else "ENTRÓ  📥"

            cv2.putText(overlay, f"{accion_str}  {nombre}",
                        (12, h - 58), cv2.FONT_HERSHEY_SIMPLEX, 0.72, (255, 255, 255), 2)
            cv2.putText(overlay, r.get("descripcion", "")[:60],
                        (12, h - 32), cv2.FONT_HERSHEY_SIMPLEX, 0.52, (200, 200, 200), 1)
            cv2.putText(overlay, f"Confianza: {conf}%",
                        (12, h - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.48, (180, 180, 180), 1)

    # ── Controles (esquina inferior derecha) ──
    cv2.putText(overlay, "Q=salir  R=reset  S=forzar analisis",
                (w - 310, h - 6), cv2.FONT_HERSHEY_SIMPLEX, 0.42, (160, 160, 160), 1)

    # ── Timestamp ──
    cv2.putText(overlay, datetime.now().strftime("%H:%M:%S"),
                (8, h - 96 if state.get("last_result") else h - 8),
                cv2.FONT_HERSHEY_SIMPLEX, 0.42, (140, 140, 140), 1)

    return cv2.addWeighted(overlay, 0.85, frame, 0.15, 0)


def main():
    global STORAGE_AREA_ID
    STORAGE_AREA_ID = fetch_active_camera_area()

    cap = cv2.VideoCapture(CAMERA_INDEX)
    if not cap.isOpened():
        print("❌  No se pudo abrir la cámara. Probá cambiando CAMERA_INDEX.")
        return

    cap.set(cv2.CAP_PROP_FRAME_WIDTH,  640)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)

    fps     = cap.get(cv2.CAP_PROP_FPS) or 25
    buf_len = int(fps * BUFFER_SECONDS)
    frame_buffer: collections.deque = collections.deque(maxlen=buf_len)

    state = {
        "status":       "waiting",
        "motion_pixels": 0,
        "last_result":  None,
    }

    # Estado interno de la máquina de estados
    sm = {
        "in_motion":       False,
        "last_motion_t":   0.0,
        "frame_before":    None,
        "analyzing":       False,
        "manual_before":   None,
    }

    bg_subtractor = cv2.createBackgroundSubtractorMOG2(
        history=200, varThreshold=50, detectShadows=False
    )

    print("✅  Cámara abierta. Apuntala a una heladera, alacena, mesa...")
    print("   Mové un producto para disparar el análisis automático.")
    print("   Q=salir | R=resetear fondo | S=captura manual antes/después")

    def run_analysis(before, after, area_id=""):
        state["status"] = "analyzing"
        result = analyze_with_gpt4v(before, after, area_id)
        state["last_result"] = result
        state["status"] = "result"
        sm["analyzing"] = False

        accion = result.get("accion", "ninguno")
        nombre = result.get("producto_nombre", "?")
        emoji  = result.get("producto_emoji", "")
        conf   = int(result.get("confianza", 0) * 100)
        desc   = result.get("descripcion", "")

        if accion == "ninguno":
            print(f"\n🔍  [{datetime.now().strftime('%H:%M:%S')}] Sin cambios relevantes.")
        else:
            arrow = "📤 SALIÓ" if accion == "salida" else "📥 ENTRÓ"
            item_id = result.get("inventory_item_id")
            match_str = f"  ✅ match en DB: {item_id}" if item_id else "  ⚠️  sin match en DB"
            print(f"\n{arrow}  {emoji} {nombre}  (confianza {conf}%){match_str}")
            print(f"   → {desc}")

    while True:
        ret, frame = cap.read()
        if not ret:
            print("❌  No se pudo leer frame.")
            break

        frame_buffer.append(frame.copy())

        # ── Detección de movimiento ──
        fg_mask = bg_subtractor.apply(frame)
        kernel  = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
        fg_mask = cv2.morphologyEx(fg_mask, cv2.MORPH_OPEN,  kernel)
        fg_mask = cv2.morphologyEx(fg_mask, cv2.MORPH_CLOSE, kernel)
        motion_px = int(cv2.countNonZero(fg_mask))
        state["motion_pixels"] = motion_px

        has_motion = motion_px > MOTION_THRESHOLD

        if has_motion:
            sm["last_motion_t"] = time.time()
            if not sm["in_motion"] and not sm["analyzing"]:
                # Guardar frame "antes" (el frame más viejo del buffer)
                sm["frame_before"] = frame_buffer[0].copy()
                sm["in_motion"] = True
                state["status"] = "motion"
        else:
            if sm["in_motion"] and not sm["analyzing"]:
                elapsed = time.time() - sm["last_motion_t"]
                state["status"] = "cooldown"
                if elapsed >= MOTION_COOLDOWN:
                    # Movimiento terminó → analizar
                    sm["in_motion"]  = False
                    sm["analyzing"]  = True
                    before = sm["frame_before"]
                    after  = frame.copy()
                    t = threading.Thread(target=run_analysis, args=(before, after, STORAGE_AREA_ID), daemon=True)
                    t.start()
            elif not sm["in_motion"] and not sm["analyzing"]:
                state["status"] = "waiting"

        # ── Dibujar visualización de movimiento ──
        contours, _ = cv2.findContours(fg_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        for cnt in contours:
            if cv2.contourArea(cnt) > 500:
                x, y, cw, ch = cv2.boundingRect(cnt)
                cv2.rectangle(frame, (x, y), (x + cw, y + ch), (0, 200, 255), 2)

        # ── Overlay ──
        display = draw_overlay(frame, state)
        cv2.imshow("Freshy - Space Monitor Test", display)

        # ── Teclado ──
        key = cv2.waitKey(1) & 0xFF
        if key == ord('q'):
            break
        elif key == ord('r'):
            bg_subtractor = cv2.createBackgroundSubtractorMOG2(
                history=200, varThreshold=50, detectShadows=False)
            state["last_result"] = None
            state["status"] = "waiting"
            print("🔄  Fondo reseteado.")
        elif key == ord('s'):
            if sm["manual_before"] is None:
                sm["manual_before"] = frame.copy()
                print("📸  Frame 'antes' capturado. Realizá el movimiento y presioná S de nuevo.")
            else:
                if not sm["analyzing"]:
                    sm["analyzing"] = True
                    before = sm["manual_before"]
                    after  = frame.copy()
                    sm["manual_before"] = None
                    t = threading.Thread(target=run_analysis, args=(before, after, STORAGE_AREA_ID), daemon=True)
                    t.start()

    cap.release()
    cv2.destroyAllWindows()
    print("\n👋  Cerrando monitor.")


if __name__ == "__main__":
    main()
