/** Custom-scheme deep links into the Sullam Tracker app (Expo OTA–friendly). */

export const APP_SCHEME = 'myapp';

const DISMISS_KEY = 'sullam_open_in_app_stay';

export function isMobileDevice(): boolean {
    if (typeof navigator === 'undefined') return false;
    const ua = navigator.userAgent || navigator.vendor || '';
    if (/android/i.test(ua)) return true;
    if (/iPad|iPhone|iPod/.test(ua)) return true;
    // iPadOS 13+ desktop UA still has touch
    if (navigator.platform === 'MacIntel' && (navigator as any).maxTouchPoints > 1) return true;
    return false;
}

/** HashRouter path without leading #, e.g. "/taqm/abc" or "/sessions". */
export function currentHashPath(): string {
    if (typeof window === 'undefined') return '/';
    const raw = window.location.hash.replace(/^#/, '') || '/';
    const path = raw.split('?')[0] || '/';
    return path.startsWith('/') ? path : `/${path}`;
}

/**
 * Map the current website route to a myapp:// deep link.
 * Session routes preserve the id; everything else opens Sessions.
 */
export function deepLinkForPath(path: string = currentHashPath()): string {
    const taqm = path.match(/^\/taqm\/([^/]+)\/?$/);
    if (taqm) return `${APP_SCHEME}://taqm/${encodeURIComponent(taqm[1])}`;

    const zikr = path.match(/^\/zikr\/([^/]+)\/?$/);
    if (zikr) return `${APP_SCHEME}://zikr/${encodeURIComponent(zikr[1])}`;

    if (path === '/sessions' || path === '/zikr') return `${APP_SCHEME}://sessions`;

    return `${APP_SCHEME}://sessions`;
}

export function hasChosenStayInWebsite(): boolean {
    try {
        return sessionStorage.getItem(DISMISS_KEY) === '1';
    } catch {
        return false;
    }
}

export function rememberStayInWebsite(): void {
    try {
        sessionStorage.setItem(DISMISS_KEY, '1');
    } catch {
        /* ignore */
    }
}

export function openInApp(path?: string): void {
    const url = deepLinkForPath(path);
    window.location.href = url;
}
