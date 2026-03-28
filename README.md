# Freshy
Hackitba project


how to run the front end:
1. Install dependencies: `npm install`
2. Start the server: `npx expo start`
3. Follow the instructions in the terminal to run the app on an emulator or physical device.

how to run the back end:
```
cd backend-freshy

# 1. Crear y activar virtualenv
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate

# 2. Instalar dependencias
pip install -r requirements.txt

# 3. Configurar variables de entorno
cp .env.example .env
# → Editar .env con tu SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY

# 4. Correr servidor
uvicorn app.main:app --reload
```