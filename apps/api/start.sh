$bash
uv sync
uv run alembic upgrade head
uv run alembic current
cd ..
cd .. 
docker compose -f infra/docker-compose.yml up -d
cd apps/api
uv sync 
uv run uvicorn app.main:app --reload
