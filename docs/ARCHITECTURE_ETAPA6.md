# 🏗️ Arquitetura - ETAPA 6

## Serviços Implementados

```
┌─────────────────────────────────────────────────────────┐
│                    CAMADA DE SERVIÇOS                    │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  ┌────────────────────────────────────────────────────┐ │
│  │          ComfyUIService                            │ │
│  │  ✓ submitWorkflow(workflow)                        │ │
│  │  ✓ getStatus(promptId)                             │ │
│  │  ✓ getHistory(promptId)                            │ │
│  │  ✓ createWorkflow(config)                          │ │
│  │  ✓ healthCheck()                                   │ │
│  │  ✓ extractImagePath(result)                        │ │
│  └────────────────────────────────────────────────────┘ │
│                           │                              │
│           ┌───────────────┼───────────────┐             │
│           ▼               ▼               ▼             │
│  ┌─────────────────┐ ┌──────────────┐ ┌────────────┐   │
│  │  JobService     │ │ StorageService││ ComfyUI    │   │
│  │                 │ │               ││ (local)    │   │
│  │ ✓ createJob()   │ │ ✓ saveUpload()││            │   │
│  │ ✓ updateStatus()│ │ ✓ saveResult()││ localhost: │   │
│  │ ✓ completeJob() │ │ ✓ readFile()  ││ 8188      │   │
│  │ ✓ failJob()     │ │ ✓ deleteFile()││            │   │
│  │ ✓ cancelJob()   │ │ ✓ getDiskUsage││            │   │
│  │ ✓ getStats()    │ │               ││            │   │
│  └─────────────────┘ └──────────────┘ └────────────┘   │
│        │                    │                           │
│        └─ armazena estado   └─ gerencia arquivos       │
│           do job (memory)       (filesystem)            │
│                                                           │
└─────────────────────────────────────────────────────────┘
```

---

## Fluxo de Dados

```
USER REQUEST
    │
    ▼
┌─────────────────────────────┐
│ 1. Receber arquivo (multer) │
└─────────────────────────────┘
    │
    ▼
┌───────────────────────────────────┐
│ 2. StorageService.saveUpload()    │
│    → /storage/uploads/job_xyz.png │
└───────────────────────────────────┘
    │
    ▼
┌──────────────────────────────────┐
│ 3. JobService.createJob()        │
│    → {id, status: queued, ...}   │
└──────────────────────────────────┘
    │
    ▼
┌──────────────────────────────────┐
│ 4. ComfyUIService.createWorkflow()│
│    → workflow JSON               │
└──────────────────────────────────┘
    │
    ▼
┌──────────────────────────────────┐
│ 5. ComfyUIService.submitWorkflow()│
│    → ComfyUI /prompt endpoint    │
│    → promptId "abc123xyz"        │
└──────────────────────────────────┘
    │
    ▼
┌──────────────────────────────────┐
│ 6. JobService.startJob()         │
│    → status: processing          │
└──────────────────────────────────┘
    │
    ▼
┌──────────────────────────────────┐
│ 7. Return 202 Accepted           │
│    → job_id, polling_url         │
└──────────────────────────────────┘

═══════════════════════════════════════════════════════════════

POLLING LOOP (Client)
    │
    ▼
┌────────────────────────────────────────┐
│ GET /api/ai/status/job_xyz             │
└────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────┐
│ 8. ComfyUIService.getStatus(promptId)   │
│    → Check /history endpoint            │
│    → Retornar status                    │
└─────────────────────────────────────────┘
    │
    ├─ queued → wait
    ├─ processing → progress 50%
    │
    └─ completed
        │
        ▼
    ┌──────────────────────────────────┐
    │ 9. ComfyUIService.extractImagePath│
    │    → resultado.png                │
    └──────────────────────────────────┘
        │
        ▼
    ┌──────────────────────────────────┐
    │ 10. JobService.completeJob()     │
    │     → status: completed          │
    │     → save output path           │
    └──────────────────────────────────┘
        │
        ▼
    ┌──────────────────────────────────┐
    │ 11. Return result_url            │
    └──────────────────────────────────┘
        │
        ▼
    ┌──────────────────────────────────┐
    │ GET /api/ai/result/job_xyz       │
    │ → StorageService.readFile()      │
    │ → Send image buffer              │
    └──────────────────────────────────┘
```

---

## Estados do Job

