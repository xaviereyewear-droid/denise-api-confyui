# ═══════════════════════════════════════════════════════════════════════════
# DOCKERFILE - API ComfyUI
# Multi-stage build para otimizar imagem final
# ═══════════════════════════════════════════════════════════════════════════

# ──────────────────────────────────────────────────────────────────────────
# Stage 1: Build
# ──────────────────────────────────────────────────────────────────────────

FROM node:18-alpine AS builder

# Metadados
LABEL maintainer="API ComfyUI"
LABEL description="Build stage para API ComfyUI"

WORKDIR /app

# Copiar package files
COPY package*.json ./

# Instalar dependências (production + devDependencies para build)
RUN npm ci

# Copiar código fonte
COPY src ./src
COPY migrations ./migrations
COPY tsconfig.json .

# Build TypeScript → JavaScript
RUN npm run build

# ──────────────────────────────────────────────────────────────────────────
# Stage 2: Runtime
# ──────────────────────────────────────────────────────────────────────────

FROM node:18-alpine

LABEL maintainer="API ComfyUI"
LABEL description="API ComfyUI - Runtime image"

WORKDIR /app

# Copiar package.json (apenas runtime deps)
COPY package*.json ./

# Instalar apenas dependências de produção
RUN npm ci --only=production && \
    npm cache clean --force

# Copiar build output do builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/migrations ./migrations

# Criar volume para storage
RUN mkdir -p /app/storage
VOLUME /app/storage

# Instalar dumb-init para melhor signal handling
RUN apk add --no-cache dumb-init

# Criar usuário não-root
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

USER nodejs

# Expor porta
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => { \
    if (r.statusCode !== 200) throw new Error(r.statusCode); \
  }).on('error', () => { process.exit(1); })" || exit 1

# Command
CMD ["node", "dist/index.js"]
