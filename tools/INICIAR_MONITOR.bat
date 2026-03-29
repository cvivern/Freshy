@echo off
title Freshy - Space Monitor
echo ============================================
echo   Freshy Space Monitor
echo   Abre la camara de tu PC y detecta cuando
echo   saca o pone productos en la heladera/alacena
echo ============================================
echo.

:: Verificar Python
python --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Python no esta instalado.
    echo Descargalo de https://python.org
    pause
    exit /b 1
)

echo Instalando dependencias...
pip install opencv-python openai numpy --quiet
if errorlevel 1 (
    echo ERROR al instalar dependencias. Revisa tu conexion a internet.
    pause
    exit /b 1
)

echo.
echo Iniciando monitor...
echo.
python "%~dp0space_monitor_test.py"

echo.
echo El monitor se cerro.
pause
