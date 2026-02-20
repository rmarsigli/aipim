export const BASE = '/ui'

export function getPath(): string {
    const pathname = window.location.pathname
    return pathname.startsWith(BASE) ? pathname.slice(BASE.length) || '/' : '/'
}

export function navigate(path: string): void {
    window.history.pushState({}, '', BASE + path)
    window.dispatchEvent(new PopStateEvent('popstate'))
}