```
       ┌────────┐
       │ QUEUED │ ← Job criado, aguardando processamento
       └────┬───┘
            │
            ▼
       ┌────────────┐
       │ PROCESSING │ ← ComfyUI está processando
       └────┬───────┘
            │
        ┌───┴────────────┬──────────────┐
        │                │              │
    COMPLETED        FAILED       CANCELLED
        │                │              │
        ▼                ▼              ▼
      ✓ OK          ✗ ERROR        ⊘ USER
    (resultado)   (erro msg)     (cancelado)
```

---

## Storage Layout

```
storage/
├── uploads/              ← Imagens recebidas
│   ├── job_abc123.png
│   ├── job_def456.jpg
│   └── ...
├── outputs/              ← Resultados processados
│   ├── job_abc123_result.png
│   ├── job_def456_result.png
│   └── ...
└── temp/                 ← Arquivos temporários
    └── (limpeza automática após 24h)
```

---

## Memory Storage (Job State)

```typescript
// JobService mantém em memória:
{
  "job_abc123xyz789": {
    id: "job_abc123xyz789",
    status: "completed",
    workflowType: "catalog",
    inputImagePath: "/storage/uploads/job_abc123xyz789.png",
    outputImagePath: "/storage/outputs/job_abc123xyz789_result.png",
    comfyuiPromptId: "xyz789",
    createdAt: 2026-04-06T20:30:00Z,
    startedAt: 2026-04-06T20:31:00Z,
    completedAt: 2026-04-06T20:35:32Z,
    progress: 100
  },
  "job_def456uvw012": {
    // outro job...
  }
}
```

**Nota**: Para produção, migrar para SQLite/PostgreSQL

---

## Integração com ComfyUI

### Workflow enviado

```json
{
  "1": {
    "class_type": "LoadImage",
    "inputs": {
      "image": "/absolute/path/to/image.png"
    }
  },
  "2": {
    "class_type": "RemoveBackground",
    "inputs": {
      "image": ["1", 0]
    }
  },
  "3": {
    "class_type": "SaveImage",
    "inputs": {
      "images": ["2", 0],
      "filename_prefix": "catalog_output"
    }
  }
}
```

### Endpoints do ComfyUI usados

| Endpoint | Método | Descrição |
|----------|--------|-----------|
| `/prompt` | POST | Enviar workflow |
| `/history` | GET | Buscar resultados |
| `/system_stats` | GET | Health check |
| `/interrupt` | POST | Cancelar job (futuro) |

---

## Tratamento de Erros

```
❌ ERRO POSSÍVEL              → CÓDIGO                → HTTP STATUS
─────────────────────────────────────────────────────────────────
ComfyUI offline              COMFYUI_CONNECTION_ERROR  503
Arquivo inválido             INVALID_FILE_TYPE         400
Arquivo muito grande         FILE_TOO_LARGE            413
Job não encontrado           JOB_NOT_FOUND             404
Não pode cancelar            CANNOT_CANCEL             409
Erro ao processar            COMFYUI_ERROR             500
Storage erro                 STORAGE_ERROR             500
```

---

## Estatísticas Disponíveis

```typescript
jobService.getStats()
// Retorna:
{
  total: 45,        // Total de jobs
  queued: 5,        // Aguardando processamento
  processing: 2,    // Sendo processados agora
  completed: 35,    // Concluídos com sucesso
  failed: 3         // Falhados
}

storageService.getDiskUsage()
// Retorna:
{
  uploads: 1048576,     // 1 MB de uploads
  outputs: 2097152,     // 2 MB de resultados
  total: 3145728        // 3 MB total
}
```

---

## Próxima Etapa (ETAPA 7)

Os controladores vão usar esses serviços para:

```
REQUEST → CONTROLLER → SERVICES → ComfyUI
                          ↓
                      JobService
                      StorageService
                      ComfyUIService
                          ↓
RESPONSE ← CONTROLLER ← RESULT
```

Exemplo controlador:

```typescript
// controllers/aiController.ts
async submitJob(req: Request, res: Response) {
  // 1. Validar arquivo
  // 2. Chamar storageService.saveUpload()
  // 3. Chamar jobService.createJob()
  // 4. Chamar comfyuiService.createWorkflow()
  // 5. Chamar comfyuiService.submitWorkflow()
  // 6. Retornar 202 com job_id
}
```
