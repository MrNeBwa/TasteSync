# Movie Match — Production Release Notes

## Versions

- Web: v1.3.1 (`apps/web`)
- Mobile: v0.2.0 (`apps/mobile`)
- Backend: v1.3.0 (`apps/api`)
- DB migrations: Alembic head

## Repo layout

`apps/web` — веб-клиент, `apps/mobile` — нативный клиент (Expo/React Native),
`apps/api` — единый бэкенд для обоих клиентов. Все части одного релиза и должны
обновляться вместе.

## Local startup

```bash
docker compose -f infra/docker-compose.yml up -d
cd apps/api && uv sync && uv run alembic upgrade head && uv run uvicorn app.main:app --reload
npx pnpm@10.15.0 install
npx pnpm@10.15.0 dev:web     # веб на http://localhost:5173
npx pnpm@10.15.0 dev:mobile  # Expo dev server
```

## Production checklist

- [ ] Задать `JWT_SECRET_KEY` (≥32 случайных байтов) и `TMDB_API_TOKEN` в `.env`;
- [ ] Указать `CORS_ORIGINS` под продовый домен веба;
- [ ] Поднять `infra/docker-compose.yml` (PostgreSQL, Redis) или managed-сервисы;
- [ ] `uv run alembic upgrade head`;
- [ ] Собрать веб: `pnpm --filter @movie-match/web build`;
- [ ] Собрать мобайл: `npx expo prebuild` + Android/iOS сборка (см. apps/mobile/README.md);
- [ ] Прогнать `./scripts/verify-release.sh`.

## Chevron rule (contract)

UPD: два клиента потребляют один HTTP/JSON контракт бэкенда. Любое изменение поля
ответа должно обновлять единовременно:

1. бэкенд Pydantic response schema;
2. сериализатор эндпоинта;
3. тип/потребителя в `apps/web` и `apps/mobile`;
4. контрактный тест (`apps/api/tests/test_api_contract.py`).

Поле `MovieResponse.is_adult` покрыто этим правилом специально: ранее оно
вызывало runtime 500 на обоих клиентах.