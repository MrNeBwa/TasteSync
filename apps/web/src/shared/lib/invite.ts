/** Helpers for shareable room invitations and QR codes. */

const CODE_PATTERN = /^[A-Z0-9]{4,8}$/;
const JOIN_PATH_PATTERN = /\/join\/([A-Za-z0-9]{4,8})/;

export function normalizeRoomCode(value: string): string | null {
  const code = value.trim().toUpperCase();
  return CODE_PATTERN.test(code) ? code : null;
}

/**
 * Pull a room code out of the current location.
 *
 * Supports the shareable `/join/<code>` link used by the QR code and mobile
 * scanner, plus `?room=` / `?code=` query links. The path form wins so a stale
 * query parameter cannot override an explicit link.
 */
export function extractRoomCode(pathname: string, search = ""): string | null {
  const fromPath = pathname.match(JOIN_PATH_PATTERN);
  if (fromPath) return normalizeRoomCode(fromPath[1]);

  const params = new URLSearchParams(search);
  for (const key of ["room", "code", "join"]) {
    const value = params.get(key);
    if (value) {
      const code = normalizeRoomCode(value);
      if (code) return code;
    }
  }
  return null;
}

/** Build a link both the web app and the mobile QR scanner can handle. */
export function buildJoinUrl(code: string, origin: string): string {
  const base = origin.replace(/\/+$/, "");
  return `${base}/join/${code.trim().toUpperCase()}`;
}
