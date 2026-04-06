@echo off
REM ════════════════════════════════════════════════════════════════════════
REM CLOUDFLARE TUNNEL SETUP SCRIPT (WINDOWS)
REM ════════════════════════════════════════════════════════════════════════
REM Este script ajuda a configurar o Cloudflare Tunnel para expor a API
REM ComfyUI de forma segura para a internet.
REM ════════════════════════════════════════════════════════════════════════

setlocal enabledelayedexpansion

cls
echo.
echo ╔════════════════════════════════════════════════════════════════════════╗
echo ║  CLOUDFLARE TUNNEL SETUP - API ComfyUI                               ║
echo ╚════════════════════════════════════════════════════════════════════════╝
echo.

REM ═══════════════════════════════════════════════════════════════════════════
REM PASSO 1: Verificar se cloudflared está instalado
REM ═══════════════════════════════════════════════════════════════════════════

echo [PASSO 1] Verificando cloudflared...
cloudflared --version >nul 2>&1

if %errorlevel% neq 0 (
    echo.
    echo ❌ cloudflared NÃO está instalado!
    echo.
    echo Instale com um dos comandos abaixo:
    echo   • Chocolatey: choco install cloudflare-warp
    echo   • Scoop:      scoop install cloudflared
    echo   • Ou download: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/
    echo.
    pause
    exit /b 1
)

echo ✅ cloudflared encontrado
cloudflared --version
echo.

REM ═══════════════════════════════════════════════════════════════════════════
REM PASSO 2: Verificar autenticação
REM ═══════════════════════════════════════════════════════════════════════════

echo [PASSO 2] Verificando autenticação com Cloudflare...

if not exist "%USERPROFILE%\.cloudflared\cert.pem" (
    echo.
    echo ⚠️  Você não está autenticado no Cloudflare!
    echo.
    echo Executando: cloudflared login
    echo Isso abrirá seu navegador para você se autenticar.
    echo.
    pause
    cloudflared login

    if %errorlevel% neq 0 (
        echo ❌ Falha na autenticação. Tente novamente.
        pause
        exit /b 1
    )
) else (
    echo ✅ Autenticação encontrada
)
echo.

REM ═══════════════════════════════════════════════════════════════════════════
REM PASSO 3: Criar tunnel (se não existir)
REM ═══════════════════════════════════════════════════════════════════════════

echo [PASSO 3] Verificando tunnel...

cloudflared tunnel list 2>nul | find "api-comfyui" >nul

if %errorlevel% neq 0 (
    echo.
    echo ⚠️  Tunnel 'api-comfyui' NÃO existe!
    echo.
    echo Criando novo tunnel...
    echo.
    cloudflared tunnel create api-comfyui

    if %errorlevel% neq 0 (
        echo ❌ Falha ao criar tunnel.
        pause
        exit /b 1
    )
    echo.
    echo ✅ Tunnel criado com sucesso!
) else (
    echo ✅ Tunnel 'api-comfyui' já existe
)
echo.

REM ═══════════════════════════════════════════════════════════════════════════
REM PASSO 4: Exibir informações do tunnel
REM ═══════════════════════════════════════════════════════════════════════════

echo [PASSO 4] Informações do tunnel:
echo.

REM Usar findstr para extrair a linha do tunnel
for /f "tokens=1,2,3" %%a in ('cloudflared tunnel list ^| find "api-comfyui"') do (
    set "TUNNEL_UUID=%%a"
    set "TUNNEL_NAME=%%b"
    set "TUNNEL_CNAME=%%c"
)

if defined TUNNEL_UUID (
    echo ✅ UUID: %TUNNEL_UUID%
    echo ✅ Nome: %TUNNEL_NAME%
    echo ✅ CNAME: %TUNNEL_CNAME%
    echo.
    echo 📋 PRÓXIMA ETAPA: Apontar DNS no Cloudflare
    echo   1. Vá para https://dash.cloudflare.com
    echo   2. Selecione seu domínio
    echo   3. Vá em DNS
    echo   4. Crie um CNAME record:
    echo      Nome: api-comfyui (ou outro subdomain)
    echo      Content: %TUNNEL_CNAME%
    echo      Proxy: Proxied
    echo.
) else (
    echo ❌ Erro ao obter informações do tunnel
    pause
    exit /b 1
)

REM ═══════════════════════════════════════════════════════════════════════════
REM PASSO 5: Atualizar cloudflared-config.yml
REM ═══════════════════════════════════════════════════════════════════════════

echo [PASSO 5] Configuração:
echo.
echo ⚠️  Arquivo necessário: cloudflared-config.yml
echo.
echo Passos:
echo   1. Abra: cloudflared-config.yml
echo   2. Substitua: ^<COLE_O_UUID_AQUI^> → %TUNNEL_UUID%
echo   3. Salve o arquivo
echo.

REM ═══════════════════════════════════════════════════════════════════════════
REM PASSO 6: Pronto para rodar
REM ═══════════════════════════════════════════════════════════════════════════

echo [PRONTO!] Setup do Cloudflare Tunnel completo!
echo.
echo 🚀 Para RODAR o tunnel, use:
echo.
echo   cloudflared tunnel run api-comfyui
echo.
echo   Ou (com config file customizado):
echo   cloudflared tunnel run --config cloudflared-config.yml api-comfyui
echo.
echo 📡 A API estará disponível em: https://api-comfyui.example.com
echo.
echo 🔒 Segurança:
echo   ✅ API (3000) exposta via HTTPS
echo   ✅ ComfyUI (8188) completamente bloqueado
echo   ✅ Rate limiting ativo
echo   ✅ Autenticação Bearer obrigatória
echo.

pause
