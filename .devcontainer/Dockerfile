FROM mcr.microsoft.com/devcontainers/base:debian

# Install essential build tools
RUN apt-get update && export DEBIAN_FRONTEND=noninteractive \
    && apt-get -y install --no-install-recommends \
    curl \
    build-essential \
    gnupg \
    && apt-get clean -y \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js 20.x (for TypeScript/JavaScript modules)
# Modules: app/webapp, storage/data-service, storage/timescale-writer, 
#          ingress/mqtt_subscriber_nodejs, analytics/job-submission-service
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && npm install -g pnpm@10.33.2

# Install Rust
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --default-toolchain stable \
    && . "$HOME/.cargo/env" \
    && rustup component add rustfmt clippy \
    && echo 'source $HOME/.cargo/env' >> /etc/bash.bashrc \
    && echo 'source $HOME/.cargo/env' >> /etc/zsh/zshrc || true

# Install Python 3 and pip
RUN apt-get update && export DEBIAN_FRONTEND=noninteractive \
    && apt-get -y install --no-install-recommends \
    python3 \
    python3-pip \
    python3-venv \
    && apt-get clean -y \
    && rm -rf /var/lib/apt/lists/*

# Add Rust to PATH for all users (fallback if shell configs aren't sourced)
ENV PATH="/root/.cargo/bin:${PATH}"

WORKDIR /workspace