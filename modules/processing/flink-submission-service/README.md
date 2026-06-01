# Flink Submission Service

> Internal service. It is not exposed to the UI layer.

## Purpose

This service validates PyFlink job uploads and submits them to a running Flink Session Cluster via the Flink CLI.

It supports two upload-based submission modes:

- Single `.py` upload, stored as `main.py` in a temporary directory
- Zip bundle upload with a strict bundle layout

## What it does

- Accepts multipart file uploads
- Checks uploaded files for basic validity before submission
- Parses Python files with `ast.parse` to catch syntax errors
- Runs an isolated import check for the entrypoint
- Validates zip archives and extracts them to a temporary directory
- Builds and executes a detached `flink run` command
- Parses the Flink CLI output to extract a job ID when available

## Project layout

```text
flink-submission-service/
├── app/
│   ├── api/
│   │   └── submit.py
│   ├── core/
│   │   ├── submission/
│   │   └── validation/
│   ├── schemas/
│   ├── utils/
│   └── main.py
├── test/
│   └── test_zip_submission.py
├── Dockerfile
├── requirements.txt
└── README.md
```

## Configuration

Environment variables used by the service:

| Variable              | Default                  | Description                                   |
| --------------------- | ------------------------ | --------------------------------------------- |
| `FLINK_JOBMANAGER`    | `jobmanager:8081`        | Flink JobManager REST address                 |
| `FLINK_BIN`           | `flink`                  | Path to the `flink` CLI binary                |
| `CHECK_TIMEOUT`       | `30`                     | Seconds before pre-submit checks time out     |
| `SUBMIT_TIMEOUT`      | `120`                    | Seconds before `flink run` times out          |
| `MAX_ZIP_SIZE_MB`     | `1`                      | Maximum allowed size for zip uploads          |
| `TEMP_EXTRACTION_DIR` | `/tmp/flink-submissions` | Temporary directory for extracted zip uploads |

## API endpoints

### `GET /health`

Liveness probe.

```bash
curl http://localhost:8000/health
```

Example response:

```json
{ "status": "ok" }
```

### `POST /submit-file`

Upload a single `.py` file. The file is saved as `main.py` in a temporary directory and submitted as a one-file job.

```bash
curl -X POST http://localhost:8000/submit-file \
  -F "file=@main.py"
```

Validation for this endpoint:

- The uploaded file must end in `.py`
- The uploaded file must not be empty
- The file is copied to a temporary `main.py`
- The same pre-submit checks used for extracted bundles are then applied

### `POST /submit-zip`

Upload a zip bundle with a strict root layout:

- `main.py` at the root is required
- `requirements.txt` at the root is optional
- `modules/` is optional and may contain only `.py` files

```bash
curl -X POST http://localhost:8000/submit-zip \
  -F "file=@job_bundle.zip"
```

Validation for this endpoint:

- The zip must be valid and within the configured size limit
- Only `main.py`, optional `requirements.txt`, and optional `modules/` content are allowed
- Files inside `modules/` must be Python files with no nested subdirectories
- `main.py` must exist at the zip root
- The extracted bundle is then checked with the same pre-submit pipeline as `submit-file`

## Validation flow

The worker validates inputs in order and stops at the first failure:

1. Path existence checks for the extracted or staged bundle
2. `ast.parse` on the entrypoint
3. `ast.parse` on every Python file under the bundle directory when extra files are present
4. Import check in an isolated subprocess with `PYTHONPATH` configured

For zip uploads, validation also checks:

- Zip integrity
- Maximum archive size
- Root-level file restrictions
- Presence of `main.py`
- `modules/` folder rules

## Submission flow

If validation passes, the worker runs a detached Flink submission using the configured JobManager address and captures:

- `stdout`
- `stderr`
- `returncode`
- Parsed `job_id` when Flink prints one

The Flink command includes `--python` for the entrypoint, and `--pyFiles` or `--pyRequirements` when the staged bundle provides them.

## Local development

### 1. Create and activate a virtual environment

```bash
cd modules/processing/flink-submission-service
python3 -m venv .venv
source .venv/bin/activate
```

### 2. Install dependencies

```bash
pip install -r requirements.txt
```

### 3. Run the service

```bash
uvicorn app.main:app --reload --port 8000
```

OpenAPI docs:

- http://localhost:8000/docs
- http://localhost:8000/redoc

## Docker

The Docker image is based on a Flink-compatible image and includes Python plus the dependencies needed by this worker.

```bash
docker build -t flink-submission-worker .
docker run --rm -p 8000:8000 \
  -e FLINK_JOBMANAGER=flink-jobmanager:8081 \
  flink-submission-worker
```

## Notes

- This service is internal and should not be exposed directly to end users.
- Temporary extraction directories are cleaned up after requests complete.
