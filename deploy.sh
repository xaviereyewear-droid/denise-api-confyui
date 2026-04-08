#!/bin/bash
# ════════════════════════════════════════════════════════════════
# deploy.sh — API ComfyUI Deploy
# Deploy independente da API em /var/www/api-comfyui
#
# Uso: bash deploy.sh [branch]
# Ex:  bash deploy.sh main
#      bash deploy.sh dev
# ════════════════════════════════════════════════════════════════

set -e

APP_DIR="/var/www/api-comfyui"
BRANCH=${1:-main}
PM2_APP_NAME="api-comfyui"

echo ""
echo "╔════════════════════════════════════════════════╗"
echo "║  API ComfyUI — Deploy                          ║"
echo "║  Branch: $BRANCH                               ║"
echo "╚════════════════════════════════════════════════╝"
echo ""

# ── 1. Criar diretório se não existir ──────────────────────────
if [ ! -d "$APP_DIR" ]; then
  echo "▶ [1/7] Criando diretório $APP_DIR..."
  mkdir -p $APP_DIR
  cd $APP_DIR
  git init
  git remote add origin https://github.com/xaviereyewear-droid/denise-api-confyui.git
fi

cd $APP_DIR

# ── 2. Puxar código novo ──────────────────────────────────────
echo "▶ [2/7] Puxando código do branch '$BRANCH'..."
git fetch origin $BRANCH
git checkout $BRANCH
git reset --hard origin/$BRANCH

# ── 3. Copiar .env.production para .env (se não existir) ──────
if [ ! -f "$APP_DIR/.env" ]; then
  echo "▶ [3/7] Criando arquivo .env..."
  cp .env.production .env
  echo "⚠️  ATENÇÃO: Edite .env com suas credenciais de produção!"
  echo "   sed -i 's/change_this/seu_valor/' .env"
else
  echo "▶ [3/7] Arquivo .env já existe (pulando)"
fi

# ── 4. Instalar dependências ─────────────────────────────────
echo "▶ [4/7] Instalando dependências..."
npm install --omit=dev

# ── 5. Build TypeScript ──────────────────────────────────────
echo "▶ [5/7] Compilando TypeScript..."
npm run build

# ── 6. Criar diretórios necessários ──────────────────────────
echo "▶ [6/7] Criando diretórios..."
mkdir -p $APP_DIR/storage/uploads
mkdir -p $APP_DIR/storage/outputs
mkdir -p $APP_DIR/logs
chmod 755 $APP_DIR/storage
chmod 755 $APP_DIR/logs

# ── 7. Reiniciar com PM2 ──────────────────────────────────────
echo "▶ [7/7] Iniciando/Reiniciando aplicação com PM2..."

# Verificar se PM2 está instalado
if ! command -v pm2 &> /dev/null; then
  echo "⚠️  PM2 não instalado. Instalando..."
  npm install -g pm2
fi

# Parar e deletar app anterior (se existir)
pm2 describe $PM2_APP_NAME > /dev/null 2>&1 && pm2 delete $PM2_APP_NAME || true

# Iniciar nova instância
pm2 start dist/index.js \
  --name $PM2_APP_NAME \
  --cwd $APP_DIR \
  --env NODE_ENV=production \
  --env-file .env \
  --log $APP_DIR/logs/app.log \
  --error $APP_DIR/logs/error.log \
  --out $APP_DIR/logs/out.log \
  --instances max \
  --exec-mode cluster

# Salvar configuração PM2
pm2 save

echo ""
echo "╔════════════════════════════════════════════════╗"
echo "║  ✅ Deploy concluído!                          ║"
echo "╚════════════════════════════════════════════════╝"
echo ""
echo "Status:"
pm2 status
echo ""
echo "Logs em tempo real:"
echo "  pm2 logs $PM2_APP_NAME"
echo ""
echo "Verificar saúde:"
echo "  curl http://localhost:3000/health"
echo ""
