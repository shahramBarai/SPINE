# 👨‍💻 Contribution Guide

Welcome to SPINE! This guide will help you get started with contributing to our IoT platform project.

## 📖 Table of Contents

- [📝 How to Contribute](#how-to-contribute)
- [🔧 Development Workflow](#development-workflow)
- [🎯 Pull Request Process](#pull-request-process)
- [🐞 Issue Reporting](#issue-reporting)
- [💬 Getting Help](#getting-help)
- [🙏 Thank You!](#thank-you)

## 📝 How to Contribute

**To contribute:**
1. Fork the repository
2. Create your feature branch (`git checkout -b feature/[your_feature_name]`)
3. Commit your changes (`git commit -m 'Add some feature'`)
4. Push to the branch (`git push origin feature/[your_feature_name]`)
5. Open a Pull Request

**Types of Contributions:**

- **🐞 Issue reporting** - Report issues or feature suggestions by filling an issue
- **🐛 Bug fixes** - Fix bugs from existing issues
- **✨ New features** - Add functionality that benefits the community
- **📚 Documentation** - Improve guides, examples, and API docs
- **🧪 Testing** - Add tests or improve existing test coverage
- **🎨 UI/UX improvements** - Enhance the user experience
- **🔧 Refactoring** - Improve code quality and maintainability
- **🎓 Academic research** - Share findings and collaborate on research

**Finding Something to Work On**

- **Good first issues** - Look for issues labeled [good first issue](https://github.com/shahramBarai/spine/issues?q=label%3A%22good+first+issue%22)
- **Help wanted** - Check issues labeled [help wanted](https://github.com/shahramBarai/spine/issues?q=label%3A%22help+wanted%22)
- **Documentation** - Browse for areas needing better documentation
- **Your own ideas** - Propose new features by opening an issue first

## 🔧 Development Workflow

### 1. Before You Start

- **Check existing issues** to avoid duplicate work
- **Open an issue** for significant changes or new features
- **Discuss your approach** with maintainers if unsure

### 2. Creating Your Branch

Note: Before creating a branch, make sure you're on main and it's up to date with the latest changes from the main repository.

```bash
# Create a new branch for your work
git checkout -b feature/your-feature-name
# or
git checkout -b fix/issue-number-description
```

### 3. Making Changes

- **Follow our coding standards** (see [Developer Guide](../developer_guide.md))
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

## 🎯 Pull Request Process

### 1. Preparing Your PR

- **Push your branch** to your fork
- **Create a pull request** from your fork to the main repository
- **Use our PR template** [(PR Template)](../../.github/pull_request_template.md)

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

## 🐞 Issue Reporting

**Bug Reports:**

When reporting a bug, please:

1. **Use our bug report template** [(Bug Report Template)](../../.github/bug_report.md)
2. **Provide a clear description** of the issue
3. **Include steps to reproduce** the problem
4. **Share your environment details** (OS, Node version, etc.)
5. **Add logs or screenshots** if helpful

**Feature Requests:**

For new feature ideas:

1. **Use our feature request template** [(Feature Request Template)](../../.github/feature_request.md)
2. **Describe the problem** you're trying to solve
3. **Explain your proposed solution**
4. **Consider alternatives** you've thought about
5. **Discuss the impact** on existing functionality

## 💬 Getting Help

**Documentation Resources:**

- [README.md](../../README.md) - Project overview and setup
- [Developer Guide](./developer_guide.md) - Technical standards and practices
- [docs folder](../../docs/) - Additional documentation

**Community Support:**

- **GitHub Issues** - For bugs and feature requests
- **GitHub Discussions** - For questions and community chat
- **Code of Conduct** - Our [community standards](../code_of_conduct.md)

## 🙏 Thank You!

Every contribution, no matter how small, makes SPINE better for everyone. We appreciate your time and effort in helping improve this project.

**Happy contributing!** 🚀
