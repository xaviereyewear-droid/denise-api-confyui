# 🚀 ETAPA 8: Cloudflare Tunnel - Segurança & Internet Exposure

> **Objetivo**: Expor a API ComfyUI para internet de forma segura via Cloudflare Tunnel, mantendo ComfyUI (8188) completamente fechado.

---

## 📊 Diagrama de Arquitetura

```
Internet
   │
   │ HTTPS
   ├──────────────────────────────┐
   │                              │
[Navegador/Cliente]        [Cloudflare Edge]
                                  │
                    ┌─────────────┼─────────────┐
                    │             │             │
             (Request            (Safe        (Routed
              validated)       Ingress)         to 3000)
                    │             │             │
                    └─────────────┼─────────────┘
                                  │
                        ╔═════════╩═════════╗
                        │                   │
                   (HTTPS)            [Seu PC]
                        │                   │
                        └───→ Cloudflare ──→ 3000 (API) ✅
                              Tunnel
                                │
                                ├───→ 8188 (ComfyUI) ❌ BLOQUEADO
                                └───→ Outro   (Qualquer outra porta) ❌ BLOQUEADO

Resultado:
  ✅ API acessível via https://api-comfyui.example.com
  ❌ ComfyUI não é acessível
  ❌ Nenhuma outra porta exposta
```

---

## 🎯 O Que Você Vai Fazer

### Fase 1: Instalação (5 min)
1. **Instalar `cloudflared`** (one-time)
2. **Fazer login** com Cloudflare (one-time)

### Fase 2: Configuração (10 min)
3. **Criar tunnel** chamado `api-comfyui`
4. **Atualizar config file** com UUID
5. **Apontar DNS** no Cloudflare

### Fase 3: Execução (continuous)
6. **Rodar tunnel** (terminal sempre aberto)
7. **Testar acesso**
8. **Compartilhar URL com clientes**

---

## 📋 Pré-requisitos

- ✅ Conta Cloudflare (gratuita)
- ✅ Domínio apontando para Cloudflare (você já tem `example.com`?)
- ✅ API ComfyUI rodando em `localhost:3000`
- ✅ ComfyUI rodando em `localhost:8188`

---

## 🔧 PASSO A PASSO COMPLETO

### PASSO 1: Instalar `cloudflared`

#### Opção A: Chocolatey (recomendado)
```bash
# Em PowerShell como Administrator
choco install cloudflare-warp

# Verificar
cloudflared --version
```

#### Opção B: Scoop
```bash
scoop install cloudflared
cloudflared --version
```

#### Opção C: Download Manual
1. Visite: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/
2. Procure "cloudflared Windows"
3. Baixe e execute o instalador
4. Verifique: `cloudflared --version`

---

### PASSO 2: Autenticar com Cloudflare

```bash
cloudflared login

# Isso abre seu navegador automaticamente
# Você vai:
# 1. Fazer login em https://dash.cloudflare.com
# 2. Selecionar seu domínio (ex: example.com)
# 3. Clicar "Authorize" para cloudflared
```

**Resultado**: Arquivo `C:\Users\<YourUsername>\.cloudflared\cert.pem` criado ✅

---

### PASSO 3: Criar Tunnel

```bash
cloudflared tunnel create api-comfyui

# Resposta será:
# Tunnel credentials written to C:\Users\DELL\.cloudflared\<UUID>.json
# Tunnel <UUID> created with name api-comfyui
```

**Salve o UUID!** (você vai precisar na Passo 4)

---

### PASSO 4: Listar Tunnels para Confirmar

```bash
cloudflared tunnel list

# Você verá algo como:
# ID                         NAME          CNAME
# abc123def456...            api-comfyui   abc123def456.cfargotunnel.com
```

**Salve o CNAME também!** (você vai apontar DNS para isso)

---

### PASSO 5: Atualizar `cloudflared-config.yml`

Abra o arquivo: `C:\Users\DELL\Desktop\api-comfyui\cloudflared-config.yml`

Procure por esta linha:
```yaml
credentials-file: C:\Users\DELL\.cloudflared\<COLE_O_UUID_AQUI>.json
```

**Substitua `<COLE_O_UUID_AQUI>` pelo UUID do PASSO 3**

Exemplo completo:
```yaml
credentials-file: C:\Users\DELL\.cloudflared\abc123def456789abcdef.json
```

✅ Salve o arquivo

---

### PASSO 6: Apontar DNS no Cloudflare

