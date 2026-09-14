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
- Home
- Create room
- Join room
- Room lobby
- Movie session
- Match result
- Profile / Settings
- Age/content policy modal

## Product rules
- Room owner автоматически становится членом комнаты.
- Room code уникален.
- Только owner может стартовать/закрывать session.
- Голос нельзя изменить после завершения session.
- Backend — источник истины для room/session state.

## MVP KPI
- Started rooms → Match rate
- Time to first match
- Session completion rate
