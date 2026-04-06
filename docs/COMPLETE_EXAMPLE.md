# 📚 Guia Completo End-to-End - ETAPA 7

Este guia mostra como usar a API de ponta a ponta.

---

## 1. Iniciar o Servidor

```bash
# Terminal 1: Inicie o servidor API
npm run dev

# Saída esperada:
# ✅ Servidor iniciado com sucesso!
# 📡 API      → http://localhost:3000
# 🎨 ComfyUI  → http://localhost:8188
```

---

## 2. Verificar Saúde da API

```bash
# Health check geral
curl http://localhost:3000/health

# Resposta:
{
  "status": "healthy",
  "timestamp": "2026-04-06T20:35:45Z",
  "services": {
    "api": "running",
    "comfyui": "connected",
    "storage": "accessible"
  },
  "details": {
    "jobs": {
      "total": 0,
      "queued": 0,
      "processing": 0,
      "completed": 0,
      "failed": 0
    },
    "storage": {
      "used_mb": "0.00"
    }
  }
}
```

```bash
# Verificar apenas ComfyUI
curl http://localhost:3000/health/comfyui

# Resposta:
{
  "status": "connected",
  "timestamp": "2026-04-06T20:35:45Z",
  "comfyui": {
    "url": "localhost:8188",
    "reachable": true
  },
  "message": "ComfyUI está respondendo"
}
```

---

## 3. Obter Estatísticas

```bash
curl http://localhost:3000/stats

# Resposta:
{
  "timestamp": "2026-04-06T20:35:45Z",
  "jobs": {
    "total": 5,
    "queued": 1,
    "processing": 1,
    "completed": 3,
    "failed": 0
  },
  "storage": {
    "uploads_mb": "25.50",
    "outputs_mb": "12.30",
    "total_mb": "37.80"
  }
}
```

---

## 4. Enviar Imagem (POST /api/ai/submit)

### Com curl

```bash
# Gere uma API key
npm run generate-key
# Copie: sk_live_...

# Envie uma imagem
curl -X POST http://localhost:3000/api/ai/submit \
  -H "Authorization: Bearer sk_live_seu_token_aqui" \
  -F "image=@/path/to/image.png" \
  -F "workflow=catalog"

# Resposta (202 Accepted):
{
  "status": "queued",
  "job_id": "job_a1b2c3d4e5f6g7h8i9j0k1l2",
  "message": "Imagem recebida. Processamento iniciado.",
  "estimated_wait": "2-5 minutes",
  "polling_url": "/api/ai/status/job_a1b2c3d4e5f6g7h8i9j0k1l2"
}
```

### Com JavaScript/Fetch

```javascript
const token = 'sk_live_seu_token_aqui';
const imageFile = document.getElementById('fileInput').files[0];

const formData = new FormData();
formData.append('image', imageFile);
formData.append('workflow', 'catalog');

const response = await fetch('/api/ai/submit', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`
  },
  body: formData
});

const data = await response.json();
console.log(`Job ID: ${data.job_id}`);
// job_a1b2c3d4e5f6g7h8i9j0k1l2
```

### Com Python

```python
import requests

token = 'sk_live_seu_token_aqui'
headers = {'Authorization': f'Bearer {token}'}

with open('image.png', 'rb') as f:
    files = {'image': f}
    data = {'workflow': 'catalog'}

    response = requests.post(
        'http://localhost:3000/api/ai/submit',
        headers=headers,
        files=files,
        data=data
    )

result = response.json()
job_id = result['job_id']
print(f"Job ID: {job_id}")
```

---

## 5. Fazer Polling do Status (GET /api/ai/status/:jobId)

### Com curl

```bash
JOB_ID="job_a1b2c3d4e5f6g7h8i9j0k1l2"
TOKEN="sk_live_seu_token_aqui"

curl -H "Authorization: Bearer ${TOKEN}" \
  http://localhost:3000/api/ai/status/${JOB_ID}

# Resposta enquanto processa:
{
  "job_id": "job_a1b2c3d4e5f6g7h8i9j0k1l2",
  "status": "processing",
  "progress": 65,
  "message": "Processando... 65% concluído",
  "created_at": "2026-04-06T20:30:00Z",
  "started_at": "2026-04-06T20:31:00Z"
}

