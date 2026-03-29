@echo off
echo Instalando dependencias...
pip install opencv-python openai numpy --quiet
echo.
echo Iniciando Freshy Space Monitor...
echo.
python "%~dp0space_monitor_test.py"
pause
