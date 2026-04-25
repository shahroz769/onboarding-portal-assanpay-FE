import { API_BASE_URL } from '#/lib/api-client'
import type { Notification } from '#/schemas/notifications.schema'

type Listener = (notification: Notification) => void

interface SubscribeOptions {
  getAccessToken: () => string | null
  refreshAccessToken: () => Promise<string | null>
  onEvent: Listener
  onOpen?: () => void
  onError?: (err: unknown) => void
}

/**
 * Connects to /api/notifications/stream with a Bearer token using fetch + ReadableStream
 * (native EventSource cannot send Authorization headers).
 *
 * Auto-reconnects with exponential backoff, suspends while the tab is hidden,
 * and refreshes the access token on 401.
 */
export function createNotificationsSseClient(options: SubscribeOptions) {
  let abortController: AbortController | null = null
  let stopped = false
  let paused = false
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null
  let attempts = 0

  function scheduleReconnect() {
    if (stopped || paused) return
    const delay = Math.min(30_000, 1000 * Math.pow(2, attempts))
    attempts += 1
    if (reconnectTimer) clearTimeout(reconnectTimer)
    reconnectTimer = setTimeout(() => {
      void connect()
    }, delay)
  }

  function isExpectedDisconnect(
    err: unknown,
    controller: AbortController,
  ): boolean {
    if (stopped || paused || controller.signal.aborted) return true
    return err instanceof DOMException && err.name === 'AbortError'
  }

  function isRetriableStreamError(err: unknown): boolean {
    return (
      err instanceof TypeError ||
      (err instanceof DOMException && err.name === 'NetworkError')
    )
  }

  async function connect(): Promise<void> {
    if (stopped) return
    if (
      typeof document !== 'undefined' &&
      document.visibilityState === 'hidden'
    ) {
      paused = true
      return
    }

    paused = false
    abortController?.abort()
    const controller = new AbortController()
    abortController = controller

    let token = options.getAccessToken()

    try {
      const response = await fetch(`${API_BASE_URL}/api/notifications/stream`, {
        method: 'GET',
        headers: {
          Accept: 'text/event-stream',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: 'include',
        signal: controller.signal,
      })

      if (response.status === 401) {
        token = await options.refreshAccessToken()
        if (!token) {
          stopped = true
          return
        }
        attempts = 0
        return connect()
      }

      if (!response.ok || !response.body) {
        throw new Error(`SSE connect failed: ${response.status}`)
      }

      attempts = 0
      options.onOpen?.()

      const reader = response.body
        .pipeThrough(new TextDecoderStream())
        .getReader()

      try {
        let buffer = ''

        for (;;) {
          const { value, done } = await reader.read()
          if (done) break
          buffer = `${buffer}${value}`.replace(/\r\n/g, '\n')

          // Parse complete events (delimited by blank line)
          let idx
          while ((idx = buffer.indexOf('\n\n')) !== -1) {
            const raw = buffer.slice(0, idx)
            buffer = buffer.slice(idx + 2)
            handleSseFrame(raw)
          }
        }
      } finally {
        reader.releaseLock()
      }

      // Stream ended; reconnect
      if (abortController !== controller) return
      scheduleReconnect()
    } catch (err) {
      if (isExpectedDisconnect(err, controller)) return
      if (!isRetriableStreamError(err)) {
        options.onError?.(err)
      }
      scheduleReconnect()
    }
  }

  function handleSseFrame(raw: string) {
    let event = 'message'
    const dataLines: string[] = []
    for (const line of raw.split('\n')) {
      if (line.startsWith('event:')) {
        event = line.slice(6).trim()
      } else if (line.startsWith('data:')) {
        dataLines.push(line.slice(5).trim())
      }
    }
    if (event !== 'notification') return
    const data = dataLines.join('\n')
    if (!data) return
    try {
      const parsed = JSON.parse(data) as Notification
      options.onEvent(parsed)
    } catch (err) {
      console.error('[notifications-sse] failed to parse event', err)
    }
  }

  function handleVisibilityChange() {
    if (stopped) return
    if (document.visibilityState === 'visible') {
      // Force reconnect to pick up missed events
      paused = false
      attempts = 0
      void connect()
    } else {
      // Pause: abort the current stream; we'll reconnect on visibility
      paused = true
      abortController?.abort()
    }
  }

  void connect()
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', handleVisibilityChange)
  }

  return function stop() {
    stopped = true
    if (reconnectTimer) clearTimeout(reconnectTimer)
    abortController?.abort()
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }
}
