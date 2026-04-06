# FRENTE A: Guia de Validação Completo com Docker

**Status:** Implementação concluída, aguardando testes práticos
**Data:** Abril 2026
**Objetivo:** Validar abstração de storage (FileSystem ↔ MinIO) com testes end-to-end

---

## 📋 Pré-requisitos

```bash
# Obrigatório:
✅ Docker instalado (versão 20.10+)
✅ Docker Compose (versão 1.29+)
✅ Node.js 18+ (para testes via curl)
✅ sqlite3 CLI (para ver banco de dados)
✅ curl (para fazer requisições HTTP)

# Verificar instalação:
docker --version
docker-compose --version
node --version
curl --version
sqlite3 --version
```

---

## 🚀 Seção 1: Setup Inicial

### 1.1 Limpar Ambiente Anterior

```bash
cd /c/Users/DELL/Desktop/api-comfyui

# Parar containers antigos
docker-compose down -v

# Limpar volumes
docker volume rm api-comfyui-redis api-comfyui-minio 2>/dev/null || true

# Limpar diretório de storage local (opcional)
rm -rf storage/ && mkdir -p storage

# Verificar limpeza
docker ps -a | grep api-comfyui
# Deve estar vazio
```

### 1.2 Atualizar Dependências

```bash
npm install --ignore-scripts
# Se houver erro com better-sqlite3, é ok (nativo)
```

### 1.3 Criar .env para Testes

```bash
# Copiar exemplo
cp .env.example .env

# Editar .env:
# STORAGE_TYPE=filesystem        # MANTER NO TESTE 1
# STORAGE_PATH=./storage

# Verificar arquivo
cat .env | grep STORAGE
```

---

## 🧪 Seção 2: TESTE 1 - FileSystem Storage

### 2.1 Subir Containers (FileSystem)

```bash
# Terminal 1: Subir containers
cd /c/Users/DELL/Desktop/api-comfyui
docker-compose up -d

# Aguardar 5 segundos para inicialização
sleep 5

# Verificar status
docker-compose ps

# ✅ Esperado:
# NAME              STATUS        PORTS
# api-comfyui       Up (healthy)  0.0.0.0:3000->3000/tcp
# api-comfyui-redis Up (healthy)  0.0.0.0:6379->6379/tcp
# api-comfyui-minio Up (healthy)  0.0.0.0:9000->9000/tcp
```

### 2.2 Verificar Logs da Inicialização

```bash
# Terminal 2: Ver logs de startup
docker-compose logs -f api

# ✅ Procurar por:
# - "Inicializando Storage Service..."
# - "✅ Storage inicializado"
# - "type: filesystem"
# - "Inicializando banco de dados SQLite..."
# - "Servidor iniciado com sucesso!"
```

### 2.3 Teste de Health Check

```bash
# Terminal 3: Verificar saúde da API
curl -s http://localhost:3000/health | jq .

# ✅ Esperado (deve retornar algo ou 404 é ok nesta etapa)
```

### 2.4 Teste de Upload (FileSystem)

```bash
# Criar arquivo de teste
echo "fake image data" > /tmp/test-image.jpg

# Fazer upload
UPLOAD_RESPONSE=$(curl -s -X POST http://localhost:3000/api/ai/submit \
  -H "Authorization: Bearer sk_live_your_secret_key_here_change_this" \
  -F "image=@/tmp/test-image.jpg" \
  -F "workflow=catalog")

echo "$UPLOAD_RESPONSE" | jq .

# ✅ Esperado:
# {
#   "status": "queued",
#   "job_id": "job_<uuid>",
#   "message": "Imagem recebida. Processamento iniciado.",
#   "polling_url": "/api/ai/status/job_<uuid>"
# }

# Salvar job_id para próximos testes
export JOB_ID=$(echo "$UPLOAD_RESPONSE" | jq -r '.job_id')
echo "Job ID: $JOB_ID"
```

### 2.5 Verificar Arquivo no Storage (FileSystem)

```bash
# Lista arquivos salvos
ls -lah storage/uploads/

# ✅ Esperado: arquivo nomeado como "job_<uuid>.jpg"
# Exemplo: storage/uploads/job_550e8400-e29b-41d4-a716-446655440000.jpg

# Verificar conteúdo (deve ser o arquivo que enviamos)
cat storage/uploads/job_*.jpg | head -c 20
```

### 2.6 Verificar Persistência em SQLite

```bash
# Terminal 4: Abrir banco de dados
sqlite3 /c/Users/DELL/Desktop/api-comfyui/data.db

# Dentro do sqlite3:
SELECT id, status, inputImagePath FROM jobs LIMIT 1;

# ✅ Esperado:
# id              | status  | inputImagePath
# job_550e8...    | pending | uploads/job_550e8...jpg

# Sair
.quit
```

