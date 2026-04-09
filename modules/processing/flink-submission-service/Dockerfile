# =============================================================================
# Flink Submission Worker – Dockerfile
# =============================================================================

FROM flink:1.18.1

# --------------------------------------------------------------------------- #
# System dependencies
# --------------------------------------------------------------------------- #
RUN apt-get update -y && \
    apt-get install -y --no-install-recommends curl python3 python3-pip && \
    rm -rf /var/lib/apt/lists/*

RUN ln -s /usr/bin/python3 /usr/bin/python

# --------------------------------------------------------------------------- #
# Application setup
# --------------------------------------------------------------------------- #
WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app/ ./app/

# --------------------------------------------------------------------------- #
# Start uvicorn
# --------------------------------------------------------------------------- #
CMD ["python3", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
