# Contexto del Proyecto: "Smart Pantry" / Refri Inteligente (Hackathon 48h)

## 1. Visión General y Objetivo del Proyecto
Estamos participando en una hackathon de 48 horas en el track de **AI & Automation**.
Nuestro objetivo es diseñar una solución impulsada por IA que automatice tareas, mejore los insights y transforme cómo las personas gestionan sus alimentos en casa.

**El Problema:** La gestión manual del inventario de alimentos en refrigeradores y alacenas es tediosa, lo que resulta en un alto índice de desperdicio de comida porque los usuarios olvidan las fechas de vencimiento.
**La Solución:** Una aplicación móvil que automatiza la entrada de inventario mediante visión computacional (fotos bajo demanda de la refri), estima fechas de vencimiento automáticamente usando IA, alerta sobre productos a punto de malograrse y genera "Recetas de Rescate" para consumir esos ingredientes.

## 2. Restricciones y Estrategia del Hackathon (Reglas de Oro)
- **Tiempo:** Es un sprint de 48 horas. Priorizamos la velocidad, la funcionalidad del "Happy Path" y una demo impecable.
- **Alcance Acotado:** NO procesamos video en tiempo real. Usamos "fotos bajo demanda" simulando que vienen de cámaras instaladas en la refri/alacena.
- **Simplicidad:** No entrenamos modelos propios. Dependemos de APIs robustas (Vision AI, LLMs) orquestadas eficientemente.

## 3. Stack Tecnológico
- **Frontend / Mobile:** React Native con Expo (Desarrollado en WebStorm).
- **Backend / Base de Datos:** Supabase (PostgreSQL). Usaremos llamadas directas desde la app o Edge Functions si es estrictamente necesario.
- **Inteligencia Artificial:**
    - *Vision API* (Google Cloud Vision o similar) para detección de objetos en las fotos.
    - *LLM Generativo* (Gemini, OpenAI o Claude) para (1) estimar fechas de caducidad basadas en el tipo de alimento reconocido y (2) generar las "Recetas de Rescate".
- **Storage:** Supabase Storage para alojar las fotos subidas.

## 4. Arquitectura de la Base de Datos (Supabase)
El esquema relacional base es el siguiente:
1. `profiles`: Usuarios de la app (vinculado a Supabase Auth).
2. `households`: Hogares (un usuario puede tener varios).
3. `storage_areas`: Espacios físicos (`refrigerado`, `alacena`, `congelado`).
4. `catalog_items`: Diccionario maestro de productos (con/sin código de barras) y su `duracion_estimada_dias`.
5. `inventory`: El inventario real en tiempo real. Cruza el `storage_area`, el `catalog_item`, la fecha de ingreso y la `fecha_vencimiento` calculada por la IA. Tiene un estado (`fresco`, `por_vencer`, `vencido`).
6. `history_logs`: Registro de acciones (`ENTRADA`, `SALIDA`, `DESCARTE`) para analítica de desperdicios.
7. `cameras`: Dispositivos de hardware simulados vinculados a los `storage_areas`.

## 5. Flujos Principales de Usuario (UX/UI)
- **Flujo de Ingreso (Input):** El usuario toma/sube una foto -> La IA detecta los alimentos -> La IA calcula el vencimiento estimado consultando/actualizando `catalog_items` -> Se inserta en `inventory`.
- **Flujo de Monitoreo (Dashboard):** La app muestra el inventario organizado por estado de frescura (verde, amarillo, rojo).
- **Flujo de "Rescue Recipe" (Output):** El sistema identifica alimentos con estado `por_vencer`. El usuario presiona un botón y un LLM devuelve una receta rápida que utiliza exactamente esos ingredientes para evitar que se boten.

## 6. Instrucciones para tu rol como Asistente IA
A partir de este momento, actuarás como un **Senior Fullstack Developer y Arquitecto Cloud**.
Cuando te pida código o ayuda, debes:
- Mantener en mente que el frontend es **React Native con Expo**.
- Asumir que el backend es **Supabase** (PostgreSQL).
- Escribir código limpio, modular y directo. Evitar sobreingeniería; estamos en una hackathon.
- Si sugieres librerías, asegúrate de que sean compatibles con Expo SDK 54 (sin requerir prebuilds complejos a menos que sea inevitable).
- Proveer siempre el código listo para copiar y pegar, indicando claramente en qué archivo debería ir.