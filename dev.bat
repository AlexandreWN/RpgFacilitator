@echo off
setlocal
cd /d "%~dp0"
title RPG Facilitator (desenvolvimento)

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo  Node.js nao encontrado. Instale em https://nodejs.org
  echo.
  pause
  exit /b 1
)

if not exist "node_modules\" (
  echo  Instalando as dependencias...
  call npm install
  if errorlevel 1 (
    echo  Nao foi possivel instalar as dependencias.
    pause
    exit /b 1
  )
)

echo.
echo  Modo desenvolvimento: as mudancas no codigo recarregam sozinhas.
echo  O navegador abre em http://localhost:5173
echo.
start "" cmd /c "timeout /t 5 >nul & start "" http://localhost:5173"
call npm run dev

echo.
echo  O app foi encerrado.
pause
