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
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null
  let attempts = 0

  function scheduleReconnect() {
    if (stopped) return
    const delay = Math.min(30_000, 1000 * Math.pow(2, attempts))
    attempts += 1
    if (reconnectTimer) clearTimeout(reconnectTimer)
    reconnectTimer = setTimeout(() => {
      void connect()
    }, delay)
  }

  async function connect(): Promise<void> {
    if (stopped) return
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
      return
    }

    abortController?.abort()
    abortController = new AbortController()

    let token = options.getAccessToken()

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/notifications/stream`,
        {
          method: 'GET',
          headers: {
            Accept: 'text/event-stream',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          credentials: 'include',
          signal: abortController.signal,
        },
      )

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

      let buffer = ''

      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        buffer += value

        // Parse complete events (delimited by blank line)
        let idx
        while ((idx = buffer.indexOf('\n\n')) !== -1) {
          const raw = buffer.slice(0, idx)
          buffer = buffer.slice(idx + 2)
          handleSseFrame(raw)
        }
      }

      // Stream ended; reconnect
      if (!stopped) scheduleReconnect()
    } catch (err) {
      if ((err as Error).name === 'AbortError') return
      options.onError?.(err)
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
      attempts = 0
      void connect()
    } else {
      // Pause: abort the current stream; we'll reconnect on visibility
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
