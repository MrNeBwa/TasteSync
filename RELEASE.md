# Movie Match — Canonical Development Release

## Important: one source of truth

This repository is the canonical monorepo. `apps/api` and `apps/web` are part of the same release and must be kept together when you need the complete application.

**Never extract a frontend-only archive over the repository root.** Frontend-only updates must contain `apps/web` only. This prevents an older backend snapshot from overwriting the current backend.

## Versions

- Frontend: v1.3.0
- Backend: v1.3.0
- DB migrations: Alembic head

## Local startup

1. Start infrastructure:

```bash
docker compose -f infra/docker-compose.yml up -d
```

2. Backend:

```bash
cd apps/api
uv sync
uv run alembic upgrade head
uv run uvicorn app.main:app --reload
```

3. Web:

```bash
corepack pnpm install
corepack pnpm dev:web
```

## Contract rule

The frontend consumes the backend's HTTP/JSON contract. Changes to a response field must update:

1. backend Pydantic response schema;
2. endpoint serializer;
3. shared frontend type/consumer;
4. contract test.

The `MovieResponse.is_adult` field is covered by this rule specifically because it previously caused runtime 500 responses.
