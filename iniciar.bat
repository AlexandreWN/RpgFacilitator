@echo off
setlocal
cd /d "%~dp0"
title RPG Facilitator

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo  Node.js nao encontrado.
  echo  Instale em https://nodejs.org e abra este arquivo de novo.
  echo.
  pause
  exit /b 1
)

if not exist "node_modules\" (
  echo.
  echo  Primeira vez aqui: instalando as dependencias.
  echo  Isso pode levar alguns minutos.
  echo.
  call npm install
  if errorlevel 1 (
    echo.
    echo  Nao foi possivel instalar as dependencias.
    pause
    exit /b 1
  )
)

set RPG_ABRIR=1
echo.
echo  Abrindo o RPG Facilitator no navegador...
echo  Deixe esta janela aberta enquanto estiver usando o app.
echo  Para desligar, feche esta janela ou aperte Ctrl+C.
echo.
call npm start

echo.
echo  O app foi encerrado.
pause
