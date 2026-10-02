import {
  useDeferredValue,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import { useQuery, useSuspenseQuery } from '@tanstack/react-query'
import { differenceInCalendarDays, formatDistanceToNowStrict } from 'date-fns'
import {
  ArrowDown,
  CornerDownRight,
  MessageSquareMore,
  SendHorizontal,
  UserRound,
  X,
} from 'lucide-react'

import { TruncatedTooltip } from '#/components/truncated-tooltip'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '#/components/ui/alert'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '#/components/ui/card'
import { Avatar, AvatarFallback } from '#/components/ui/avatar'
import { Marker, MarkerContent } from '#/components/ui/marker'
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from '#/components/ui/message-scroller'
import { Popover, PopoverContent } from '#/components/ui/popover'
import { Spinner } from '#/components/ui/spinner'
import { Textarea } from '#/components/ui/textarea'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '#/components/ui/tooltip'
import { EmptyState } from '#/components/empty-state'
import { useAuth } from '#/features/auth/auth-client'
import {
  caseCommentsQueryOptions,
  useCreateComment,
} from '#/hooks/use-case-detail-query'
import { userDirectoryQueryOptions } from '#/hooks/use-users-query'
import { userTint } from '#/lib/status-styles'
import { cn } from '#/lib/utils'
import type { CaseComment } from '#/schemas/cases.schema'

interface CaseChatterProps {
  caseId: string
  canPost?: boolean
  embedded?: boolean
}

type MentionMatch = {
  query: string
  start: number
  end: number
}

type AnchorPosition = {
  left: number
  top: number
}

function compareCommentsByNewest(first: CaseComment, second: CaseComment) {
  return (
    new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime()
  )
}

function getInitials(name: string | null) {
  const fallback = (name ?? 'Unknown').trim()
  const parts = fallback.split(/\s+/).filter(Boolean)

  return parts
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('')
}

function formatUsername(username: string | null) {
  if (!username) return null

  const trimmedUsername = username.trim()
  if (!trimmedUsername) return null

  return trimmedUsername.startsWith('@')
    ? trimmedUsername
    : `@${trimmedUsername}`
}

function getMentionMatch(
  content: string,
  caretPosition: number,
): MentionMatch | null {
  const prefix = content.slice(0, caretPosition)
  const match = prefix.match(/(^|\s)@([^\s@]*)$/)

  if (!match) return null

  const query = match[2]

  return {
    query,
    start: caretPosition - query.length - 1,
    end: caretPosition,
  }
}

function getTextareaCaretPosition(
  textarea: HTMLTextAreaElement,
  position: number,
  relativeTo: HTMLElement,
): AnchorPosition {
  const computed = window.getComputedStyle(textarea)
  const mirror = document.createElement('div')
  const marker = document.createElement('span')
  const textareaRect = textarea.getBoundingClientRect()
  const relativeRect = relativeTo.getBoundingClientRect()

  mirror.style.position = 'fixed'
  mirror.style.left = `${textareaRect.left}px`
  mirror.style.top = `${textareaRect.top}px`
  mirror.style.width = `${textareaRect.width}px`
  mirror.style.height = `${textareaRect.height}px`
  mirror.style.visibility = 'hidden'
  mirror.style.overflow = 'hidden'
  mirror.style.whiteSpace = 'pre-wrap'
  mirror.style.overflowWrap = 'break-word'
  mirror.style.boxSizing = computed.boxSizing
  mirror.style.padding = computed.padding
  mirror.style.border = computed.border
  mirror.style.font = computed.font
  mirror.style.letterSpacing = computed.letterSpacing
  mirror.style.lineHeight = computed.lineHeight
  mirror.style.textTransform = computed.textTransform
  mirror.style.tabSize = computed.tabSize

  mirror.textContent = textarea.value.slice(0, position) || '​'
  marker.textContent = '​'
  mirror.appendChild(marker)
  document.body.appendChild(mirror)

  const markerRect = marker.getBoundingClientRect()
  const nextPosition = {
    left: markerRect.left - relativeRect.left,
    top: markerRect.bottom - relativeRect.top - textarea.scrollTop,
  }

  mirror.remove()

  return nextPosition
}

// An @handle that starts a word (so `ops@assanpay.com` is skipped) and does
// not end on a dot (so a sentence-ending `@ali.` still resolves to `@ali`).
const MENTION_PATTERN = /(?<![\w@])(@[A-Za-z0-9._-]*[A-Za-z0-9_-])/g

// Shared by the composer overlay and posted comments so a mention looks the
// same before and after sending. The ring pads the chip without changing
// layout, which keeps the overlay aligned with the textarea's caret.
const mentionChipClassName =
  'rounded-sm bg-mention text-mention-foreground ring-2 ring-mention [box-decoration-break:clone]'

/** Highlights `@username` tokens that resolve to a real user. */
function renderMentionText(
  content: string,
  validUsernames: ReadonlySet<string>,
) {
  return content.split(MENTION_PATTERN).map((part, index) => {
    // split() puts captured mentions at odd indexes.
    const isValidMention =
      index % 2 === 1 && validUsernames.has(part.slice(1).toLowerCase())

    return isValidMention ? (
      <span key={`${part}-${index}`} className={mentionChipClassName}>
        {part}
      </span>
    ) : (
      part
    )
  })
}

const composerTypographyClassName =
  'text-base leading-6 wrap-anywhere whitespace-pre-wrap md:text-sm'

function buildCommentThreads(comments: CaseComment[]) {
  const childrenByParent = new Map<string, CaseComment[]>()
  const roots: CaseComment[] = []

  for (const comment of comments) {
    if (!comment.parentId) {
      roots.push(comment)
      continue
    }

    const siblings = childrenByParent.get(comment.parentId) ?? []
    siblings.push(comment)
    childrenByParent.set(comment.parentId, siblings)
  }

  for (const [parentId, siblings] of childrenByParent.entries()) {
    childrenByParent.set(parentId, [...siblings].sort(compareCommentsByNewest))
  }

  return {
    roots: [...roots].sort(compareCommentsByNewest),
    childrenByParent,
  }
}

/** Splits newest-first threads into runs that started on the same day. */
function groupThreadsByDay(roots: CaseComment[]) {
  const groups: { day: string; label: string; roots: CaseComment[] }[] = []
  const now = new Date()
  const today = CHATTER_DAY_KEY_FORMATTER.format(now)
  const yesterday = CHATTER_DAY_KEY_FORMATTER.format(
    new Date(now.getTime() - 24 * 60 * 60 * 1000),
  )

  for (const root of roots) {
    const date = new Date(root.createdAt)
    const day = CHATTER_DAY_KEY_FORMATTER.format(date)
    const current = groups.at(-1)

    if (current?.day === day) {
      current.roots.push(root)
      continue
    }

    groups.push({
      day,
      label:
        day === today
          ? 'Today'
          : day === yesterday
            ? 'Yesterday'
            : CHATTER_DATE_FORMATTER.format(date),
      roots: [root],
    })
  }

  return groups
}

function getThreadReplies(
  commentId: string,
  childrenByParent: Map<string, CaseComment[]>,
) {
  const stack = [...(childrenByParent.get(commentId) ?? [])].reverse()
  const replies: CaseComment[] = []

  while (stack.length > 0) {
    const reply = stack.pop()
    if (!reply) continue

    replies.push(reply)
    const children = childrenByParent.get(reply.id) ?? []

    for (let index = children.length - 1; index >= 0; index -= 1) {
      stack.push(children[index])
    }
  }

  return replies
}

export function CaseChatter({
  caseId,
  canPost = false,
  embedded = false,
}: CaseChatterProps) {
  const { data: comments } = useSuspenseQuery(caseCommentsQueryOptions(caseId))
  const { data: users = [] } = useQuery(userDirectoryQueryOptions())
  const createComment = useCreateComment(caseId)
  const { user: currentUser } = useAuth()

  const [content, setContent] = useState('')
  const [cursorPosition, setCursorPosition] = useState(0)
  const [replyTarget, setReplyTarget] = useState<CaseComment | null>(null)
  const [isClosingReplyTarget, setIsClosingReplyTarget] = useState(false)
  const mentionMapRef = useRef<Record<string, string>>({})
  // Escape closes the mention list for the query it was pressed on; typing
  // further changes the key and reopens it.
  const [dismissedMentionKey, setDismissedMentionKey] = useState<string | null>(
    null,
  )
  const [highlightedMention, setHighlightedMention] = useState({
    key: '',
    index: 0,
  })
  const mentionListboxId = useId()

  function handleSelectReply(comment: CaseComment) {
    setIsClosingReplyTarget(false)
    setReplyTarget(comment)
    textareaRef.current?.focus()
  }

  function handleCancelReply() {
    setIsClosingReplyTarget(true)
    textareaRef.current?.focus()
  }

  function handleReplyTargetTransitionEnd(
    event: React.TransitionEvent<HTMLDivElement>,
  ) {
    if (
      !isClosingReplyTarget ||
      event.target !== event.currentTarget ||
      event.propertyName !== 'opacity'
    ) {
      return
    }

    setReplyTarget(null)
    setIsClosingReplyTarget(false)
  }
  const [mentionAnchorPosition, setMentionAnchorPosition] =
    useState<AnchorPosition>({ left: 0, top: 0 })
  const [composerScrollTop, setComposerScrollTop] = useState(0)

  const formRef = useRef<HTMLFormElement | null>(null)
  const mentionAnchorRef = useRef<HTMLSpanElement | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const pendingCursorRef = useRef<number | null>(null)
  const deferredContent = useDeferredValue(content)
  const activeMention = getMentionMatch(deferredContent, cursorPosition)
  const mentionStart = activeMention?.start
  const threads = buildCommentThreads(comments)
  const commentsById = new Map(comments.map((comment) => [comment.id, comment]))
  // Comments present when the thread first renders appear instantly; only
  // ones added afterwards (posted or pushed live) animate in.
  const [initialCommentIds] = useState(
    () => new Set(comments.map((comment) => comment.id)),
  )
  // Avatar colors go to authors in the order they first commented, so the
  // first seven people on a case never share one.
  const authorTints = new Map<string, string>()
  for (const comment of [...comments].sort((first, second) =>
    compareCommentsByNewest(second, first),
  )) {
    if (!authorTints.has(comment.authorId)) {
      authorTints.set(comment.authorId, userTint(authorTints.size))
    }
  }
  const validUsernames = new Set(
    users.map((user) => user.username.toLowerCase()),
  )

  useLayoutEffect(() => {
    if (mentionStart === undefined || !textareaRef.current || !formRef.current)
      return

    const nextPosition = getTextareaCaretPosition(
      textareaRef.current,
      mentionStart,
      formRef.current,
    )

    setMentionAnchorPosition((currentPosition) =>
      currentPosition.left === nextPosition.left &&
      currentPosition.top === nextPosition.top
        ? currentPosition
        : nextPosition,
    )
  }, [mentionStart])

  useLayoutEffect(() => {
    if (pendingCursorRef.current === null || !textareaRef.current) return

    const nextCursorPosition = pendingCursorRef.current
    pendingCursorRef.current = null
    textareaRef.current.focus()
    textareaRef.current.setSelectionRange(
      nextCursorPosition,
      nextCursorPosition,
    )
  }, [content])

  const mentionQuery = activeMention?.query.trim().toLowerCase() ?? ''
  const mentionKey = activeMention
    ? `${activeMention.start}:${mentionQuery}`
    : ''
  const isMentionOpen =
    activeMention !== null && mentionKey !== dismissedMentionKey
  const mentionResults = isMentionOpen
    ? users
        .filter(
          (candidate) =>
            !mentionQuery ||
            candidate.name.toLowerCase().includes(mentionQuery) ||
            candidate.username.toLowerCase().includes(mentionQuery),
        )
        .slice(0, 8)
    : []
  const activeMentionIndex =
    highlightedMention.key === mentionKey
      ? Math.min(highlightedMention.index, mentionResults.length - 1)
      : 0
  const activeMentionCandidate = mentionResults.at(activeMentionIndex)

  function getMentionOptionId(userId: string) {
    return `${mentionListboxId}-${userId}`
  }

  function handleSelectMention(userId: string, name: string) {
    const mention = getMentionMatch(content, cursorPosition)
    if (!mention) return

    const before = content.slice(0, mention.start)
    const after = content.slice(mention.end)
    const token = `@${name}`
    const nextContent = `${before}${token} ${after}`
    const nextCursorPosition = before.length + token.length + 1

    pendingCursorRef.current = nextCursorPosition
    setContent(nextContent)
    setCursorPosition(nextCursorPosition)
    mentionMapRef.current = {
      ...mentionMapRef.current,
      [token]: userId,
    }
  }

  function handleComposerKeyDown(
    event: React.KeyboardEvent<HTMLTextAreaElement>,
  ) {
    if (event.nativeEvent.isComposing) return

    if (isMentionOpen) {
      if (event.key === 'Escape') {
        event.preventDefault()
        setDismissedMentionKey(mentionKey)
        return
      }

      if (mentionResults.length > 0) {
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          event.preventDefault()
          const step = event.key === 'ArrowDown' ? 1 : -1
          const count = mentionResults.length
          setHighlightedMention({
            key: mentionKey,
            index: (activeMentionIndex + step + count) % count,
          })
          return
        }

        if (
          (event.key === 'Enter' || event.key === 'Tab') &&
          !event.shiftKey &&
          activeMentionCandidate
        ) {
          event.preventDefault()
          handleSelectMention(
            activeMentionCandidate.id,
            activeMentionCandidate.username,
          )
          return
        }
      }
    }

    if (event.key === 'Escape' && replyTarget && !isClosingReplyTarget) {
      event.preventDefault()
      setIsClosingReplyTarget(true)
    }
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmedContent = content.trim()
    if (!trimmedContent) return

    const mentions = Array.from(
      new Set(
        Object.entries(mentionMapRef.current).flatMap(([token, id]) =>
          trimmedContent.includes(token) ? [id] : [],
        ),
      ),
    )

    createComment.mutate(
      {
        content: trimmedContent,
        parentId: replyTarget?.id ?? undefined,
        mentions: mentions.length > 0 ? mentions : undefined,
      },
      {
        onSuccess: () => {
          setContent('')
          setCursorPosition(0)
          setIsClosingReplyTarget(false)
          setReplyTarget(null)
          mentionMapRef.current = {}
        },
      },
    )
  }

  const submitLabel = replyTarget
    ? createComment.isPending
      ? 'Replying…'
      : 'Reply'
    : createComment.isPending
      ? 'Sending…'
      : 'Send'

  const emptyState = (
    <div className="flex min-h-full flex-1 flex-col rounded-xl border border-dashed border-border/70 bg-muted/20 px-4 py-10">
      <EmptyState
        icon={MessageSquareMore}
        title="No conversation yet."
        description={canPost ? 'Write the first comment above.' : undefined}
        className="m-auto"
      />
    </div>
  )

  const contentBody = (
    <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-hidden">
      {canPost ? (
        <Popover
          open={isMentionOpen}
          onOpenChange={(open) => {
            if (!open) setDismissedMentionKey(mentionKey)
          }}
        >
          <form
            ref={formRef}
            onSubmit={handleSubmit}
            className="relative min-w-0 rounded-xl border border-border/70 bg-background p-3 shadow-sm"
          >
            <span
              ref={mentionAnchorRef}
              aria-hidden="true"
              className="pointer-events-none absolute size-1 opacity-0"
              style={{
                left: mentionAnchorPosition.left,
                top: mentionAnchorPosition.top,
              }}
            />

            <div className="flex min-w-0 flex-1 flex-col gap-3">
              {replyTarget ? (
                <div
                  data-motion={isClosingReplyTarget ? 'exiting' : 'entering'}
                  className="motion-reply-target flex min-w-0 flex-wrap items-center gap-2 rounded-xs border border-border/70 bg-muted/40 px-3 py-2 text-xs text-muted-foreground"
                  onTransitionEnd={handleReplyTargetTransitionEnd}
                >
                  <CornerDownRight
                    className="size-3.5 shrink-0"
                    aria-hidden="true"
                  />
                  <span className="min-w-0 flex-1 truncate">
                    Replying to {replyTarget.authorName ?? 'Unknown'}:{' '}
                    {replyTarget.content}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    className="ms-auto"
                    onClick={handleCancelReply}
                    aria-label="Cancel reply"
                  >
                    <X />
                  </Button>
                </div>
              ) : null}

              <div className="relative min-h-6 min-w-0">
                <div
                  aria-hidden="true"
                  className={`pointer-events-none absolute inset-0 z-0 min-h-6 overflow-hidden text-foreground/90 ${composerTypographyClassName}`}
                >
                  <div
                    style={{
                      transform: `translateY(-${composerScrollTop}px)`,
                    }}
                  >
                    {content
                      ? renderMentionText(content, validUsernames)
                      : null}
                  </div>
                </div>

                <Textarea
                  ref={textareaRef}
                  value={content}
                  aria-label={
                    replyTarget
                      ? `Reply to ${replyTarget.authorName ?? 'comment'}`
                      : 'Comment'
                  }
                  aria-autocomplete="list"
                  aria-controls={
                    mentionResults.length > 0 ? mentionListboxId : undefined
                  }
                  aria-activedescendant={
                    activeMentionCandidate
                      ? getMentionOptionId(activeMentionCandidate.id)
                      : undefined
                  }
                  onChange={(event) => {
                    setContent(event.target.value)
                    setCursorPosition(event.target.selectionStart)
                  }}
                  onKeyDown={handleComposerKeyDown}
                  onSelect={(event) =>
                    setCursorPosition(event.currentTarget.selectionStart)
                  }
                  onClick={(event) =>
                    setCursorPosition(event.currentTarget.selectionStart)
                  }
                  onScroll={(event) =>
                    setComposerScrollTop(event.currentTarget.scrollTop)
                  }
                  placeholder={
                    replyTarget
                      ? `Reply to ${replyTarget.authorName ?? 'this comment'}…`
                      : 'Write a comment. Use @ to mention a teammate.'
                  }
                  className={`scrollbar-none relative z-10 min-h-6 max-h-24 resize-none overflow-y-auto border-0 bg-transparent px-0 py-0 text-transparent shadow-none caret-foreground selection:bg-primary/20 placeholder:text-muted-foreground focus-visible:ring-0 ${composerTypographyClassName}`}
                />
              </div>

              <div className="flex flex-wrap items-center justify-end gap-3">
                <Button
                  type="submit"
                  disabled={!content.trim() || createComment.isPending}
                >
                  {createComment.isPending ? (
                    <Spinner data-icon="inline-start" />
                  ) : (
                    <SendHorizontal data-icon="inline-start" />
                  )}
                  {submitLabel}
                </Button>
              </div>
            </div>
          </form>

          {/* Focus stays in the textarea: it drives this list with the arrow
              keys, Enter/Tab and Escape via aria-activedescendant. */}
          <PopoverContent
            anchor={mentionAnchorRef}
            align="start"
            side="bottom"
            sideOffset={6}
            initialFocus={false}
            finalFocus={false}
            className="w-72 p-1"
          >
            {mentionResults.length === 0 ? (
              <p className="px-2 py-6 text-center text-sm text-muted-foreground">
                No teammates match “{activeMention?.query}”.
              </p>
            ) : (
              <>
                <p
                  id={`${mentionListboxId}-label`}
                  className="px-2 py-1.5 text-xs font-medium text-muted-foreground"
                >
                  Team members
                </p>
                <div
                  id={mentionListboxId}
                  role="listbox"
                  aria-labelledby={`${mentionListboxId}-label`}
                  className="scrollbar-none max-h-64 overflow-y-auto"
                >
                  {mentionResults.map((candidate, index) => (
                    <div
                      key={candidate.id}
                      id={getMentionOptionId(candidate.id)}
                      role="option"
                      tabIndex={-1}
                      aria-selected={index === activeMentionIndex}
                      data-highlighted={
                        index === activeMentionIndex ? '' : undefined
                      }
                      // Keep focus (and the caret) in the textarea.
                      onMouseDown={(event) => event.preventDefault()}
                      onMouseMove={() => {
                        if (index !== activeMentionIndex) {
                          setHighlightedMention({ key: mentionKey, index })
                        }
                      }}
                      onClick={() =>
                        handleSelectMention(candidate.id, candidate.username)
                      }
                      className="flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm select-none data-highlighted:bg-accent data-highlighted:text-accent-foreground"
                    >
                      <UserRound
                        className="size-4 shrink-0 text-muted-foreground"
                        aria-hidden="true"
                      />
                      <span className="min-w-0 truncate">{candidate.name}</span>
                      <span className="ms-auto shrink-0 text-xs text-muted-foreground">
                        @{candidate.username}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </PopoverContent>
        </Popover>
      ) : (
        <Alert variant="warning">
          <AlertTitle>Read-only chatter</AlertTitle>
          <AlertDescription>
            You need access to this case before you can post updates or replies.
          </AlertDescription>
        </Alert>
      )}

      {/* Newest comments sit at the top, so the jump button points to the
          start. Comments added there show in place instead of the view
          being held on the older ones. */}
      <MessageScrollerProvider autoScroll={false} defaultScrollPosition="start">
        <MessageScroller className="min-h-0 flex-1">
          <MessageScrollerViewport
            aria-label="Comments"
            preserveScrollOnPrepend={false}
            className="pe-1"
          >
            <MessageScrollerContent>
              {threads.roots.length === 0
                ? emptyState
                : groupThreadsByDay(threads.roots).map((group) => (
                    <section
                      key={group.day}
                      aria-label={group.label}
                      className="flex min-w-0 flex-col gap-3"
                    >
                      <Marker
                        variant="separator"
                        className="text-xs font-medium"
                      >
                        <MarkerContent>{group.label}</MarkerContent>
                      </Marker>
                      <div className="flex min-w-0 flex-col gap-6">
                        {group.roots.map((comment) => (
                          <CommentThread
                            key={comment.id}
                            comment={comment}
                            childrenByParent={threads.childrenByParent}
                            commentsById={commentsById}
                            initialCommentIds={initialCommentIds}
                            validUsernames={validUsernames}
                            authorTints={authorTints}
                            currentUserId={currentUser?.id}
                            onReply={canPost ? handleSelectReply : undefined}
                          />
                        ))}
                      </div>
                    </section>
                  ))}
            </MessageScrollerContent>
          </MessageScrollerViewport>
          <MessageScrollerButton direction="start">
            <ArrowDown />
            <span className="sr-only">Jump to newest comments</span>
          </MessageScrollerButton>
        </MessageScroller>
      </MessageScrollerProvider>
    </div>
  )

  if (embedded) {
    return contentBody
  }

  return (
    <Card className="min-h-128 xl:h-[calc(100dvh-7rem)] xl:min-h-0">
      <CardHeader className="gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <CardTitle>Chatter</CardTitle>
            <CardDescription>
              Keep reviewer notes and coordination visible inside the case.
            </CardDescription>
          </div>
          <Badge variant="secondary">
            {comments.length} {comments.length === 1 ? 'message' : 'messages'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col">
        {contentBody}
      </CardContent>
    </Card>
  )
}

function CommentThread({
  comment,
  childrenByParent,
  commentsById,
  initialCommentIds,
  validUsernames,
  authorTints,
  currentUserId,
  onReply,
}: {
  comment: CaseComment
  childrenByParent: Map<string, CaseComment[]>
  commentsById: Map<string, CaseComment>
  initialCommentIds: Set<string>
  validUsernames: ReadonlySet<string>
  authorTints: ReadonlyMap<string, string>
  currentUserId: string | undefined
  onReply?: (comment: CaseComment) => void
}) {
  const replies = getThreadReplies(comment.id, childrenByParent)

  // Replies share one indent level, so a reply to another reply names who
  // it answers.
  function getReplyTarget(reply: CaseComment) {
    if (!reply.parentId || reply.parentId === comment.id) return undefined
    const parent = commentsById.get(reply.parentId)
    if (!parent) return undefined
    return (
      formatUsername(parent.authorUsername) ?? parent.authorName ?? 'Unknown'
    )
  }

  return (
    <div
      className={cn(
        'flex w-full min-w-0 flex-col gap-1',
        !initialCommentIds.has(comment.id) && 'motion-list-item',
      )}
      data-motion={initialCommentIds.has(comment.id) ? undefined : 'entering'}
    >
      <CommentItem
        comment={comment}
        validUsernames={validUsernames}
        avatarClassName={authorTints.get(comment.authorId)}
        isOwn={comment.authorId === currentUserId}
        onReply={onReply}
      />

      {replies.length > 0 ? (
        // The rail sits under the root avatar's center (p-2 + size-8 → 24px).
        <div className="relative ms-6 flex min-w-0 flex-col gap-1 border-s border-border/80 ps-5">
          {replies.map((reply) => (
            <div
              key={reply.id}
              className={cn(
                'relative min-w-0',
                !initialCommentIds.has(reply.id) && 'motion-list-item',
              )}
              data-motion={
                initialCommentIds.has(reply.id) ? undefined : 'entering'
              }
            >
              <div
                aria-hidden="true"
                className="absolute -inset-s-5.25 top-6 h-px w-6 bg-border"
              />
              <CommentItem
                comment={reply}
                validUsernames={validUsernames}
                avatarClassName={authorTints.get(reply.authorId)}
                isOwn={reply.authorId === currentUserId}
                onReply={onReply}
                replyTo={getReplyTarget(reply)}
              />
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function CommentItem({
  comment,
  validUsernames,
  avatarClassName,
  isOwn,
  onReply,
  replyTo,
}: {
  comment: CaseComment
  validUsernames: ReadonlySet<string>
  /** The author's tint, assigned per case in first-comment order. */
  avatarClassName: string | undefined
  /** Written by the signed-in user: marked with a "You" badge. */
  isOwn: boolean
  onReply?: (comment: CaseComment) => void
  /** Who a reply-to-a-reply answers, shown above its text. */
  replyTo?: string
}) {
  const authorName = comment.authorName ?? 'Unknown'
  const username = formatUsername(comment.authorUsername)

  return (
    <article
      aria-label={isOwn ? 'Your comment' : `Comment from ${authorName}`}
      className="flex w-full min-w-0 items-start gap-3 rounded-lg p-2 transition-colors duration-150 hover:bg-muted/40 has-focus-visible:bg-muted/40"
    >
      <Avatar className="shrink-0">
        <AvatarFallback className={cn('text-xs font-medium', avatarClassName)}>
          {getInitials(comment.authorName)}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="flex min-h-8 min-w-0 items-center gap-2">
          <TruncatedTooltip
            render={
              <p className="min-w-0 truncate text-sm font-semibold tracking-tight" />
            }
            content={authorName}
          >
            {authorName}
          </TruncatedTooltip>
          {isOwn ? (
            <Badge variant="outline" className="shrink-0 bg-background">
              You
            </Badge>
          ) : null}
          {username ? (
            <TruncatedTooltip
              render={
                <p className="min-w-0 shrink-2 truncate text-xs text-muted-foreground" />
              }
              content={username}
            >
              {username}
            </TruncatedTooltip>
          ) : null}
          <CommentTime value={comment.createdAt} />
        </div>
        {replyTo ? (
          <p className="flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
            <CornerDownRight className="size-3 shrink-0" aria-hidden="true" />
            <span className="min-w-0 wrap-anywhere">Replying to {replyTo}</span>
          </p>
        ) : null}
        <p
          className={cn(
            'wrap-anywhere whitespace-pre-wrap text-sm leading-6 text-foreground/90',
            replyTo && 'mt-1',
          )}
        >
          {renderMentionText(comment.content, validUsernames)}
        </p>
        {onReply ? (
          <Button
            type="button"
            variant="ghost"
            size="xs"
            className="mt-1 -ms-1.5 text-muted-foreground"
            onClick={() => onReply(comment)}
          >
            <CornerDownRight data-icon="inline-start" />
            Reply
          </Button>
        ) : null}
      </div>
    </article>
  )
}

/** Relative within a week, a short date after; the full date on hover. */
function CommentTime({ value }: { value: string }) {
  const date = new Date(value)
  const fullLabel = CHATTER_DATE_TIME_FORMATTER.format(date)
  const shortLabel =
    differenceInCalendarDays(new Date(), date) < 7
      ? formatDistanceToNowStrict(date, { addSuffix: true })
      : CHATTER_DATE_FORMATTER.format(date)

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <time
            dateTime={value}
            className="ms-auto shrink-0 text-xs text-muted-foreground tabular-nums"
          />
        }
      >
        <span aria-hidden="true">{shortLabel}</span>
        <span className="sr-only">{fullLabel}</span>
      </TooltipTrigger>
      <TooltipContent>{fullLabel}</TooltipContent>
    </Tooltip>
  )
}

const CHATTER_DATE_TIME_FORMATTER = new Intl.DateTimeFormat('en-PK', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Asia/Karachi',
})

const CHATTER_DATE_FORMATTER = new Intl.DateTimeFormat('en-PK', {
  dateStyle: 'medium',
  timeZone: 'Asia/Karachi',
})

// YYYY-MM-DD in Karachi time, to compare calendar days.
const CHATTER_DAY_KEY_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Karachi',
})