### 2.7 Verificar Logs de Upload

```bash
# Ver logs da API
docker-compose logs api | grep -E "Upload|Job criado|enfileirado"

# ✅ Esperado:
# Upload salvo com sucesso
# Job criado e enfileirado com sucesso
```

### ✅ Resultado Teste 1: FileSystem

Se todos os testes acima passaram:

```
✅ TESTE 1: FileSystem Storage - PASSOU

Confirmado:
- API iniciou com FileSystemStorageAdapter
- Upload foi salvo em storage/uploads/
- Path relativo foi persistido em SQLite
- Job foi criado e enfileirado
```

---

## 🧪 Seção 3: TESTE 2 - MinIO Storage

### 3.1 Parar API e Mudar Configuração

```bash
# Parar apenas a API (Redis e MinIO continuam)
docker-compose stop api

# Editar .env para MinIO
# STORAGE_TYPE=minio
# STORAGE_MINIO_ENDPOINT=minio:9000  # Host interno do Docker
# STORAGE_MINIO_ACCESS_KEY=minioadmin
# STORAGE_MINIO_SECRET_KEY=minioadmin
# STORAGE_MINIO_BUCKET=comfyui
# STORAGE_MINIO_SSL=false

# Verificar
cat .env | grep STORAGE_MINIO
```

### 3.2 Criar Bucket no MinIO (Se necessário)

```bash
# Acessar MinIO via CLI (opcional, pode criar automaticamente)
docker-compose exec minio mc mb minio/comfyui --ignore-existing

# Ou acessar Web Console em: http://localhost:9001
# Login: minioadmin / minioadmin
```

### 3.3 Subir API novamente

```bash
# Iniciar apenas API (com nova config)
docker-compose up -d api

# Aguardar
sleep 3

# Ver logs de inicialização
docker-compose logs -f api | head -30

# ✅ Procurar por:
# - "Inicializando Storage Service..."
# - "type: minio"
# - "available: true"
```

### 3.4 Teste de Upload (MinIO)

```bash
# Criar novo arquivo
echo "another test image" > /tmp/test-image-2.jpg

# Upload
UPLOAD_RESPONSE=$(curl -s -X POST http://localhost:3000/api/ai/submit \
  -H "Authorization: Bearer sk_live_your_secret_key_here_change_this" \
  -F "image=@/tmp/test-image-2.jpg" \
  -F "workflow=portrait")

echo "$UPLOAD_RESPONSE" | jq .

# ✅ Esperado: mesmo formato que antes (202 + job_id)
export JOB_ID_MINIO=$(echo "$UPLOAD_RESPONSE" | jq -r '.job_id')
echo "Job ID (MinIO): $JOB_ID_MINIO"
```

### 3.5 Verificar Arquivo no MinIO

```bash
# Opção A: Acessar MinIO Web Console (9001)
# - Login: minioadmin / minioadmin
# - Navegar: Buckets > comfyui > uploads
# - Deve ver: uploads/job_<uuid>-2.jpg

# Opção B: Usar MinIO CLI (se instalado)
docker-compose exec minio mc ls minio/comfyui/uploads/

# Opção C: Usar curl via MinIO API
# (Mais complexo, a opção A é mais simples)
```

### 3.6 Verificar SQLite (MinIO)

```bash
# Abrir banco novamente
sqlite3 /c/Users/DELL/Desktop/api-comfyui/data.db

# Ver ambos os jobs (filesystem e minio)
SELECT id, inputImagePath FROM jobs ORDER BY created_at DESC LIMIT 2;

# ✅ Esperado:
# job_550e8...    | uploads/job_550e8...jpg (MinIO, sem path absoluto)
# job_abc12...    | uploads/job_abc12...jpg (FileSystem anterior)

.quit
```

### ✅ Resultado Teste 2: MinIO

```
✅ TESTE 2: MinIO Storage - PASSOU

Confirmado:
- API iniciou com MinIOStorageAdapter
- Upload foi salvo em bucket comfyui/uploads/
- Object name foi persistido em SQLite
- Job foi criado com MinIO backend
```

---

## 🧪 Seção 4: TESTE 3 - Switching Backend

### 4.1 Voltar para FileSystem

```bash
# Editar .env
# STORAGE_TYPE=filesystem

# Parar e reiniciar API
docker-compose stop api
docker-compose up -d api
sleep 3

# Ver logs
docker-compose logs api | grep "Storage inicializado"

# ✅ Deve mostrar: type: filesystem
```

### 4.2 Testar Upload (De volta ao FileSystem)

