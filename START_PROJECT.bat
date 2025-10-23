@echo off
echo ========================================
echo Rural Gold Connect - Starting Server
echo ========================================
echo.

cd backend

echo Checking MongoDB connection...
echo.

echo Starting backend server...
start cmd /k "npm run dev"

timeout /t 3 /nobreak >nul

cd ..
echo.
echo Starting frontend...
start cmd /k "npm run dev"

echo.
echo ========================================
echo Servers Starting...
echo ========================================
echo.
echo Backend: http://localhost:3000
echo Frontend: http://localhost:5173
echo.
echo Press any key to close this window...
pause >nul
