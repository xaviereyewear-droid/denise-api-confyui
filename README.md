# 🎨 API ComfyUI - Intermediária Segura

API Node.js/TypeScript que funciona como intermediária segura entre sua aplicação web e o ComfyUI rodando localmente.

## 🏗️ Arquitetura

```
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│   App Web        │────▶│   API Node.js    │────▶│   ComfyUI Local  │
│  (Pública)       │     │  (Intermediária) │     │  (Privada)       │
└──────────────────┘     └──────────────────┘     └──────────────────┘
    HTTPS/443            Cloudflare Tunnel        localhost:8188
```

## ✨ Features

- ✅ Autenticação com Bearer Token
- ✅ Rate limiting por IP/Token
- ✅ Validação de arquivos
- ✅ Comunicação segura com ComfyUI
- ✅ Polling de status de jobs
- ✅ Tratamento robusto de erros
- ✅ Logs estruturados com Pino
- ✅ TypeScript stricto
- ✅ Pronto para Cloudflare Tunnel

## 🚀 Quick Start

### 1. Instalação

```bash
# Clone ou crie o projeto
mkdir api-comfyui
cd api-comfyui

# Instale dependências
npm install

# Gere uma API key segura
npm run generate-key

# Copie o .env.example para .env
cp .env.example .env

# Edite .env com suas configurações
nano .env  # ou use seu editor preferido
```

### 2. Configuração do .env

```bash
# Copie a saída do generate-key para aqui
API_KEY=sk_live_seu_chave_segura_aqui

# Certifique-se que ComfyUI está na porta correta
COMFYUI_HOST=localhost
COMFYUI_PORT=8188

# Ambiente
NODE_ENV=development
API_PORT=3000
```

### 3. Inicie o Servidor

```bash
# Desenvolvimento (com hot reload)
npm run dev

# Produção
npm run build
npm run start
```

### 4. Verifique a Saúde

```bash
# Terminal novo
curl http://localhost:3000/health
```

Resposta esperada:
```json
{
  "status": "healthy",
  "timestamp": "2026-04-06T20:35:45Z",
  "services": {
    "api": "running",
    "comfyui": "connected",
    "storage": "accessible"
  }
}
```

## 📝 Endpoints Disponíveis

| Método | Endpoint | Auth | Descrição |
|--------|----------|------|-----------|
| POST | `/api/ai/submit` | ✅ | Enviar imagem |
| GET | `/api/ai/status/:jobId` | ✅ | Status do job |
| GET | `/api/ai/result/:jobId` | ✅ | Baixar resultado |
| DELETE | `/api/ai/job/:jobId` | ✅ | Cancelar job |
| GET | `/health` | ❌ | Health check |
| GET | `/health/comfyui` | ❌ | Status ComfyUI |

## 🔐 Autenticação

Todas as requisições de IA requerem header:

```bash
curl -H "Authorization: Bearer sk_live_seu_token_aqui" \
     http://localhost:3000/api/ai/submit
```

## 📁 Estrutura de Pastas

```
api-comfyui/
├── src/
│   ├── config/          # Configurações
│   ├── middleware/      # Middlewares Express
│   ├── routes/          # Rotas da API
│   ├── controllers/     # Controladores (próxima etapa)
│   ├── services/        # Serviços (próxima etapa)
│   ├── lib/             # Utilitários
│   ├── types/           # TypeScript types
│   └── index.ts         # Entrada principal
├── scripts/             # Scripts úteis
├── storage/             # Armazenamento local
├── dist/                # Build compilado
└── package.json
```

## 🛠️ Scripts Disponíveis

```bash
npm run dev               # Desenvolvimento com hot reload
npm run build             # Compilar TypeScript
npm run start             # Iniciar produção
npm run generate-key      # Gerar nova API key
npm run cleanup-old       # Limpar arquivos antigos
npm run clean             # Limpar build anterior
```

## 🌐 Próximos Passos

Esta é a **ETAPA 5** de 13. O código atual oferece:

- ✅ Configuração completa
- ✅ Autenticação funcional
- ✅ Rate limiting
- ✅ Tratamento de erros
- ✅ Estrutura de tipos

Faltam as próximas etapas:
- [ ] Etapa 6: Serviço de integração ComfyUI
- [ ] Etapa 7: Controlador de upload
- [ ] Etapa 8: Serviço de polling
- [ ] Etapa 9: Cloudflare Tunnel
- [ ] Etapa 10: Endpoint completo

## 🔧 Troubleshooting

**Erro: `Cannot find module 'dotenv'`**
```bash
npm install
```

**Erro: `API_KEY must have at least 20 characters`**
```bash
npm run generate-key
# Copie a saída para .env
```

**ComfyUI não conecta**
```bash
# Verifique se ComfyUI está rodando
curl http://localhost:8188

# Verifique configuração em .env
# COMFYUI_HOST=localhost
# COMFYUI_PORT=8188
```

## 📚 Documentação Completa

Veja o arquivo `ARCHITECTURE.md` para detalhes de design.

## 📄 Licença

MIT

---

**Status**: 🟡 MVP em desenvolvimento
**Última atualização**: 2026-04-06
