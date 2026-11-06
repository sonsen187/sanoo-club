@echo off
echo Starting Cloudflare Tunnel for DJ Club on port 3000...
echo (Link HTTPS se hien thi ben duoi)
if not exist ".\bin\cloudflared.exe" (
  echo Dang tu dong tai cloudflared.exe ve thu muc bin/...
  if not exist "bin" mkdir bin
  curl -L -o ".\bin\cloudflared.exe" https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe
)
.\bin\cloudflared.exe tunnel --url http://localhost:3000
pause
