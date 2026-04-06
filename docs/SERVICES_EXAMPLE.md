# 📚 Exemplos de Uso dos Serviços

Este documento mostra como usar os serviços criados na ETAPA 6.

---

## 1. ComfyUIService

### Verificar Conectividade

```typescript
import { comfyuiService } from '../services/comfyuiService.js';

const isConnected = await comfyuiService.healthCheck();
console.log(`ComfyUI conectado: ${isConnected}`);
```

### Criar e Enviar Workflow

```typescript
// 1. Criar workflow
const workflow = comfyuiService.createCatalogWorkflow('/path/to/image.png');

// 2. Enviar para ComfyUI
const promptId = await comfyuiService.submitWorkflow(workflow);
console.log(`Workflow submetido com ID: ${promptId}`);
```

### Fazer Polling do Status

```typescript
// Verificar status continuamente
const interval = setInterval(async () => {
  const status = await comfyuiService.getStatus(promptId);

  console.log(`Status: ${status.status}`);
  console.log(`Progresso: ${status.progress}%`);

  if (status.status === 'completed') {
    clearInterval(interval);

    // Extrair caminho da imagem
    const imagePath = comfyuiService.extractImagePath(status.result!);
    console.log(`Imagem salva em: ${imagePath}`);
  }
}, 2000); // Check a cada 2 segundos
```

### Suportar Diferentes Tipos de Workflow

```typescript
// Catalog (remover fundo)
const catalogWorkflow = comfyuiService.createWorkflow({
  type: 'catalog',
  inputImagePath: '/path/to/image.png',
  options: { quality: 'high' }
});

// Portrait (retoque)
const portraitWorkflow = comfyuiService.createWorkflow({
  type: 'portrait',
  inputImagePath: '/path/to/image.png',
  options: { format: 'png' }
});

// Enviar qualquer um
const promptId = await comfyuiService.submitWorkflow(catalogWorkflow);
```

---

## 2. JobService

### Criar Novo Job

```typescript
import { jobService } from '../services/jobService.js';
import { v4 as uuidv4 } from 'uuid';

const jobId = `job_${uuidv4()}`;
const promptId = 'abc123xyz';

const job = jobService.createJob(
  jobId,
  'catalog',
  '/storage/uploads/job_xyz.png',
  promptId
);

console.log(`Job criado: ${job.id}`);
```

### Atualizar Status

```typescript
// Job iniciado
jobService.startJob(jobId);

// Atualizar progresso
jobService.updateProgress(jobId, 25);
jobService.updateProgress(jobId, 50);
jobService.updateProgress(jobId, 75);

// Job completo
jobService.completeJob(jobId, '/storage/outputs/job_xyz_result.png');
```

### Lidar com Erros

```typescript
try {
  // Algo deu errado
  jobService.failJob(jobId, 'Erro ao processar: modelo não encontrado');
} catch (error) {
  console.error(error);
}
```

### Recuperar Informações

```typescript
// Get job
const job = jobService.getJob(jobId);
console.log(`Status: ${job?.status}`);
console.log(`Progresso: ${job?.progress}%`);

// Posição na fila
const position = jobService.getQueuePosition(jobId);
console.log(`Posição na fila: ${position}`);

// Estatísticas
const stats = jobService.getStats();
console.log(`Jobs em fila: ${stats.queued}`);
console.log(`Processando: ${stats.processing}`);
```

### Cancelar Job

```typescript
try {
  jobService.cancelJob(jobId);
  console.log('Job cancelado');
} catch (error) {
  console.error(error.message);
  // "Job já está concluído. Não pode ser cancelado."
}
```

---

## 3. StorageService

### Salvar Upload

```typescript
import { storageService } from '../services/storageService.js';

// Buffer vem de multer ou similar
const filepath = await storageService.saveUpload(
  buffer, // Buffer do arquivo
  'image.png', // Nome original
  jobId // ID do job
);

console.log(`Salvo em: ${filepath}`);
// Resultado: /storage/uploads/job_xyz.png
```

### Salvar Resultado

```typescript
// Depois que ComfyUI processar
const resultPath = await storageService.saveResult(
  resultBuffer,
  jobId,
  'png' // formato
);

console.log(`Resultado salvo em: ${resultPath}`);
```

