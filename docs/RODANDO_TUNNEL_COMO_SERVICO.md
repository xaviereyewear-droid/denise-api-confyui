# 🔧 Rodando Cloudflare Tunnel como Serviço

> Para não precisar deixar um terminal aberto 24/7, você pode rodar o Tunnel como serviço no Windows ou Linux.

---

## 🪟 Windows - Task Scheduler

### Opção 1: Usando Task Scheduler (UI)

#### Passo 1: Criar arquivo batch

Crie `start-tunnel.bat` em `C:\Users\DELL\Desktop\api-comfyui\`:

```batch
@echo off
REM Inicia o Cloudflare Tunnel
cd C:\Users\DELL\Desktop\api-comfyui
cloudflared tunnel run --config cloudflared-config.yml api-comfyui
pause
```

#### Passo 2: Abrir Task Scheduler

1. Pressione `Win + R`
2. Digite: `taskschd.msc`
3. Clique **OK**

#### Passo 3: Criar Nova Tarefa

1. Clique **Action** → **Create Basic Task**
2. Preencha:
   - **Name**: `Cloudflare Tunnel - API ComfyUI`
   - **Description**: Runs Cloudflare Tunnel for API exposure
   - Clique **Next**

3. **Trigger**: Selecione **At Startup**
   - Clique **Next**

4. **Action**: Selecione **Start a program**
   - **Program/script**: `C:\Users\DELL\Desktop\api-comfyui\start-tunnel.bat`
   - Clique **Next**

5. Clique **Finish**

#### Passo 4: Testar

Abra Task Scheduler:
1. Procure por `Cloudflare Tunnel - API ComfyUI`
2. Clique **Run**
3. Uma janela deve abrir mostrando logs do tunnel

---

### Opção 2: Instalar como Serviço (cloudflared native)

```bash
# Terminal como Administrator

# Instalar serviço
cloudflared service install --config C:\Users\DELL\Desktop\api-comfyui\cloudflared-config.yml

# Iniciar serviço
net start cloudflared

# Para parar:
net stop cloudflared

# Para desinstalar:
cloudflared service uninstall
```

**Verificar status**:
```bash
# PowerShell
Get-Service cloudflared | Select-Object Status, DisplayName
```

---

## 🐧 Linux - systemd

### Passo 1: Criar arquivo de configuração

```bash
# Se ainda não existe
sudo mkdir -p /etc/cloudflared
sudo cp cloudflared-config.yml /etc/cloudflared/config.yml
sudo chown root:root /etc/cloudflared/config.yml
sudo chmod 600 /etc/cloudflared/config.yml
```

### Passo 2: Criar Unit File

Crie `/etc/systemd/system/cloudflared.service`:

```bash
sudo tee /etc/systemd/system/cloudflared.service > /dev/null <<EOF
[Unit]
Description=Cloudflare Tunnel - API ComfyUI
After=network.target

[Service]
Type=simple
User=cloudflared
ExecStart=/usr/bin/cloudflared tunnel run --config /etc/cloudflared/config.yml api-comfyui
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF
```

### Passo 3: Criar usuário

```bash
sudo useradd -r -m -d /var/lib/cloudflared -s /sbin/nologin cloudflared
```

### Passo 4: Ativar e Iniciar

```bash
# Reload systemd
sudo systemctl daemon-reload

# Ativar na startup
sudo systemctl enable cloudflared

# Iniciar agora
sudo systemctl start cloudflared

# Ver status
sudo systemctl status cloudflared

# Ver logs
sudo journalctl -u cloudflared -f
```

---

## 🍎 macOS - launchd

### Passo 1: Criar arquivo plist

Crie `~/Library/LaunchAgents/com.cloudflare.tunnel.plist`:

```bash
mkdir -p ~/Library/LaunchAgents

cat > ~/Library/LaunchAgents/com.cloudflare.tunnel.plist <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.cloudflare.tunnel</string>

    <key>ProgramArguments</key>
    <array>
        <string>/usr/local/bin/cloudflared</string>
        <string>tunnel</string>
        <string>run</string>
        <string>--config</string>
        <string>$(pwd)/cloudflared-config.yml</string>
        <string>api-comfyui</string>
    </array>

    <key>RunAtLoad</key>
    <true/>

    <key>StandardOutPath</key>
    <string>/var/log/cloudflared.log</string>

    <key>StandardErrorPath</key>
    <string>/var/log/cloudflared-error.log</string>

    <key>KeepAlive</key>
    <true/>

    <key>Restart</key>
    <integer>5</integer>
</dict>
</plist>
EOF
```

### Passo 2: Ativar

```bash
# Carregar na sessão atual
launchctl load ~/Library/LaunchAgents/com.cloudflare.tunnel.plist

# Ver status
launchctl list | grep cloudflare.tunnel

# Ver logs
tail -f /var/log/cloudflared.log
```

---

## 📊 Comparação de Métodos

| Método | Plataforma | Dificuldade | Auto-Restart | Logs |
|--------|-----------|-------------|--------------|------|
| **Task Scheduler** | Windows | ⭐ Fácil | ✅ Sim | Event Viewer |
| **cloudflared service** | Windows | ⭐ Muito Fácil | ✅ Sim | `Get-EventLog` |
| **systemd** | Linux | ⭐⭐ Médio | ✅ Sim | `journalctl` |
| **launchd** | macOS | ⭐⭐ Médio | ✅ Sim | `/var/log/` |

**Recomendação para você (Windows)**: `cloudflared service install` (mais simples)

---

## 🧪 Testar Serviço

Após instalar como serviço:

```bash
# Terminal novo (não o do tunnel)

# Health check
curl https://api-comfyui.example.com/health

# Deve retornar 200 mesmo sem terminal do tunnel aberto
```

---

## 🚨 Troubleshooting

### Serviço não inicia

**Windows**:
```bash
# Ver erro
Get-EventLog -LogName System -Source "cloudflared" -Newest 10
```

**Linux**:
```bash
sudo systemctl status cloudflared
sudo journalctl -u cloudflared -n 50
```

### Logs

**Windows (cloudflared service)**:
```bash
# PowerShell
Get-EventLog -LogName Application -Source "cloudflared" -Newest 20 | Format-List
```

**Windows (Task Scheduler)**:
1. Task Scheduler → History tab
2. Procure pela tarefa
3. Veja eventos de erro

**Linux**:
```bash
sudo journalctl -u cloudflared -f  # Follow logs
```

**macOS**:
```bash
tail -f /var/log/cloudflared.log
tail -f /var/log/cloudflared-error.log
```

---

## ✅ Checklist

- [ ] Tunnel configurado (`cloudflared tunnel list`)
- [ ] `cloudflared-config.yml` pronto
- [ ] Serviço instalado (`cloudflared service install` ou equiv.)
- [ ] Serviço iniciado
- [ ] Teste de saúde funciona: `curl https://api-comfyui.example.com/health`
- [ ] Logs mostram "Tunnel registered successfully"
- [ ] Reiniciar PC e confirmar que tunnel volta sozinho

---

## 📝 Notas

- **Permissões**: Serviço roda com permissões do usuário que instalou
- **Logs**: Sempre ative logs para troubleshooting
- **Segurança**: Certifique-se que `cloudflared-config.yml` está protegido (não compartilhe)
- **Upgrades**: `cloudflared update` funciona mesmo com serviço rodando
