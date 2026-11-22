export const UNITY_EVENTS_PATH = "/whats-new/events";
export const UNITE_TOKYO_PATH = "/whats-new/unite-tokyo-2026";
export const UNITE_SEOUL_PATH = "/whats-new/unite-seoul-2026";

export function isUnityEventPath(pathname: string) {
  return pathname === UNITY_EVENTS_PATH ||
    pathname === UNITE_TOKYO_PATH || pathname.startsWith(`${UNITE_TOKYO_PATH}/`) ||
    pathname === UNITE_SEOUL_PATH || pathname.startsWith(`${UNITE_SEOUL_PATH}/`);
}