### Ler Arquivo

```typescript
const buffer = await storageService.readFile(filepath);
// Usar para enviar como resposta HTTP
```

### Deletar Arquivo

```typescript
await storageService.deleteFile(filepath);
console.log('Arquivo deletado');
```

### Obter Informações

```typescript
// Tamanho de um arquivo
const size = await storageService.getFileSize(filepath);
console.log(`Tamanho: ${size} bytes`);

// Uso de disco
const usage = await storageService.getDiskUsage();
console.log(`Total armazenado: ${usage.total} bytes`);
console.log(`Uploads: ${usage.uploads} bytes`);
console.log(`Resultados: ${usage.outputs} bytes`);
```

---

## 4. Fluxo Completo: Upload → Processamento → Resultado

```typescript
import { v4 as uuidv4 } from 'uuid';
import { comfyuiService } from '../services/comfyuiService.js';
import { jobService } from '../services/jobService.js';
import { storageService } from '../services/storageService.js';

async function processImage(
  imageBuffer: Buffer,
  originalFilename: string,
  workflowType: 'catalog' | 'portrait'
) {
  // 1. Criar job
  const jobId = `job_${uuidv4()}`;
  let job = jobService.createJob(jobId, workflowType, '', '');

  try {
    // 2. Salvar upload
    const uploadPath = await storageService.saveUpload(
      imageBuffer,
      originalFilename,
      jobId
    );

    // 3. Criar workflow
    const workflow = comfyuiService.createWorkflow({
      type: workflowType,
      inputImagePath: uploadPath,
      options: { quality: 'high' }
    });

    // 4. Verificar conectividade
    const isConnected = await comfyuiService.healthCheck();
    if (!isConnected) {
      jobService.failJob(jobId, 'ComfyUI offline');
      return null;
    }

    // 5. Enviar para ComfyUI
    const promptId = await comfyuiService.submitWorkflow(workflow);
    jobService.createJob(jobId, workflowType, uploadPath, promptId);
    jobService.startJob(jobId);

    // 6. Polling do status
    return new Promise<string | null>((resolve, reject) => {
      let attempts = 0;
      const maxAttempts = 150; // 5 minutos com checks a cada 2s
      const pollInterval = 2000; // 2 segundos

      const poll = async () => {
        attempts++;

        const status = await comfyuiService.getStatus(promptId);
        jobService.updateProgress(jobId, status.progress || 0);

        if (status.status === 'completed') {
          // 7. Extrair resultado
          const imagePath = comfyuiService.extractImagePath(status.result!);

          if (imagePath) {
            jobService.completeJob(jobId, imagePath);
            resolve(imagePath);
          } else {
            jobService.failJob(jobId, 'Resultado não encontrado');
            resolve(null);
          }

          clearInterval(interval);
        } else if (status.status === 'failed') {
          jobService.failJob(jobId, 'Erro no ComfyUI');
          resolve(null);
          clearInterval(interval);
        } else if (attempts >= maxAttempts) {
          jobService.failJob(jobId, 'Timeout');
          resolve(null);
          clearInterval(interval);
        }
      };

      const interval = setInterval(poll, pollInterval);
      poll(); // Primeiro check imediato
    });

  } catch (error) {
    jobService.failJob(jobId, error instanceof Error ? error.message : 'Unknown error');
    return null;
  }
}

// Uso:
const result = await processImage(
  imageBuffer,
  'foto.png',
  'catalog'
);

if (result) {
  console.log(`Processado com sucesso: ${result}`);
} else {
  console.log('Processamento falhou');
}
```

---

## 5. Tratamento de Erros

```typescript
import { ApiError } from '../middleware/errorHandler.js';

try {
  await comfyuiService.submitWorkflow(workflow);
} catch (error) {
  if (error instanceof ApiError) {
    // Erro esperado
    console.log(`${error.code}: ${error.message}`);
    // Responder ao cliente com status apropriado
  } else {
    // Erro inesperado
    console.error('Erro desconhecido:', error);
  }
}
```

---

## 6. Próximas Etapas

Esses serviços estão prontos para serem usados nos **Controladores** (ETAPA 7).

Os controladores vão:
- Receber requisições HTTP
- Validar input
- Chamar os serviços apropriados
- Retornar resposta ao cliente