```bash
# Upload novo
echo "third test" > /tmp/test-image-3.jpg

UPLOAD_RESPONSE=$(curl -s -X POST http://localhost:3000/api/ai/submit \
  -H "Authorization: Bearer sk_live_your_secret_key_here_change_this" \
  -F "image=@/tmp/test-image-3.jpg")

echo "$UPLOAD_RESPONSE" | jq .

# ✅ Esperado: 202 + job_id
```

### 4.3 Verificar Persistência de Todos os Backends

```bash
# Abrir banco
sqlite3 /c/Users/DELL/Desktop/api-comfyui/data.db

# Ver todos os 3 jobs
SELECT COUNT(*) as total_jobs FROM jobs;

# ✅ Esperado: 3 (um do filesystem anterior, um do minio, um novo filesystem)

# Ver paths
SELECT id, inputImagePath FROM jobs ORDER BY created_at DESC LIMIT 3;

# Todos devem ter paths do tipo:
# uploads/job_<uuid>.jpg

.quit
```

### ✅ Resultado Teste 3: Switching

```
✅ TESTE 3: Backend Switching - PASSOU

Confirmado:
- Mudança de FileSystem para MinIO funcionou
- Mudança de volta para FileSystem funcionou
- Todos os 3 jobs foram persistidos em SQLite
- Nenhuma quebra ao trocar backend
```

---

## 🧪 Seção 5: TESTE 4 - Diagnósticos

### 5.1 Verificar Espaço em Disco (FileSystem)

```bash
# Espaço total usado
du -sh storage/

# ✅ Esperado: alguns KB (arquivos pequenos de teste)

# Detalhado
du -sh storage/*

# ✅ Esperado:
# storage/uploads  - arquivos de entrada
# storage/outputs  - (vazio por enquanto)
# storage/temp     - (pode estar vazio)
```

### 5.2 Verificar MinIO Storage

```bash
# Via MinIO Web Console (http://localhost:9001)
# - Buckets > comfyui > Metrics
# - Deve mostrar: Objects: 1, Size: ~18 bytes

# Ou via CLI:
docker-compose exec minio mc du minio/comfyui
```

### 5.3 Verificar Redis

```bash
# Conectar ao Redis
docker-compose exec redis redis-cli

# Dentro do redis-cli:
KEYS "comfyui*"

# ✅ Deve mostrar fila (pode estar vazia se não processou)
# "comfyui-jobs:waiting"
# "comfyui-jobs:active"
# etc

DBSIZE
# Número de chaves no banco

exit
```

### 5.4 Verificar Logs Completos

```bash
# Logs de toda a aplicação
docker-compose logs api --tail=100

# Procurar por erros (grep "error\|Error\|ERROR")
docker-compose logs api | grep -i "error"

# ✅ Esperado: nenhum erro, apenas warnings normais
```

### 5.5 Testar Health Check da API

```bash
# Se houver endpoint /health
curl -s http://localhost:3000/health | jq . || echo "Endpoint /health não implementado"

# Se houver endpoint /metrics (Prometheus)
curl -s http://localhost:3000/metrics | head -20
```

---

## 📊 Seção 6: Checklist Final de Validação

Execute este checklist ao final de todos os testes:

```
TESTE 1: FileSystem Storage
┌─────────────────────────────────────────────────────────┐
│ ✅ API iniciou com FileSystemStorageAdapter            │
│ ✅ Upload foi salvo em storage/uploads/                │
│ ✅ Path relativo persistido em SQLite                  │
│ ✅ Job criado e enfileirado                            │
│ ✅ Logs mostram "Storage inicializado"                 │
│ ✅ Arquivo fisicamente existe em disco                 │
│ Status: [  ] PASSOU  [  ] FALHOU                       │
└─────────────────────────────────────────────────────────┘

TESTE 2: MinIO Storage
┌─────────────────────────────────────────────────────────┐
│ ✅ API iniciou com MinIOStorageAdapter                 │
│ ✅ Upload foi salvo em bucket comfyui/uploads/         │
│ ✅ Object name persistido em SQLite                    │
│ ✅ Job criado com MinIO backend                        │
│ ✅ MinIO Web Console mostra objeto                     │
│ ✅ Logs mostram "type: minio, available: true"         │
│ Status: [  ] PASSOU  [  ] FALHOU                       │
└─────────────────────────────────────────────────────────┘

TESTE 3: Backend Switching
┌─────────────────────────────────────────────────────────┐
│ ✅ Mudança FileSystem → MinIO funcionou                │
│ ✅ Mudança MinIO → FileSystem funcionou                │
│ ✅ 3 jobs criados com backends diferentes              │
│ ✅ Todos os jobs persistidos no mesmo SQLite           │
│ ✅ Nenhuma quebra ao trocar .env                       │
│ Status: [  ] PASSOU  [  ] FALHOU                       │
└─────────────────────────────────────────────────────────┘

TESTE 4: Diagnósticos
┌─────────────────────────────────────────────────────────┐
│ ✅ Storage/uploads tem arquivos                         │
│ ✅ MinIO bucket tem objetos                            │
│ ✅ Redis tem chaves da fila                            │
│ ✅ SQLite tem 3 linhas em jobs                         │
│ ✅ Nenhum erro crítico nos logs                        │
│ ✅ Health check responde (ou não existe)               │
│ Status: [  ] PASSOU  [  ] FALHOU                       │
└─────────────────────────────────────────────────────────┘

RESULTADO FINAL
┌─────────────────────────────────────────────────────────┐
│ TODOS OS TESTES PASSARAM: [  ] SIM  [  ] NÃO          │
│                                                          │
│ Se NÃO, descreva qual teste falhou:                    │
│ ________________________________________________         │
│ ________________________________________________         │
│                                                          │
│ Mensagem de erro:                                       │
│ ________________________________________________         │
│ ________________________________________________         │
│                                                          │
│ Status FRENTE A: [  ] VALIDADA  [  ] PENDENTE AJUSTE  │
└─────────────────────────────────────────────────────────┘
```

