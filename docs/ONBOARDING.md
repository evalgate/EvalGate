# Onboarding — First PR in &lt;15 Minutes

Get from clone to your first PR quickly.

## Prerequisites

- **Node.js** ≥ 20
- **pnpm** (latest)
- A PostgreSQL database (e.g. Railway, Supabase, or local `docker run -e POSTGRES_PASSWORD=pass -p 5432:5432 postgres`)
- GitHub and/or Google OAuth credentials (for auth testing)

## Steps

### 1. Clone and install

```bash
git clone https://github.com/evalgate/ai-evaluation-platform.git
cd ai-evaluation-platform
pnpm install
cp .env.example .env.local   # fill in secrets
pnpm db:migrate
```

### 2. Run dev server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) and confirm the app loads.

### 3. Create a branch and make a small change

```bash
git checkout -b docs/my-first-pr
```

Example: fix a typo in `README.md`, add a clarifying comment, or update a doc link.

### 4. Run checks locally

```bash
pnpm lint
pnpm typecheck
pnpm test:unit
```

If you changed DB or UI code, also run `pnpm test:db` and/or `pnpm test:dom`.

### 5. Open a PR

```bash
git add .
git commit -m "docs: fix typo in README"
git push -u origin docs/my-first-pr
```

Open a PR against `main` on GitHub. CI will run lint, typecheck, tests, and build.

## Next Steps

- Read [CONTRIBUTING.md](../CONTRIBUTING.md) for full workflow, testing lanes, and commit conventions
- [docs/RELEASING.md](RELEASING.md) — how to cut releases
- [docs/ARCHITECTURE.md](ARCHITECTURE.md) — system architecture
