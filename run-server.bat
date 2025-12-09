@echo off
title Global Chat Server
color 0A
cls

echo.
echo ╔════════════════════════════════════════════════════════════════╗
echo ║                    GLOBAL CHAT SERVER                          ║
echo ║              Real-time Translation Chat Application             ║
echo ╚════════════════════════════════════════════════════════════════╝
echo.
echo [*] Checking Node.js installation...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed or not in PATH
    echo [INFO] Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

echo [OK] Node.js found: 
node --version

echo.
echo [*] Checking if dependencies are installed...
if not exist "node_modules" (
    echo [*] Installing npm dependencies...
    call npm install
    if %errorlevel% neq 0 (
        echo [ERROR] Failed to install dependencies
        pause
        exit /b 1
    )
    echo [OK] Dependencies installed successfully
) else (
    echo [OK] Dependencies already installed
)

echo.
echo [*] Starting chat server...
echo.
echo ═════════════════════════════════════════════════════════════════
echo.
echo 🚀 Server starting on http://localhost:3000
echo 📱 Open your browser and navigate to: http://localhost:3000
echo 🌐 Multiple users can join simultaneously
echo 🔤 Messages auto-translate to 8 languages
echo 📝 Username and settings saved in browser
echo.
echo Press Ctrl+C to stop the server
echo.
echo ═════════════════════════════════════════════════════════════════
echo.

npm start

if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Server failed to start
    echo [INFO] Check if port 3000 is already in use
    echo.
    pause
    exit /b 1
)
