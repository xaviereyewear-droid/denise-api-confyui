# 🚀 Cloudflare Tunnel - Quick Start

> **5 minutos para expor sua API para internet com segurança**

---

## 1️⃣ Instalar `cloudflared`

**Windows (Chocolatey)**:
```bash
choco install cloudflare-warp
```

**Windows (Scoop)**:
```bash
scoop install cloudflared
```

**Linux/Mac**: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/

**Verificar**:
```bash
cloudflared --version
```

---

## 2️⃣ Autenticar

```bash
cloudflared login
# Vai abrir navegador, faça login
```

---

## 3️⃣ Criar Tunnel

```bash
cloudflared tunnel create api-comfyui
# Salve o UUID que aparecer!
```

---

## 4️⃣ Listar Tunnel

```bash
cloudflared tunnel list
# Copie: UUID e CNAME
```

---

## 5️⃣ Atualizar Config

Abra `cloudflared-config.yml` e substitua `<COLE_O_UUID_AQUI>` pelo UUID

---

## 6️⃣ Apontar DNS

1. https://dash.cloudflare.com → seu domínio → DNS
2. Clique + Add Record
3. Type: CNAME | Name: api-comfyui | Content: [CNAME do passo 4]

---

## 7️⃣ Rodar

**Terminal 1**:
```bash
npm run dev
```

**Terminal 2**:
```bash
cloudflared tunnel run api-comfyui
```

---

## 8️⃣ Testar

```bash
curl https://api-comfyui.example.com/health
# Deve retornar 200 ✅
```

---

## 🔗 URLs Úteis

| Recurso | Link |
|---------|------|
| **Documentação Completa** | [ETAPA_8_CLOUDFLARE_TUNNEL.md](./ETAPA_8_CLOUDFLARE_TUNNEL.md) |
| **Rodar como Serviço** | [RODANDO_TUNNEL_COMO_SERVICO.md](./RODANDO_TUNNEL_COMO_SERVICO.md) |
| **Cloudflare Dashboard** | https://dash.cloudflare.com |
| **ComfyUI Docs** | https://docs.comfy.org |

---

## 🎯 Próximos Passos

- [ ] Setup completo (passos 1-8 acima)
- [ ] Testar acesso público
- [ ] Compartilhar URL com clientes
- [ ] Rodar tunnel como serviço (opcional, para produção)
- [ ] ETAPA 9: Hardening (banco, monitoramento)

---

## ❓ Problema?

Veja [ETAPA_8_CLOUDFLARE_TUNNEL.md](./ETAPA_8_CLOUDFLARE_TUNNEL.md#-troubleshooting) seção Troubleshooting
