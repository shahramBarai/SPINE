# Contribution Guide

Welcome to SPINE! This guide will help you get started with contributing to our IoT platform project.

## Table of Contents

- [Getting Started](#getting-started)
- [How to Contribute](#how-to-contribute)
- [Development Workflow](#development-workflow)
- [Pull Request Process](#pull-request-process)
- [Issue Reporting](#issue-reporting)
- [Getting Help](#getting-help)

## Getting Started

### Prerequisites

Before you begin, make sure you have:

- **Git** installed on your system
- **Docker** and **Docker Compose** (v2.20+)
- **Node.js 20+** with **pnpm**
- **VS Code** (recommended for Dev Container support)

### First-Time Setup

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/spine.git
   cd spine
   ```
3. **Add upstream remote**:
   ```bash
   git remote add upstream https://github.com/original-org/spine.git
   ```
4. **Follow the setup guide** in our [README.md](../../README.md#development-setup)

## How to Contribute

### Types of Contributions

We welcome various types of contributions:

- **🐛 Bug fixes** - Help us fix issues and improve stability
- **✨ New features** - Add functionality that benefits the community
- **📚 Documentation** - Improve guides, examples, and API docs
- **🧪 Testing** - Add tests or improve existing test coverage
- **🎨 UI/UX improvements** - Enhance the user experience
- **🔧 Refactoring** - Improve code quality and maintainability
- **🎓 Academic research** - Share findings and collaborate on research

### Finding Something to Work On

- **Good first issues** - Look for issues labeled [`good first issue`](https://github.com/shahramBarai/spine/issues?q=label%3A%22good+first+issue%22)
- **Help wanted** - Check issues labeled [`help wanted`](https://github.com/shahramBarai/spine/issues?q=label%3A%22help+wanted%22)
- **Documentation** - Browse for areas needing better documentation
- **Your own ideas** - Propose new features by opening an issue first

## Development Workflow

### 1. Before You Start

- **Check existing issues** to avoid duplicate work
- **Open an issue** for significant changes or new features
- **Discuss your approach** with maintainers if unsure

### 2. Creating Your Branch

```bash
# Make sure you're on main and it's up to date
git checkout main
git pull upstream main

# Create a new branch for your work
git checkout -b feature/your-feature-name
# or
git checkout -b fix/issue-number-description
```

### 3. Making Changes

- **Follow our coding standards** (see [Developer Guide](./developer_guide.md))
- **Write clear commit messages**
- **Add tests** for new functionality
- **Update documentation** as needed

### 4. Before Submitting

Run these commands to ensure your changes are ready:

```bash
# Install dependencies
pnpm install

# Run tests
pnpm test

# Check linting
pnpm lint

# Check types
pnpm type-check

# Build to catch any build errors
pnpm build
```

## Pull Request Process

### 1. Preparing Your PR

- **Push your branch** to your fork
- **Create a pull request** from your fork to the main repository
- **Use our PR template** (it will appear automatically)

### 2. PR Requirements

Your pull request should include:

- **Clear title** describing the change
- **Detailed description** of what and why
- **Link to related issue** (if applicable)
- **Screenshots** for UI changes
- **Tests** for new functionality
- **Updated documentation** if needed

### 3. Review Process

1. **Automated checks** will run (tests, linting, build)
2. **Code review** by maintainers
3. **Address feedback** promptly and respectfully
4. **Final approval** and merge

### 4. After Your PR is Merged

- **Delete your feature branch** (locally and on GitHub)
- **Pull the latest changes** from upstream
- **Celebrate!** 🎉 You've contributed to SPINE!

## Issue Reporting

### Bug Reports

When reporting a bug, please:

1. **Use our bug report template**
2. **Provide a clear description** of the issue
3. **Include steps to reproduce** the problem
4. **Share your environment details** (OS, Node version, etc.)
5. **Add logs or screenshots** if helpful

### Feature Requests

For new feature ideas:

1. **Use our feature request template**
2. **Describe the problem** you're trying to solve
3. **Explain your proposed solution**
4. **Consider alternatives** you've thought about
5. **Discuss the impact** on existing functionality

### Questions and Discussions

For general questions or discussions:

- **GitHub Discussions** for community conversations
- **Issues** for specific bugs or feature requests
- **Documentation** for setup and usage questions

## Getting Help

### Documentation Resources

- [README.md](../../README.md) - Project overview and setup
- [Developer Guide](./developer_guide.md) - Technical standards and practices
- [docs folder](../../docs/) - Additional documentation

### Community Support

- **GitHub Issues** - For bugs and feature requests
- **GitHub Discussions** - For questions and community chat
- **Code of Conduct** - Our [community standards](./code_of_conduct.md)

### Academic Collaboration

SPINE is part of the RADIAL project at Metropolia University of Applied Sciences. For academic collaborations or research partnerships, please reach out through our issue system or project contacts.

---

## Thank You!

Every contribution, no matter how small, makes SPINE better for everyone. We appreciate your time and effort in helping improve this project.

**Happy contributing!** 🚀
