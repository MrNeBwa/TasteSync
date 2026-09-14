# Movie Match

Social movie discovery: создайте комнату с друзьями, голосуйте LIKE/DISLIKE/SKIP
и найдите один общий фильм без споров.

Монорепозиторий на pnpm + turbo:

| Каталог      | Что это                                             |
| ------------ | --------------------------------------------------- |
| `apps/web`   | Веб-клиент (React 19 + Vite)                        |
| `apps/mobile`| Нативное Android/iOS приложение (Expo + React Native)|
| `apps/api`   | Бэкенд (FastAPI + SQLAlchemy async + PostgreSQL)    |
| `infra`      | Docker Compose: PostgreSQL + Redis                  |
| `scripts`    | Вспомогательные скрипты (запуск, проверка релиза)   |

Оба клиента работают с одним API-контрактом из `apps/api`. Изменение поля в
ответе API должно обновить схему Pydantic, сериализатор, типы клиентов и
контракт-тесты (см. `RELEASE.md`).

## Быстрый старт

Требования: Node.js 20+, pnpm, uv, Docker, PostgreSQL compatible tooling.

```bash
# 1. Инфраструктура
docker compose -f infra/docker-compose.yml up -d

# 2. Бэкенд
cd apps/api
uv sync
cp .env.example .env
uv run alembic upgrade head
uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# 3. Веб
cd ..
npx pnpm@10.15.0 install
npx pnpm@10.15.0 dev:web

# 4. Мобайл (Android/iOS)
npx pnpm@10.15.0 dev:mobile
```

Или всё сразу:

```bash
./scripts/start.sh
```

API docs: http://127.0.0.1:8000/docs · Health: http://127.0.0.1:8000/api/health

### Мобильное приложение

Физический телефон не достанет `127.0.0.1` на машине разработчика. Укажите LAN
адрес машины в `apps/mobile/.env`:

```env
EXPO_PUBLIC_API_URL=http://192.168.x.x:8000/api
EXPO_PUBLIC_WS_URL=ws://192.168.x.x:8000
```

Эмулятор Android использует `http://10.0.2.2:8000/api`. Подробности —
в `apps/mobile/README.md`.

## Проверка продакшн-готовности

```bash
./scripts/verify-release.sh
```

- компиляция и тесты API (`pytest`);
- линтер ruff;
- typecheck веб- и мобильного клиента.