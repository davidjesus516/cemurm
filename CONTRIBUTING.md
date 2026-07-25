# Contributing to CEMURM

Thank you for your interest in contributing to CEMURM! This document provides guidelines and instructions for contributing.

## Code of Conduct

Be respectful, inclusive, and constructive. We're building this for musicians of all backgrounds and skill levels.

## How to Contribute

### Reporting Bugs

1. Check [existing issues](https://github.com/your-org/cemurm/issues) to avoid duplicates
2. Open a new issue using the **Bug Report** template
3. Include as much detail as possible (steps to reproduce, device, browser, screenshots)

### Suggesting Features

1. Check [existing issues](https://github.com/your-org/cemurm/issues) for similar requests
2. Open a new issue using the **Feature Request** template
3. Explain the problem you're solving, not just the solution you want

### Submitting Code

1. Fork the repository
2. Create a feature branch from `main`:
   ```bash
   git checkout -b feat/my-feature
   ```
3. Make your changes
4. Run linting and tests:
   ```bash
   npm run lint
   ```
5. Commit with a clear message following [Conventional Commits](https://www.conventionalcommits.org/):
   ```bash
   git commit -m "feat: add chord transposition controls"
   ```
6. Push and open a Pull Request

### Commit Convention

We use [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` — new feature
- `fix:` — bug fix
- `docs:` — documentation changes
- `style:` — formatting, missing semicolons, etc.
- `refactor:` — code restructuring without behavior change
- `test:` — adding or updating tests
- `chore:` — tooling, dependencies, config

### Pull Request Guidelines

- Keep PRs focused on a single change
- Include a clear description of what changed and why
- Reference related issues (e.g., "Closes #42")
- Ensure `npm run lint` passes
- Add screenshots for UI changes
- Request at least one review before merging

## Development Setup

```bash
# Clone your fork
git clone https://github.com/your-username/cemurm.git
cd cemurm

# Install dependencies
npm install

# Start dev server
npm run dev
```

The app runs at `http://localhost:5173`.

## Project Structure

```
src/
├── components/     # Reusable UI components
├── pages/          # Route-level components
├── hooks/          # Custom React hooks
├── lib/            # Utilities, API clients, parsers
├── store/          # Zustand state stores
└── utils/          # Pure utility functions
```

## Style Guide

- Use Tailwind CSS for all styling (no CSS modules or styled-components)
- Component files use PascalCase: `SongCard.jsx`
- Hook files use camelCase with `use` prefix: `useAuth.js`
- Utility files use camelCase: `transposition.js`
- Keep components small and focused (single responsibility)
- Extract reusable logic into custom hooks

## Questions?

Open a discussion on GitHub or join our Discord server.
