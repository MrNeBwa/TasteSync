import { ApiError } from '../api/client';

/**
 * True when a rejected vote means the card on screen is stale rather than the
 * request having failed.
 *
 * Feeds exclude what the current user has already rated, but that only holds for
 * a freshly loaded batch. The same account open in two tabs, or a batch that
 * arrived just before the room's mode changed, can still be showing an item
 * this user has rated. The API answers 409 for that, and treating it as a fatal
 * error leaves the user pinned on the card: every retry repeats the same
 * failure, which is what made the room look like it was looping.
 */
export function isStaleCardError(error: unknown): boolean {
  return error instanceof ApiError && error.status === 409;
}

/**
 * What the feed should do after a vote attempt: step to the next card, or
 * replace the batch when the stale card was the last one.
 */
export function nextStepAfterVote(
  error: unknown,
  index: number,
  length: number,
): 'advance' | 'reload' | 'error' {
  if (!isStaleCardError(error)) return 'error';
  return index + 1 >= length ? 'reload' : 'advance';
}
