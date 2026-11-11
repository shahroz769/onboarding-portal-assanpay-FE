import { API_BASE_URL } from '#/lib/api-client'
import { isTerminalSessionRefreshError } from '#/features/auth/session-refresh'
import {
  caseEmailStatusEventSchema,
  notificationSchema,
} from '#/schemas/notifications.schema'
import type {
  CaseEmailStatusEvent,
  Notification,
} from '#/schemas/notifications.schema'

type Listener = (notification: Notification) => void

const INITIAL_CONNECT_DELAY_MS = import.meta.env.DEV ? 250 : 0

/** A stream that stayed open this long resets the reconnect backoff. */
const STABLE_STREAM_MS = 30_000

const MAX_RECONNECT_DELAY_MS = 30_000

interface SubscribeOptions {
  getAccessToken: () => string | null
  refreshAccessToken: () => Promise<string>
  onEvent: Listener
  /** A case email's delivery status changed; not a notification. */
  onCaseEmailStatus?: (event: CaseEmailStatusEvent) => void
  onOpen?: () => void
  onError?: (err: unknown) => void
  onInvalidEvent?: () => void
  onVisible?: () => void
}

/**
 * The connection is always in exactly one state, and each state owns the
 * timer or request it waits on; leaving a state cancels it.
 *
 *   starting ──▶ connecting ──▶ open ──stream ends / fails──▶ backoff
 *   backoff ──timer──▶ connecting
 *   any ──tab hidden──▶ paused ──tab visible──▶ connecting
 *   any ──stop / session ended──▶ stopped (final)
 */
type ConnectionState =
  | { kind: 'starting'; timer: ReturnType<typeof setTimeout> }
  | { kind: 'connecting'; controller: AbortController }
  | { kind: 'open'; controller: AbortController; openedAt: number }
  | { kind: 'backoff'; timer: ReturnType<typeof setTimeout> }
  | { kind: 'paused' }
  | { kind: 'stopped' }

/**
 * Connects to /api/notifications/stream with a Bearer token using fetch + ReadableStream
 * (native EventSource cannot send Authorization headers).
 *
 * Auto-reconnects with exponential backoff, suspends while the tab is hidden,
 * and refreshes the access token on 401.
 */
export function createNotificationsSseClient(options: SubscribeOptions) {
  let state: ConnectionState = {
    kind: 'starting',
    timer: setTimeout(() => void connect(), INITIAL_CONNECT_DELAY_MS),
  }
  /** Failed connections in a row; drives the backoff delay. */
  let attempts = 0
  /** A 401 already got a fresh token; a second one in a row backs off. */
  let retriedAfterRefresh = false
  let invalidEventReported = false

  function transition(next: ConnectionState) {
    if (state.kind === 'stopped') return
    if (state.kind === 'starting' || state.kind === 'backoff') {
      clearTimeout(state.timer)
    }
    if (
      (state.kind === 'connecting' || state.kind === 'open') &&
      !('controller' in next && next.controller === state.controller)
    ) {
      state.controller.abort()
    }
    state = next
  }

  /** Whether `controller` is still the request the client is waiting on. */
  function owns(controller: AbortController) {
    return (
      (state.kind === 'connecting' || state.kind === 'open') &&
      state.controller === controller
    )
  }

  function isHidden() {
    return (
      typeof document !== 'undefined' && document.visibilityState === 'hidden'
    )
  }

  function scheduleReconnect() {
    if (state.kind === 'stopped' || state.kind === 'paused') return
    // Only a stream that stayed up resets the backoff, so a server or proxy
    // that keeps cutting streams short can't cause a fast reconnect loop.
    if (
      state.kind === 'open' &&
      Date.now() - state.openedAt >= STABLE_STREAM_MS
    ) {
      attempts = 0
    }
    const delay = Math.min(MAX_RECONNECT_DELAY_MS, 1000 * 2 ** attempts)
    attempts += 1
    // The next connect may refresh the token once more: it can have expired
    // during the wait.
    retriedAfterRefresh = false
    transition({
      kind: 'backoff',
      timer: setTimeout(() => void connect(), delay),
    })
  }

  function isRetriableStreamError(err: unknown): boolean {
    return (
      err instanceof TypeError ||
      (err instanceof DOMException && err.name === 'NetworkError')
    )
  }

  async function connect(): Promise<void> {
    if (state.kind === 'stopped') return
    if (isHidden()) {
      transition({ kind: 'paused' })
      return
    }

    const controller = new AbortController()
    transition({ kind: 'connecting', controller })
    const token = options.getAccessToken()

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
      if (!owns(controller)) return

      if (response.status === 401) {
        if (retriedAfterRefresh) {
          // A fresh token was refused too: back off instead of looping.
          throw new Error('SSE connect refused after a token refresh.')
        }
        try {
          await options.refreshAccessToken()
        } catch (error) {
          if (isTerminalSessionRefreshError(error)) {
            transition({ kind: 'stopped' })
            options.onError?.(error)
            return
          }
          throw error
        }
        if (!owns(controller)) return
        retriedAfterRefresh = true
        return connect()
      }

      if (!response.ok || !response.body) {
        throw new Error(`SSE connect failed: ${response.status}`)
      }

      retriedAfterRefresh = false
      invalidEventReported = false
      transition({ kind: 'open', controller, openedAt: Date.now() })
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
      if (owns(controller)) scheduleReconnect()
    } catch (err) {
      // A request the client already moved past (paused, replaced, stopped)
      // was aborted on purpose.
      if (!owns(controller)) return
      if (!isRetriableStreamError(err)) {
        options.onError?.(err)
      }
      scheduleReconnect()
    }
  }

  function reportInvalidEvent() {
    if (invalidEventReported) return
    invalidEventReported = true
    options.onInvalidEvent?.()
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
    const data = dataLines.join('\n')
    if (!data) return
    if (event === 'case-email-status') {
      // A signal only: a malformed one is dropped without resyncing the
      // notifications, since nothing about them was missed.
      try {
        const parsed = caseEmailStatusEventSchema.safeParse(JSON.parse(data))
        if (parsed.success) options.onCaseEmailStatus?.(parsed.data)
      } catch {
        // Ignore unparseable signals.
      }
      return
    }
    if (event !== 'notification') return
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
    if (state.kind === 'stopped') return
    if (document.visibilityState === 'visible') {
      attempts = 0
      options.onVisible?.()
      // Leaving starting or backoff cancels its pending connect.
      if (state.kind !== 'connecting' && state.kind !== 'open') void connect()
    } else {
      transition({ kind: 'paused' })
    }
  }

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', handleVisibilityChange)
  }

  return function stop() {
    transition({ kind: 'stopped' })
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }
}
