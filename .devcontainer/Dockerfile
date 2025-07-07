FROM mcr.microsoft.com/vscode/devcontainers/typescript-node:1-20-bullseye

# Install additional tools
RUN apt-get update && export DEBIAN_FRONTEND=noninteractive \
    && apt-get -y install --no-install-recommends \
    git \
    curl \
    vim \
    && apt-get clean -y \
    && rm -rf /var/lib/apt/lists/*

# Install pnpm globally
RUN npm install -g pnpm@latest

# Install npm@11.4.2
RUN npm install -g npm@11.4.2

# Install common global packages for Next.js development
RUN npm install -g \
    typescript \
    @types/node \
    turbo \
    eslint \
    prettier

WORKDIR /workspace