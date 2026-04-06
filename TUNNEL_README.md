# 🌐 Cloudflare Tunnel Setup - API ComfyUI

Este documento explica como expor sua API ComfyUI para internet usando **Cloudflare Tunnel**, de forma segura.

---

## 📚 Documentação

Escolha seu estilo de aprendizado:

### ⚡ Quick Start (5 min)
Para quem só quer fazer funcionar rápido:
→ [`docs/TUNNEL_QUICK_START.md`](docs/TUNNEL_QUICK_START.md)

### 📖 Documentação Completa (30 min)
Para entender todo o processo:
→ [`docs/ETAPA_8_CLOUDFLARE_TUNNEL.md`](docs/ETAPA_8_CLOUDFLARE_TUNNEL.md)

### 🔧 Rodar como Serviço (10 min)
Para deixar tunnel rodando sem terminal aberto:
→ [`docs/RODANDO_TUNNEL_COMO_SERVICO.md`](docs/RODANDO_TUNNEL_COMO_SERVICO.md)

---

## 🎯 O Que Você Vai Conseguir

**Antes**:
```
Seu PC (localhost)
└── API: 3000 (acessível só localmente)
└── ComfyUI: 8188 (acessível só localmente)
```

**Depois**:
```
Internet
└── https://api-comfyui.example.com (PUBLIC ✅)
    └── API: 3000 (acessível de qualquer lugar)

Seu PC (localhost)
└── ComfyUI: 8188 (BLOQUEADO ❌ só local)
```

---

## ✅ Segurança Garantida

| O Que | Status |
|------|--------|
| API exposta | ✅ Via HTTPS |
| ComfyUI exposto | ❌ Completamente bloqueado |
| Autenticação | ✅ Bearer token obrigatório |
| Rate limiting | ✅ 10 req/min por IP |
| Criptografia | ✅ TLS via Cloudflare |
| DDoS protection | ✅ Automático |

---

## 🚀 Começar Agora

### Opção 1: Executar Script (automático)

**Windows**:
```bash
scripts\setup-tunnel.bat
```

**Linux/Mac**:
```bash
bash scripts/setup-tunnel.sh
```

### Opção 2: Manual (controle total)

Siga a documentação completa: [`docs/ETAPA_8_CLOUDFLARE_TUNNEL.md`](docs/ETAPA_8_CLOUDFLARE_TUNNEL.md)

---

## 📋 Arquivos Criados

| Arquivo | Descrição |
|---------|-----------|
| `cloudflared-config.yml` | Configuração do tunnel |
| `scripts/setup-tunnel.bat` | Script de setup (Windows) |
| `scripts/setup-tunnel.sh` | Script de setup (Linux/Mac) |
| `docs/ETAPA_8_CLOUDFLARE_TUNNEL.md` | Documentação completa |
| `docs/TUNNEL_QUICK_START.md` | Guia rápido (5 min) |
| `docs/RODANDO_TUNNEL_COMO_SERVICO.md` | Como rodar como serviço |

---

## 💡 Dicas

1. **Primeiro Setup?** Comece com [`TUNNEL_QUICK_START.md`](docs/TUNNEL_QUICK_START.md)
2. **Dúvidas?** Veja a seção Troubleshooting em [`ETAPA_8_CLOUDFLARE_TUNNEL.md`](docs/ETAPA_8_CLOUDFLARE_TUNNEL.md)
3. **Produção?** Configure como serviço em [`RODANDO_TUNNEL_COMO_SERVICO.md`](docs/RODANDO_TUNNEL_COMO_SERVICO.md)

---

## 🔗 Links Úteis

- **Cloudflare Dashboard**: https://dash.cloudflare.com
- **Cloudflare Docs**: https://developers.cloudflare.com/cloudflare-one/
- **Download cloudflared**: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/

---

## ❓ FAQ Rápido

**P: Precisa de conta paga?**
A: Não, Cloudflare Tunnel é gratuito.

**P: ComfyUI fica exposto?**
A: Não, fica bloqueado. Só API (3000) é exposta.

**P: Preciso deixar terminal aberto 24/7?**
A: Não, se rodar como serviço (veja documentação).

**P: Como compartilho URL com clientes?**
A: Após setup, URL será algo como: `https://api-comfyui.seu-dominio.com`

---

## 📞 Suporte

Não funciona? Revise o checklist em [`ETAPA_8_CLOUDFLARE_TUNNEL.md`](docs/ETAPA_8_CLOUDFLARE_TUNNEL.md#-checklist-completo)
