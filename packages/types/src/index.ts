export type RoomStatus = 'WAITING' | 'READY' | 'ACTIVE' | 'MATCH_FOUND' | 'FINISHED';
export type SessionStatus = 'CREATED' | 'ACTIVE' | 'MATCHED' | 'FINISHED';
export type VoteValue = 'LIKE' | 'DISLIKE' | 'SKIP';

export interface User { id: string; username: string; avatarUrl?: string; }
export interface Room { id: string; name: string; code: string; status: RoomStatus; ownerId: string; }
export interface RoomMember extends User { role: 'OWNER' | 'MEMBER'; }
export interface Movie { id: string; title: string; posterUrl?: string; description?: string; ageRating?: string; }
export interface MovieVote { sessionId: string; userId: string; movieId: string; vote: VoteValue; }
