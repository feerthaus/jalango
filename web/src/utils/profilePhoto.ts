/** The profile picture a sign-in provider shared (Google: avatar_url / picture), https only, or null. */
export function profilePhoto(meta: Record<string, unknown> | undefined): string | null {
  const url = meta?.avatar_url ?? meta?.picture;
  return typeof url === 'string' && /^https:\/\/[^\s"'<>]+$/.test(url) ? url : null;
}