# Resposta quando completa:
{
  "job_id": "job_a1b2c3d4e5f6g7h8i9j0k1l2",
  "status": "completed",
  "progress": 100,
  "message": "Processamento concluído com sucesso!",
  "created_at": "2026-04-06T20:30:00Z",
  "started_at": "2026-04-06T20:31:00Z",
  "completed_at": "2026-04-06T20:36:32Z",
  "result": {
    "image_url": "/api/ai/result/job_a1b2c3d4e5f6g7h8i9j0k1l2",
    "processing_time": "5m 32s"
  }
}
```

### Com JavaScript (polling automático)

```javascript
const jobId = 'job_a1b2c3d4e5f6g7h8i9j0k1l2';
const token = 'sk_live_seu_token_aqui';

async function pollStatus() {
  const response = await fetch(`/api/ai/status/${jobId}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });

  const data = await response.json();

  console.log(`Status: ${data.status}`);
  console.log(`Progresso: ${data.progress}%`);

  if (data.status === 'completed') {
    console.log(`Resultado disponível em: ${data.result.image_url}`);
    return true;
  }

  if (data.status === 'failed') {
    console.error('Processamento falhou');
    return false;
  }

  // Ainda processando, tentar novamente em 2 segundos
  setTimeout(pollStatus, 2000);
}

pollStatus();
```

---

## 6. Baixar Resultado (GET /api/ai/result/:jobId)

### Com curl

```bash
JOB_ID="job_a1b2c3d4e5f6g7h8i9j0k1l2"
TOKEN="sk_live_seu_token_aqui"

curl -H "Authorization: Bearer ${TOKEN}" \
  http://localhost:3000/api/ai/result/${JOB_ID} \
  --output result.png

# result.png agora contém a imagem processada
```

### Com JavaScript

```javascript
const jobId = 'job_a1b2c3d4e5f6g7h8i9j0k1l2';
const token = 'sk_live_seu_token_aqui';

const response = await fetch(`/api/ai/result/${jobId}`, {
  headers: { 'Authorization': `Bearer ${token}` }
});

// Se ainda processando (202):
if (response.status === 202) {
  const data = await response.json();
  console.log(`Ainda processando: ${data.progress}%`);
  return;
}

// Se completo (200):
if (response.status === 200) {
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);

  // Mostrar em img tag
  document.getElementById('result').src = url;

  // Ou baixar
  const a = document.createElement('a');
  a.href = url;
  a.download = 'result.png';
  a.click();
}
```

---

## 7. Cancelar Job (DELETE /api/ai/job/:jobId)

```bash
JOB_ID="job_a1b2c3d4e5f6g7h8i9j0k1l2"
TOKEN="sk_live_seu_token_aqui"

curl -X DELETE \
  -H "Authorization: Bearer ${TOKEN}" \
  http://localhost:3000/api/ai/job/${JOB_ID}

# Resposta:
{
  "status": "cancelled",
  "job_id": "job_a1b2c3d4e5f6g7h8i9j0k1l2",
  "message": "Job cancelado com sucesso",
  "previous_status": "processing",
  "cancelled_at": "2026-04-06T20:35:45Z"
}
```

---

## 8. Fluxo Completo em Uma Função

### JavaScript

```javascript
async function processImageComplete(imageFile, workflowType = 'catalog') {
  const token = 'sk_live_seu_token_aqui';

  // 1. Enviar imagem
  console.log('📤 Enviando imagem...');
  const formData = new FormData();
  formData.append('image', imageFile);
  formData.append('workflow', workflowType);

  const submitResponse = await fetch('/api/ai/submit', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
    body: formData
  });

  if (submitResponse.status !== 202) {
    const error = await submitResponse.json();
    throw new Error(`Erro ao enviar: ${error.message}`);
  }

  const submitData = await submitResponse.json();
  const jobId = submitData.job_id;

  console.log(`✅ Job criado: ${jobId}`);
  console.log(`⏱️  Tempo estimado: ${submitData.estimated_wait}`);

  // 2. Fazer polling até completar
  console.log('⏳ Processando...');

  let status = 'processing';
  let progress = 0;

  while (status === 'processing' || status === 'queued') {
    const statusResponse = await fetch(`/api/ai/status/${jobId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    const statusData = await statusResponse.json();
    status = statusData.status;
    progress = statusData.progress;

    console.log(`${status}: ${progress}%`);

    if (status === 'completed' || status === 'failed') {
      break;
    }

    // Esperar 2 segundos antes de fazer novo polling
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  if (status === 'failed') {
    throw new Error('Processamento falhou');
  }

  // 3. Baixar resultado
  console.log('📥 Baixando resultado...');

  const resultResponse = await fetch(`/api/ai/result/${jobId}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });

  const blob = await resultResponse.blob();
  const resultUrl = URL.createObjectURL(blob);

  console.log('✅ Processamento completo!');

  return {
    jobId,
    imageUrl: resultUrl,
    processingTime: statusData.result.processing_time
  };
}

// Uso:
const fileInput = document.getElementById('imageInput');
const result = await processImageComplete(fileInput.files[0], 'catalog');

// Mostrar resultado
document.getElementById('resultImage').src = result.imageUrl;
console.log(`Processado em: ${result.processingTime}`);
```

### Python

```python
import requests
import time
import io
from pathlib import Path

def process_image_complete(image_path, workflow='catalog'):
    token = 'sk_live_seu_token_aqui'
    headers = {'Authorization': f'Bearer {token}'}
    base_url = 'http://localhost:3000'

    # 1. Enviar imagem
    print('📤 Enviando imagem...')
    with open(image_path, 'rb') as f:
        files = {'image': f}
        data = {'workflow': workflow}

        response = requests.post(
            f'{base_url}/api/ai/submit',
            headers=headers,
            files=files,
            data=data
        )

    if response.status_code != 202:
        raise Exception(f"Erro ao enviar: {response.json()['message']}")

    job_data = response.json()
    job_id = job_data['job_id']

    print(f'✅ Job criado: {job_id}')
    print(f'⏱️  Tempo estimado: {job_data["estimated_wait"]}')

    # 2. Fazer polling
    print('⏳ Processando...')
    status = 'processing'
    progress = 0

    while status in ['processing', 'queued']:
        response = requests.get(
            f'{base_url}/api/ai/status/{job_id}',
            headers=headers
        )

        status_data = response.json()
        status = status_data['status']
        progress = status_data['progress']

        print(f'{status}: {progress}%')

        if status in ['completed', 'failed']:
            break

        time.sleep(2)

    if status == 'failed':
        raise Exception('Processamento falhou')

    # 3. Baixar resultado
    print('📥 Baixando resultado...')

    response = requests.get(
        f'{base_url}/api/ai/result/{job_id}',
        headers=headers
    )

    if response.status_code == 200:
        # Salvar arquivo
        output_path = Path(image_path).stem + '_result.png'
        with open(output_path, 'wb') as f:
            f.write(response.content)

        print(f'✅ Processamento completo!')
        print(f'Resultado salvo em: {output_path}')

        return {
            'job_id': job_id,
            'output_path': str(output_path),
            'processing_time': status_data['result']['processing_time']
        }

# Uso:
result = process_image_complete('/path/to/image.png', 'catalog')
print(f"Processado em: {result['processing_time']}")
```

---

## 9. Tratamento de Erros

### Códigos de Erro Comum

| HTTP | Código | Significado |
|------|--------|-------------|
| 400 | INVALID_FILE_TYPE | Arquivo não é imagem válida |
| 400 | FILE_TOO_LARGE | Arquivo maior que 10MB |
| 401 | INVALID_TOKEN | Token inválido ou expirado |
| 404 | JOB_NOT_FOUND | Job não encontrado |
| 409 | CANNOT_CANCEL | Job já completou |
| 429 | RATE_LIMIT | Muitas requisições |
| 503 | COMFYUI_OFFLINE | ComfyUI não está respondendo |

### Exemplo de Tratamento

```javascript
async function handleError(response) {
  if (!response.ok) {
    const error = await response.json();

    console.error(`[${error.code}] ${error.message}`);

    if (response.status === 401) {
      console.error('Token inválido. Gere um novo com: npm run generate-key');
    }

    if (response.status === 429) {
      console.error(`Aguarde ${error.retry_after} segundos antes de tentar novamente`);
    }

    if (response.status === 503) {
      console.error('ComfyUI está offline. Inicie com: npm run dev');
    }

    throw new Error(error.message);
  }
}
```

---

## 10. Próximas Etapas

Depois de testar, você está pronto para:

- ✅ ETAPA 8: Cloudflare Tunnel (expor API com segurança)
- ✅ ETAPA 9: Produção (migrations, logging, monitoring)
- ✅ ETAPA 10: Scale up (fila externa, GPU cloud)
