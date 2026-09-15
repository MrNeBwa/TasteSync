# Product Requirements — MVP

## Product goal
Позволить группе пользователей быстро выбрать фильм совместным голосованием в одной комнате.

## Core flow
1. Пользователь входит в аккаунт.
2. Создаёт комнату или входит по коду/QR.
3. Видит lobby и участников в realtime.
4. Owner запускает movie session.
5. Участники голосуют LIKE/DISLIKE/SKIP.
6. Backend вычисляет match по выбранной policy.
7. Все участники видят результат.

## MVP screens
- Login / Register
- Home (запуск / ввод кода / QR-скан)
- Create room
- Join room (код · ссылка · QR)
- Room lobby (список участников, QR-приглашение, готовность)
- Movie session (LIKE / DISLIKE / SKIP)
- Match result
- Profile / Settings
- Age/content policy modal
- История комнат и matched-фильмов (web dashboard + mobile profile)
- Смена пароля
- Dark / light theme toggle

## Product rules
- Room owner автоматически становится членом комнаты.
- Room code уникален.
- Только owner может стартовать/закрывать session.
- Голос нельзя изменить после завершения session.
- Backend — источник истины для room/session state.
- История доступна через `GET /api/me/history` (под auth).
- Пароль меняется через `PATCH /api/users/me/password` (проверка текущего пароля).
- QR-код комнаты кодирует ссылку `https://moviematch.app/join/<CODE>`; сканер парсит код из ссылки.

## MVP KPI
- Started rooms → Match rate
- Time to first match
- Session completion rate
