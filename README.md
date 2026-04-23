# PyTorch Mastery

LeetCode-style PyTorch practice platform. Runs locally on your machine.

## Stack

- **Frontend**: Next.js 14 + TypeScript + Tailwind CSS + shadcn/ui + Monaco Editor
- **Backend**: FastAPI + Pydantic + Uvicorn
- **Runner**: Subprocess-based PyTorch code execution with test harness
- **Problems**: YAML-defined curriculum (4 weeks, 21 problems)

## Quick Start (Local Dev)

### Backend

```bash
cd backend
uv venv
uv pip install -r requirements.txt
uv pip install torch --index-url https://download.pytorch.org/whl/cpu
uv run uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:3000

## Docker

```bash
docker-compose up --build
```

> Note: Docker Desktop on macOS does not expose MPS to Linux containers. The Dockerized backend uses CPU PyTorch. For MPS acceleration, run the backend natively as shown above.

## Problem Format

Problems are defined in `backend/problems/*.yml`:

```yaml
id: tf1
title: Create Matching Tensor
day: 1
week: 1
difficulty: Easy
focus: Device/dtype/shape awareness
description: |
  Write a function `create_matching_tensor(x)` ...
starter_code: |
  import torch
  def create_matching_tensor(x: torch.Tensor) -> torch.Tensor:
      pass
function_name: create_matching_tensor
test_cases:
  visible:
    - name: CPU Float32
      inputs:
        x: torch.ones(3, 4, dtype=torch.float32)
      expected:
        shape: [3, 4]
        dtype: float32
  hidden:
    - name: Non-contiguous
      inputs:
        x: torch.randn(4, 4).t()
      expected:
        shape: [4, 4]
validation:
  type: match_tensor
```

Validation types: `allclose`, `equality`, `match_tensor`, `length`

## Curriculum

| Week | Day | Problems | Focus |
|------|-----|----------|-------|
| 1 | 1 | TF1, TF2 | Tensors, broadcasting |
| 1 | 2 | SH1, SH2 | Shape ops, memory layout |
| 1 | 3 | AG1, AG2 | Autograd, custom functions |
| 2 | 4 | NN1, ACT2 | nn.Module, activations |
| 2 | 5 | LF1, BN1 | Loss functions, batch norm |
| 2 | 6 | DR1 | Dropout |
| 3 | 7 | TL1, TL2 | Training loops, grad accumulation |
| 3 | 8 | OPT2, SCH1 | Optimizers, LR scheduling |
| 3 | 9 | ATT1 | Attention mechanisms |
| 4 | 10 | SH3, CV1 | Im2Col, convolutions |
| 4 | 11 | MHA1, RES1 | Multi-head attention, residuals |
| 4 | 12 | DL1 | Data loading, sampling |

## Adding Problems

1. Create a new `.yml` file in `backend/problems/`
2. Define `id`, `title`, `description`, `starter_code`, `function_name`, `test_cases`, and `validation`
3. Restart the backend (or it auto-reloads)
