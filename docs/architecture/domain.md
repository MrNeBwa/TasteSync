# Domain model

User 1..N RoomMembership N..1 Room
Room 1..N Session
Session 1..N Vote
Session 1..N Match
Movie 1..N Vote
Movie 1..N Match

Room status: WAITING → READY → ACTIVE → MATCH_FOUND / FINISHED
Session status: CREATED → ACTIVE → MATCHED / FINISHED
