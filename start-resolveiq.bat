@echo off
title Launch ResolveIQ Helpdesk Platform
echo =========================================================
echo   ResolveIQ - Understand Faster. Resolve Smarter.
echo   Course: 21CSC705T Intelligent Systems Development
echo =========================================================
echo.
echo Starting Express Backend API (Port 5000)...
start "ResolveIQ Backend Server" cmd /k "cd server && npm run dev"

echo Waiting 2 seconds for backend to initialize...
timeout /t 2 /nobreak > nul

echo Starting React + Vite Frontend (Port 5173)...
start "ResolveIQ Frontend Client" cmd /k "cd client && npm run dev"

echo.
echo =========================================================
echo   Both services launched successfully!
echo   Frontend: http://localhost:5173
echo   Backend:  http://localhost:5000/api/health
echo =========================================================
echo.
pause
