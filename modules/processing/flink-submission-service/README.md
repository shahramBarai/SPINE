# Flink Submission Worker

> **Internal service — not exposed to the UI layer.**

## Purpose

This is the Python-based Flink submission worker for the SPINE processing pipeline.  
It receives a prepared job bundle, validates it, and submits it to a running **Flink Session Cluster** via the Flink CLI.

---

## What it does

| Responsibility | Detail |
|---|---|
| Bundle validation | Verifies all referenced paths (entrypoint, pyfiles, requirements) exist. |
| Python syntax check | Parses `main.py` with `ast.parse` to catch syntax errors without executing the script. |
| Module syntax check | Parses every `*.py` file under `pyfiles/` with `ast.parse`. |
| Import check | Imports the entrypoint module with `PYTHONPATH=<pyfiles_path>` set, in an isolated subprocess. |
| Flink submission | Builds and executes the detached `flink run` command. |
| Output capture | Returns `stdout`, `stderr`, `returncode`, and the parsed `job_id`. |

---

## What it does NOT do

- Generate Python code from JSON schema — that is the **NodeJS service**.
- Bundle generation or metadata management.
- Any UI-facing or user-auth logic.
- Kafka, MinIO, or PostgreSQL integration.
- Savepoint / checkpoint management.
- Multi-job orchestration.
- Async task queue management.

---

## Directory structure

```
flink-submission-service/
├── app/
│   ├── main.py          # FastAPI app + routes
│   ├── models.py        # Pydantic request/response models
│   ├── settings.py      # Configurable defaults / env vars
│   ├── validator.py     # Pre-submit validation logic
│   ├── submitter.py     # Flink CLI builder + executor
│   ├── parser.py        # job_id regex extractor
│   └── exceptions.py    # Custom exception types
├── requirements.txt
├── Dockerfile
└── README.md
```

---

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `FLINK_JOBMANAGER` | `jobmanager:8081` | Flink JobManager REST address |
| `FLINK_BIN` | `flink` | Path to the `flink` CLI binary |
| `CHECK_TIMEOUT` | `30` | Seconds before pre-submit checks time out |
| `SUBMIT_TIMEOUT` | `120` | Seconds before `flink run` times out |

---

## API endpoints

### `GET /health`

Liveness probe.

```
GET http://localhost:8000/health
```

**Response**
```json
{ "status": "ok" }
```

---

### `POST /submit`

Validate a job bundle and submit it to the Flink Session Cluster.

```
POST http://localhost:8000/submit
Content-Type: application/json
```

**Request body**

```json
{
  "entrypoint": "/workspace/job_bundle/main.py",
  "pyfiles_path": "/workspace/job_bundle/pyfiles",
  "requirements_path": "/workspace/job_bundle/requirements.txt"
}
```

**Successful response**

```json
{
  "success": true,
  "command": [
    "flink", "run", "--detached",
    "--jobmanager", "jobmanager:8081",
    "--python", "/workspace/job_bundle/main.py",
    "--pyFiles", "/workspace/job_bundle/pyfiles",
    "--pyRequirements", "/workspace/job_bundle/requirements.txt"
  ],
  "returncode": 0,
  "stdout": "Job has been submitted with JobID abcdef1234567890abcdef1234567890",
  "stderr": "",
  "job_id": "abcdef1234567890abcdef1234567890",
  "validation": {
    "success": true,
    "steps": [
      { "step": "bundle.entrypoint_exists",     "success": true, ... },
      { "step": "bundle.pyfiles_path_exists",   "success": true, ... },
      { "step": "bundle.requirements_path_exists", "success": true, ... },
      { "step": "py_compile.entrypoint",        "success": true, ... },
      { "step": "compileall.pyfiles",           "success": true, ... },
      { "step": "import_check.entrypoint",      "success": true, ... }
    ]
  }
}
```

**Validation failure response** (Flink is NOT called)

