@echo off
cd /d "%~dp0"

docker info >nul 2>&1
if errorlevel 1 (
    echo Docker Desktop no esta disponible.
    pause
    exit /b 1
)

docker compose up -d --build

if errorlevel 1 (
    echo Error al iniciar la plataforma.
    pause
    exit /b 1
)

start http://localhost:3000
pause
