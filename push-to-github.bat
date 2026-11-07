@echo off
title Push ResolveIQ to Private GitHub Repository
echo =========================================================
echo   Pushing ResolveIQ to GitHub (Mohammed-Numair/ResolveIQ)
echo =========================================================
echo.
git push -u origin main
echo.
if %ERRORLEVEL% EQU 0 (
  echo =========================================================
  echo   SUCCESS: Project successfully uploaded to GitHub!
  echo   Repository: https://github.com/Mohammed-Numair/ResolveIQ
  echo =========================================================
) else (
  echo =========================================================
  echo   Authentication failed or cancelled.
  echo   Please check your GitHub credentials and try again.
  echo =========================================================
)
echo.
pause