```json
{
  "success": false,
  "command": [],
  "returncode": -1,
  "stdout": "",
  "stderr": "Pre-submit validation failed",
  "job_id": null,
  "validation": {
    "success": false,
    "steps": [ ... ],
    "error": "Import check failed on entrypoint"
  }
}
```

---

## How validation works

The validation pipeline runs in order and **stops at the first failure**:

1. **Path existence checks** — `pathlib.Path.is_file()` / `.is_dir()`. No subprocess.
2. **AST syntax check on entrypoint** — `ast.parse(<entrypoint source>)`. Catches syntax errors in `main.py` without executing it.
3. **AST syntax check on pyfiles** — `ast.parse(<module source>)` for each `*.py` file under `pyfiles_path`. Catches syntax errors in all bundle modules.
4. **Import check** — Runs `python -c "import main"` with `PYTHONPATH=<pyfiles_path>:<entrypoint_dir>` in an isolated subprocess. Simulates Flink's `--pyFiles` injection.

Each step returns structured detail: step name, command executed, success flag, stdout, stderr.

---

## How submit works

If all validation steps pass, the worker builds:

```
flink run
  --jobmanager <jobmanager_address>
  --python     <entrypoint>
  [--pyFiles        <pyfiles_path>]
  [--pyRequirements <requirements_path>]
```

The command is executed with `subprocess.run(capture_output=True, text=True, timeout=<SUBMIT_TIMEOUT>)`.

The output is parsed with a regex to extract the `job_id` from patterns like:

```
Job has been submitted with JobID <32-char-hex>
```

---

## Running locally (development)

> **Note for Debian / Ubuntu users:** Modern Debian-based systems (Ubuntu 23.04+, Debian 12+) mark the
> system Python as *externally managed* (PEP 668). Running `pip install` directly will fail with:
> ```
> error: externally-managed-environment
> ```
> Always use a **virtual environment** instead.

### 1 — Create and activate a virtual environment

```bash
cd modules/processing/flink-submission-service

# Create the venv (once)
python3 -m venv .venv

# Activate it (every new shell session)
source .venv/bin/activate
```

> On Windows (PowerShell inside WSL you can also use `.venv/bin/activate`; inside native PowerShell use `.venv\Scripts\Activate.ps1`).

### 2 — Install dependencies

```bash
pip install -r requirements.txt
```

### 3 — Start the service

```bash
uvicorn app.main:app --reload --port 8000
```

Interactive API docs: http://localhost:8000/docs

---

## Running with Docker

```bash
docker build -t flink-submission-worker .
docker run --rm -p 8000:8000 \
  -e FLINK_JOBMANAGER=flink-jobmanager:8081 \
  flink-submission-worker
```

> **Note:** In Phase 1 the Docker image is a plain Python image. The `flink` CLI binary is **not** present.  
> To perform real submissions you must switch the base image to a Flink-compatible image (see the Dockerfile comments).

---

## Future integration notes

### NodeJS ↔ Python worker boundary

```
NodeJS service                       Python submission worker
──────────────────────────────       ────────────────────────────────────────
• JSON schema → Python code          • Validate prepared bundle
• Bundle generation                  • Run pre-submit Python checks
• Metadata / tracking                • Submit via Flink CLI
• UI communication                   • Return job_id / structured result
• Kafka / MinIO coordination         (internal only)
```

The worker is stateless and idempotent by design: it only reads the filesystem paths provided in the request and calls Flink.

### Phase 2 – Flink-compatible image

Replace the `FROM python:3.11-slim` base in `Dockerfile` with the same `flink:1.18.1` image used by the cluster. See comments inside the Dockerfile.

### Phase 3 – Kafka trigger

Rather than HTTP polling, the NodeJS service can publish a submit event to a Kafka topic. A future version of this worker can consume that topic using `aiokafka` or similar, replacing the FastAPI `/submit` endpoint.
