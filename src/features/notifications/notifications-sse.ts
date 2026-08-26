import { API_BASE_URL } from '#/lib/api-client'
import { isTerminalSessionRefreshError } from '#/features/auth/session-refresh'
import { notificationSchema } from '#/schemas/notifications.schema'
import type { Notification } from '#/schemas/notifications.schema'

type Listener = (notification: Notification) => void

const INITIAL_CONNECT_DELAY_MS = import.meta.env.DEV ? 250 : 0

interface SubscribeOptions {
  getAccessToken: () => string | null
  refreshAccessToken: () => Promise<string>
  onEvent: Listener
  onOpen?: () => void
  onError?: (err: unknown) => void
  onInvalidEvent?: () => void
  onVisible?: () => void
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
  let initialConnectTimer: ReturnType<typeof setTimeout> | null = null
  let attempts = 0
  let invalidEventReported = false

  function reportInvalidEvent() {
    if (invalidEventReported) return
    invalidEventReported = true
    options.onInvalidEvent?.()
  }

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
        try {
          token = await options.refreshAccessToken()
        } catch (error) {
          if (isTerminalSessionRefreshError(error)) {
            stopped = true
            options.onError?.(error)
            return
          }
          throw error
        }
        attempts = 0
        return connect()
      }

      if (!response.ok || !response.body) {
        throw new Error(`SSE connect failed: ${response.status}`)
      }

      attempts = 0
      invalidEventReported = false
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
      abortController = null
      scheduleReconnect()
    } catch (err) {
      if (abortController === controller) {
        abortController = null
      }
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
      const parsed = notificationSchema.safeParse(JSON.parse(data))
      if (!parsed.success) {
        reportInvalidEvent()
        return
      }
      options.onEvent(parsed.data)
    } catch {
      reportInvalidEvent()
    }
  }

  function handleVisibilityChange() {
    if (stopped) return
    if (document.visibilityState === 'visible') {
      paused = false
      attempts = 0
      options.onVisible?.()
      void connect()
    } else {
      paused = true
      abortController?.abort()
    }
  }

  initialConnectTimer = setTimeout(() => {
    initialConnectTimer = null
    void connect()
  }, INITIAL_CONNECT_DELAY_MS)

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', handleVisibilityChange)
  }

  return function stop() {
    stopped = true
    if (initialConnectTimer) clearTimeout(initialConnectTimer)
    if (reconnectTimer) clearTimeout(reconnectTimer)
    abortController?.abort()
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }
}
