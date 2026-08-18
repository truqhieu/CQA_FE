/** Cookie httpOnly giữ JWT trên domain API — không backup token ra JS storage. */

export function backupAuthForOAuth(): void {
  // no-op: phiên nằm trong cookie, redirect OAuth không làm mất cookie API
}

export function restoreAuthAfterOAuth(): boolean {
  return true;
}

export function buildOAuthChannelReturnUrl(): string {
  if (typeof window === 'undefined') return '/settings?tab=channel'
  const path = window.location.pathname || '/settings'
  return `${window.location.origin}${path}?tab=channel`
}
