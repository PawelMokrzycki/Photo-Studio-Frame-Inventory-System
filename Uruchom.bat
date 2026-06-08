@echo off
title Pan Fotograf - Ramki
cd /d "%~dp0"
"node_modules\electron\dist\electron.exe" . --no-sandbox
