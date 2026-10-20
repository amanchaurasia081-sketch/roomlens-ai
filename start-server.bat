@echo off
title RoomLens AI Web Server
echo ========================================================
echo        ROOMLENS AI - ROOM OBJECT FINDER & SCANNER
echo ========================================================
echo.
echo Starting local web server at http://localhost:8080...
echo.
start http://localhost:8080
jwebserver -p 8080 -d .
pause