1. Acesse: https://dash.cloudflare.com
2. Selecione seu domínio (ex: `example.com`)
3. Vá para **DNS**
4. Clique **+ Add record**
5. Preencha:
   - **Type**: CNAME
   - **Name**: `api-comfyui` (seu subdomain)
   - **Content**: `abc123def456.cfargotunnel.com` (do PASSO 4)
   - **TTL**: Auto
   - **Proxy status**: Proxied ✅

6. Clique **Save**

**Resultado**: Você terá `api-comfyui.example.com` apontando para o tunnel ✅

---

### PASSO 7: Preparar Ambiente

Crie arquivo `.env` na raiz do projeto (copie de `.env.example`):

```bash
# Copiar template
copy .env.example .env
```

Edite `.env` e adicione:
```bash
# CLOUDFLARE TUNNEL
CLOUDFLARE_TUNNEL_URL=https://api-comfyui.example.com
CLOUDFLARE_DOMAIN=api-comfyui.example.com
CLOUDFLARE_TUNNEL_UUID=abc123def456789abcdef
```

---

### PASSO 8: Rodar o Tunnel

**Terminal 1** (Cloudflared Tunnel):
```bash
# Terminal na raiz do projeto
cd C:\Users\DELL\Desktop\api-comfyui

cloudflared tunnel run api-comfyui

# Resposta esperada:
# 2026-04-06T10:30:00Z inf Tunnel registered successfully
# 2026-04-06T10:30:00Z inf Tunnel started successfully
```

**Terminal 2** (API ComfyUI):
```bash
cd C:\Users\DELL\Desktop\api-comfyui
npm run dev

# Resposta esperada:
# ✅ Servidor iniciado com sucesso!
# 📡 Local   → http://localhost:3000
# 🌐 Público → https://api-comfyui.example.com
# 🎨 ComfyUI → http://localhost:8188
```

**Terminal 3** (Teste):
```bash
# Testar acesso público
curl -X GET https://api-comfyui.example.com/health

# Resposta esperada:
# {"status":"healthy","timestamp":"...","services":{...}}
```

---

## 🧪 TESTES DE SEGURANÇA

### ✅ Teste 1: API Acessível
```bash
# Deve retornar 200
curl -X GET https://api-comfyui.example.com/health

# Resposta esperada:
# {
#   "status": "healthy",
#   "services": {
#     "api": "running",
#     "comfyui": "connected",
#     "storage": "accessible"
#   }
# }
```

### ❌ Teste 2: ComfyUI Bloqueado
```bash
# Deve retornar 404 (route not found)
curl -X GET https://api-comfyui.example.com:8188/system_stats

# Resposta esperada:
# HTTP/1.1 404 Not Found
# (ou conexão recusada)
```

### ❌ Teste 3: Outras Portas Bloqueadas
```bash
# Deve retornar 404
curl -X GET https://api-comfyui.example.com:9000/
```

---

## 📱 Usando a API via URL Pública

### Com curl
```bash
TOKEN="sk_live_seu_token_gerado"

# Submeter imagem
curl -X POST https://api-comfyui.example.com/api/ai/submit \
  -H "Authorization: Bearer ${TOKEN}" \
  -F "image=@/path/to/image.png" \
  -F "workflow=catalog"

# Resposta (202):
# {
#   "status": "queued",
#   "job_id": "job_abc123",
#   "polling_url": "/api/ai/status/job_abc123"
# }
```

### Com JavaScript/Fetch
```javascript
const token = 'sk_live_seu_token';
const imageFile = document.getElementById('fileInput').files[0];

const formData = new FormData();
formData.append('image', imageFile);
formData.append('workflow', 'catalog');

const response = await fetch('https://api-comfyui.example.com/api/ai/submit', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`
  },
  body: formData
});

const data = await response.json();
console.log(`Job ID: ${data.job_id}`);
```

### Com Python
```python
import requests

token = 'sk_live_seu_token'
headers = {'Authorization': f'Bearer {token}'}

with open('image.png', 'rb') as f:
    files = {'image': f}
    data = {'workflow': 'catalog'}

    response = requests.post(
        'https://api-comfyui.example.com/api/ai/submit',
        headers=headers,
        files=files,
        data=data
    )

result = response.json()
job_id = result['job_id']
print(f"Job ID: {job_id}")
```

---

## 🔍 Monitoramento & Status

### Ver Status do Tunnel
```bash
# Tunnel rodando?
cloudflared tunnel info api-comfyui

