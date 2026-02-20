export type SSEHandler = (data: unknown, event: string) => void

export interface SSEConnection {
    close: () => void
}

/**
 * Create an SSE connection with auto-reconnect.
 * Returns a cleanup function that closes the connection.
 */
export function createSSE(url: string, handlers: Record<string, SSEHandler>): SSEConnection {
    let es: EventSource | null = null
    let closed = false
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null

    function connect(): void {
        if (closed) return

        es = new EventSource(url)

        es.addEventListener('ping', () => {
            // keep-alive, no-op
        })

        for (const [eventType, handler] of Object.entries(handlers)) {
            es.addEventListener(eventType, (e: MessageEvent) => {
                try {
                    handler(JSON.parse(e.data as string), eventType)
                } catch {
                    handler(e.data, eventType)
                }
            })
        }

        es.onerror = () => {
            es?.close()
            es = null
            if (!closed) {
                reconnectTimer = setTimeout(connect, 3000)
            }
        }
    }

    connect()

    return {
        close() {
            closed = true
            if (reconnectTimer) clearTimeout(reconnectTimer)
            es?.close()
            es = null
        },
    }
}
