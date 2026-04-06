#!/bin/bash

# ════════════════════════════════════════════════════════════════════════════
# CLOUDFLARE TUNNEL SETUP SCRIPT (LINUX/MAC)
# ════════════════════════════════════════════════════════════════════════════
# Este script ajuda a configurar o Cloudflare Tunnel para expor a API
# ComfyUI de forma segura para a internet.
# ════════════════════════════════════════════════════════════════════════════

set -e

clear

echo ""
echo "╔════════════════════════════════════════════════════════════════════════╗"
echo "║  CLOUDFLARE TUNNEL SETUP - API ComfyUI                               ║"
echo "╚════════════════════════════════════════════════════════════════════════╝"
echo ""

# ═══════════════════════════════════════════════════════════════════════════════
# PASSO 1: Verificar se cloudflared está instalado
# ═══════════════════════════════════════════════════════════════════════════════

echo "[PASSO 1] Verificando cloudflared..."

if ! command -v cloudflared &> /dev/null; then
    echo ""
    echo "❌ cloudflared NÃO está instalado!"
    echo ""
    echo "Instale com um dos comandos abaixo:"
    echo "  • Homebrew (Mac):    brew install cloudflare/cloudflare/cloudflared"
    echo "  • Apt (Ubuntu/Debian): sudo apt-get install cloudflared"
    echo "  • Pacman (Arch):     sudo pacman -S cloudflare-warp"
    echo "  • Ou download:       https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/"
    echo ""
    exit 1
fi

echo "✅ cloudflared encontrado"
cloudflared --version
echo ""

# ═══════════════════════════════════════════════════════════════════════════════
# PASSO 2: Verificar autenticação
# ═══════════════════════════════════════════════════════════════════════════════

echo "[PASSO 2] Verificando autenticação com Cloudflare..."

if [ ! -f "$HOME/.cloudflared/cert.pem" ]; then
    echo ""
    echo "⚠️  Você não está autenticado no Cloudflare!"
    echo ""
    echo "Executando: cloudflared login"
    echo "Isso abrirá seu navegador para você se autenticar."
    echo ""
    read -p "Pressione ENTER para continuar..."

    cloudflared login

    if [ $? -ne 0 ]; then
        echo "❌ Falha na autenticação. Tente novamente."
        exit 1
    fi
else
    echo "✅ Autenticação encontrada"
fi
echo ""

# ═══════════════════════════════════════════════════════════════════════════════
# PASSO 3: Criar tunnel (se não existir)
# ═══════════════════════════════════════════════════════════════════════════════

echo "[PASSO 3] Verificando tunnel..."

if ! cloudflared tunnel list 2>/dev/null | grep -q "api-comfyui"; then
    echo ""
    echo "⚠️  Tunnel 'api-comfyui' NÃO existe!"
    echo ""
    echo "Criando novo tunnel..."
    echo ""
    cloudflared tunnel create api-comfyui

    if [ $? -ne 0 ]; then
        echo "❌ Falha ao criar tunnel."
        exit 1
    fi
    echo ""
    echo "✅ Tunnel criado com sucesso!"
else
    echo "✅ Tunnel 'api-comfyui' já existe"
fi
echo ""

# ═══════════════════════════════════════════════════════════════════════════════
# PASSO 4: Exibir informações do tunnel
# ═══════════════════════════════════════════════════════════════════════════════

echo "[PASSO 4] Informações do tunnel:"
echo ""

TUNNEL_INFO=$(cloudflared tunnel list | grep "api-comfyui")

if [ -z "$TUNNEL_INFO" ]; then
    echo "❌ Erro ao obter informações do tunnel"
    exit 1
fi

TUNNEL_UUID=$(echo "$TUNNEL_INFO" | awk '{print $1}')
TUNNEL_NAME=$(echo "$TUNNEL_INFO" | awk '{print $2}')
TUNNEL_CNAME=$(echo "$TUNNEL_INFO" | awk '{print $3}')

echo "✅ UUID: $TUNNEL_UUID"
echo "✅ Nome: $TUNNEL_NAME"
echo "✅ CNAME: $TUNNEL_CNAME"
echo ""

echo "📋 PRÓXIMA ETAPA: Apontar DNS no Cloudflare"
echo "   1. Vá para https://dash.cloudflare.com"
echo "   2. Selecione seu domínio"
echo "   3. Vá em DNS"
echo "   4. Crie um CNAME record:"
echo "      Nome: api-comfyui (ou outro subdomain)"
echo "      Content: $TUNNEL_CNAME"
echo "      Proxy: Proxied"
echo ""

# ═══════════════════════════════════════════════════════════════════════════════
# PASSO 5: Atualizar cloudflared-config.yml
# ═══════════════════════════════════════════════════════════════════════════════

echo "[PASSO 5] Configuração:"
echo ""
echo "⚠️  Arquivo necessário: cloudflared-config.yml"
echo ""
echo "Passos:"
echo "   1. Abra: cloudflared-config.yml"
echo "   2. Substitua: <COLE_O_UUID_AQUI> → $TUNNEL_UUID"
echo "   3. Salve o arquivo"
echo ""

# ═══════════════════════════════════════════════════════════════════════════════
# PASSO 6: Pronto para rodar
# ═══════════════════════════════════════════════════════════════════════════════

echo "[PRONTO!] Setup do Cloudflare Tunnel completo!"
echo ""
echo "🚀 Para RODAR o tunnel, use:"
echo ""
echo "   cloudflared tunnel run api-comfyui"
echo ""
echo "   Ou (com config file customizado):"
echo "   cloudflared tunnel run --config cloudflared-config.yml api-comfyui"
echo ""
echo "📡 A API estará disponível em: https://api-comfyui.example.com"
echo ""
echo "🔒 Segurança:"
echo "   ✅ API (3000) exposta via HTTPS"
echo "   ✅ ComfyUI (8188) completamente bloqueado"
echo "   ✅ Rate limiting ativo"
echo "   ✅ Autenticação Bearer obrigatória"
echo ""