---

## 🔧 Seção 7: Diagnóstico de Falhas

Se algum teste falhar, use este guia:

### Problema: "Storage não está respondendo"

```bash
# 1. Verificar se containers estão rodando
docker-compose ps

# 2. Se FileSystem, verificar se diretório existe
ls -la storage/

# Se não existe, criar:
mkdir -p storage/{uploads,outputs,temp}

# 3. Verificar permissões
chmod 755 storage

# 4. Restart API
docker-compose restart api
```

### Problema: MinIO 404 ao fazer upload

```bash
# 1. Verificar se MinIO está healthy
docker-compose logs minio | tail -20

# 2. Verificar se bucket existe
docker-compose exec minio mc ls minio/

# 3. Criar bucket manualmente
docker-compose exec minio mc mb minio/comfyui --ignore-existing

# 4. Verificar permissões
docker-compose exec minio mc acl set public minio/comfyui

# 5. Restart API
docker-compose restart api
```

### Problema: SQLite "database is locked"

```bash
# 1. Verificar se há outro acesso
lsof | grep data.db || echo "Arquivo não bloqueado"

# 2. Fechar sqlite3 aberto em outro terminal

# 3. Remover lock files (se existir)
rm -f data.db-journal data.db-wal data.db-shm

# 4. Restart API
docker-compose restart api
```

### Problema: Upload retorna 401 (Unauthorized)

```bash
# 1. Verificar API_KEY em .env
grep API_KEY .env

# 2. Usar a mesma key em curl:
curl -H "Authorization: Bearer sk_live_your_secret_key_here_change_this"

# 3. Se não souber a key, gerar uma nova
npm run generate-key

# 4. Atualizar .env e restart API
```

### Problema: "Type mismatch" ou erro de compilação

```bash
# TypeScript tem issues de versão com BullMQ/Redis
# Isso é esperado e já foi contornado com @ts-ignore

# Se realmente quebrar:
npm install --ignore-scripts
npx tsc --noEmit 2>&1 | grep -v "6133\|7016" | head -10
```

---

## 📝 Notas Importantes

1. **Paths no SQLite:**
   - FileSystem: `uploads/job_<uuid>.jpg` (relativo)
   - MinIO: `uploads/job_<uuid>.jpg` (object name, não URL)

2. **Endpoints não implementados nesta etapa:**
   - GET /api/ai/result/:jobId (ainda vai usar path do banco)
   - DELETE /api/ai/job/:jobId (ainda não implementado)

3. **O que NÃO testa este guia:**
   - Processamento real em ComfyUI (seria muito complexo simular)
   - Download de resultado (implementado depois)
   - Deleção de arquivos (implementado depois)

4. **Próximo passo após validação:**
   - FRENTE B: Dead Letter Queue
   - FRENTE C: Alertas básicos
   - FRENTE D: Testes de carga

---

## 🎯 Como Executar Este Guia

```bash
# Execute na ordem:
# 1. Seção 1: Setup Inicial
# 2. Seção 2: TESTE 1 (FileSystem)
# 3. Seção 3: TESTE 2 (MinIO)
# 4. Seção 4: TESTE 3 (Switching)
# 5. Seção 5: TESTE 4 (Diagnósticos)
# 6. Seção 6: Preencher Checklist
# 7. Seção 7: Se houver falhas, diagnosticar

# Tempo estimado: 30-45 minutos
```

---

**Quando completar os testes, compartilhe o resultado do Checklist Final para que possamos confirmar validação e prosseguir para FRENTE B.**