# Logs do tunnel
cloudflared tunnel run api-comfyui

# (Ctrl+C para parar)
```

### Dashboard Cloudflare
Acesse: https://dash.cloudflare.com → Sua conta → Cron Jobs/Tunnels

Você verá:
- Status: Active/Inactive
- Tempo conectado
- Dados transferidos
- Métricas de requisição

---

## 🚨 Troubleshooting

### ❌ "Tunnel not found"
```bash
# Verifique se tunnel foi criado
cloudflared tunnel list

# Se não aparecer, crie:
cloudflared tunnel create api-comfyui
```

### ❌ "404 Not Found" ao acessar API
```bash
# Verifique:
# 1. DNS CNAME aponta para cfargotunnel.com? ✅
# 2. API está rodando em localhost:3000? ✅
# 3. Cloudflared está rodando? ✅

# Se ainda não funciona:
# Aguarde 2-3 minutos para DNS propagar
# Limpe cache do navegador
```

### ❌ "ComfyUI acessível" (SEGURANÇA!)
Se conseguir acessar `https://api-comfyui.example.com:8188`:
1. Revise `cloudflared-config.yml`
2. Certifique-se que há regra `- service: http_status:404` no final
3. Restart cloudflared

---

## 📊 Checklist Completo

- [ ] `cloudflared` instalado (`cloudflared --version`)
- [ ] Autenticado com Cloudflare (`cloudflared login`)
- [ ] Tunnel criado (`cloudflared tunnel list`)
- [ ] `cloudflared-config.yml` atualizado com UUID
- [ ] DNS CNAME apontando para tunnel
- [ ] `.env` configurado com CLOUDFLARE_TUNNEL_URL
- [ ] Terminal 1: API rodando (`npm run dev`)
- [ ] Terminal 2: Tunnel rodando (`cloudflared tunnel run api-comfyui`)
- [ ] ✅ Teste 1: API acessível via HTTPS
- [ ] ❌ Teste 2: ComfyUI bloqueado
- [ ] Documentação compartilhada com clientes

---

## 🔐 Segurança Confirmada

| Requisito | Status | Evidência |
|-----------|--------|-----------|
| **API exposta** | ✅ | HTTPS funciona |
| **ComfyUI fechado** | ✅ | 404 em porta 8188 |
| **Autenticação** | ✅ | Bearer token obrigatório |
| **Rate limiting** | ✅ | 10 req/min por IP |
| **Encryption** | ✅ | TLS via Cloudflare |
| **DDoS protection** | ✅ | Automático Cloudflare |

---

## 📚 Próximas Etapas

✅ **ETAPA 8 Completo**: Cloudflare Tunnel configurado
- [ ] ETAPA 9: Production Hardening (banco de dados, monitoramento)
- [ ] ETAPA 10: Scalability (fila externa, GPU cloud)
- [ ] ETAPA 11: Testing Guide (teste cases, CI/CD)
- [ ] ETAPA 12: Deployment Automation (scripts, Docker)

---

## ❓ FAQ

**P: ComfyUI continua rodando em 8188?**
R: Sim! ComfyUI roda localmente em 8188 (inacessível de fora). Apenas a API (3000) é exposta.

**P: Quanto custa Cloudflare Tunnel?**
R: Gratuito para sempre! Sem limite de dados.

**P: Posso usar meu próprio domínio?**
R: Sim! Desde que ele esteja apontado para Cloudflare nameservers.

**P: E se perder a conexão com internet?**
R: Tunnel desconecta. Clientes recebem "Connection refused". Reconecta automaticamente.

**P: Preciso deixar terminal aberto 24/7?**
R: Sim, enquanto quiser que API seja pública. Para produção, instale como serviço Windows.

**P: Como instalar como serviço?**
R: (Futuro) ETAPA 9 cobrirá isso com systemd (Linux) / Task Scheduler (Windows).

---

## 📞 Suporte

Algo não funciona? Revise:
1. Tem internet?
2. `cloudflared --version` funciona?
3. Tunnel aparece em `cloudflared tunnel list`?
4. API roda em `localhost:3000`?
5. Arquivo `cloudflared-config.yml` tem UUID correto?
6. DNS CNAME criado no Cloudflare?

Se ainda não funcionar, envie:
- `cloudflared tunnel list` output
- `cloudflared tunnel info api-comfyui` output
- Erro exato do navegador
