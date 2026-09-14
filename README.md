# Movie Match v0.3 — working web + backend

## This iteration
- Register flow is explicitly `register -> login -> /auth/me`.
- After first successful login, if no `birth_date` is stored, the user must complete the age gate before continuing.
- Settings > Age and censorship edits the stored birth date.
- Backend stores `users.birth_date`.
- TMDB `adult` flag is persisted as `movies.is_adult`.
- Recommendations hide adult movies for under-18 users; in a room, 18+ movies are allowed only when every participant is 18+.
- Trailer stays visually clean: no large text overlay on top of the video; autoplay remains muted to comply with browser autoplay rules.
- Full-page cinematic backdrop uses the current movie backdrop/poster as a blurred background layer and combines it with the extracted poster palette when CORS allows pixel sampling.
- FastAPI enables CORS for local Vite development.

## Database
Run migrations:

```bash
cd apps/api
uv run alembic upgrade head
```

Latest revision: `0007_movie_adult_flag`.

## Backend
```bash
cd apps/api
uv run uvicorn app.main:app --reload
```

## Web
```bash
pnpm install
pnpm dev:web
```

## v1.1 trailer sizing fix

The movie trailer container now keeps a strict 16:9 aspect ratio without an artificial viewport height. This removes the black band below the YouTube player and prevents the trailer area from cropping because of the previous `min-height` rule.
