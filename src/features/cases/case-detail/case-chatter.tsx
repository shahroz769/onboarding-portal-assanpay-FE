import { useDeferredValue, useLayoutEffect, useRef, useState } from 'react'
import { useSuspenseQuery } from '@tanstack/react-query'
import {
  CornerDownRight,
  MessageSquareMore,
  SendHorizontal,
  UserRound,
  X,
} from 'lucide-react'

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
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '#/components/ui/command'
import { Popover, PopoverAnchor, PopoverContent } from '#/components/ui/popover'
import { ScrollArea } from '#/components/ui/scroll-area'
import { Spinner } from '#/components/ui/spinner'
import { Textarea } from '#/components/ui/textarea'
import {
  caseCommentsQueryOptions,
  useCreateComment,
} from '#/hooks/use-case-detail-query'
import { usersQueryOptions } from '#/hooks/use-users-query'
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

function formatDateTime(value: string) {
  return CHATTER_DATE_TIME_FORMATTER.format(new Date(value))
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

  mirror.textContent = textarea.value.slice(0, position) || '\u200b'
  marker.textContent = '\u200b'
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

function renderCommentText(content: string) {
  const parts = content.split(/(@[^\s]+)/g).filter(Boolean)

  return parts.map((part, index) =>
    part.startsWith('@') ? (
      <span
        key={`${part}-${index}`}
        className="break-all rounded-full bg-sky-500/10 px-1.5 py-0.5 font-semibold text-sky-700"
      >
        {part}
      </span>
    ) : (
      <span key={`${part}-${index}`}>{part}</span>
    ),
  )
}

const composerTypographyClassName =
  'text-base leading-6 break-words whitespace-pre-wrap [overflow-wrap:anywhere] md:text-sm'

function renderComposerText(
  content: string,
  validUsernames: ReadonlySet<string>,
) {
  const parts = content.split(/(@[A-Za-z0-9._-]+)/g)

  return parts.map((part, index) => {
    const isValidMention =
      part.startsWith('@') && validUsernames.has(part.slice(1).toLowerCase())

    return (
      <span
        key={`${part}-${index}`}
        className={
          isValidMention
            ? 'rounded-sm bg-sky-500/10 text-sky-700 [box-decoration-break:clone]'
            : undefined
        }
      >
        {part}
      </span>
    )
  })
}

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

  roots.sort(compareCommentsByNewest)

  for (const [parentId, siblings] of childrenByParent.entries()) {
    childrenByParent.set(parentId, [...siblings].sort(compareCommentsByNewest))
  }

  return {
    roots,
    childrenByParent,
  }
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
  const { data: users } = useSuspenseQuery(usersQueryOptions())
  const createComment = useCreateComment(caseId)

  const [content, setContent] = useState('')
  const [cursorPosition, setCursorPosition] = useState(0)
  const [replyTarget, setReplyTarget] = useState<CaseComment | null>(null)
  const [isClosingReplyTarget, setIsClosingReplyTarget] = useState(false)
  const mentionMapRef = useRef<Record<string, string>>({})
  const [mentionSearchOverride, setMentionSearchOverride] = useState<
    string | null
  >(null)

  function handleSelectReply(comment: CaseComment) {
    setIsClosingReplyTarget(false)
    setReplyTarget(comment)
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
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const pendingCursorRef = useRef<number | null>(null)
  const deferredContent = useDeferredValue(content)
  const activeMention = getMentionMatch(deferredContent, cursorPosition)
  const threads = buildCommentThreads(comments)
  const validUsernames = new Set(
    users.map((user) => user.username.toLowerCase()),
  )

  useLayoutEffect(() => {
    if (!activeMention || !textareaRef.current || !formRef.current) return

    const nextPosition = getTextareaCaretPosition(
      textareaRef.current,
      activeMention.start,
      formRef.current,
    )

    setMentionAnchorPosition((currentPosition) =>
      currentPosition.left === nextPosition.left &&
      currentPosition.top === nextPosition.top
        ? currentPosition
        : nextPosition,
    )
  }, [activeMention?.start])

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

  const mentionSearch = mentionSearchOverride ?? activeMention?.query ?? ''
  const mentionQuery = mentionSearch.trim().toLowerCase()
  const hasMentionQuery = mentionQuery.length > 0
  const mentionCandidates = users.filter((candidate) => {
    if (!activeMention || !hasMentionQuery) return false

    return (
      candidate.name.toLowerCase().includes(mentionQuery) ||
      candidate.username.toLowerCase().includes(mentionQuery) ||
      candidate.email.toLowerCase().includes(mentionQuery)
    )
  })
  const mentionResults = mentionCandidates.slice(0, 8)
  const mentionResultsHeight = Math.min(256, 44 + mentionResults.length * 36)

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
    setMentionSearchOverride(null)
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

  const emptyState = (
    <div className="flex min-h-full flex-1 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border/70 bg-muted/20 px-4 py-10 text-center">
      <div className="flex size-12 items-center justify-center rounded-full border border-border/70 bg-background shadow-sm">
        <MessageSquareMore className="size-5 text-muted-foreground" />
      </div>
      <p className="text-sm font-medium">No conversation yet</p>
    </div>
  )

  const contentBody = (
    <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-hidden">
      {canPost ? (
        <Popover open={Boolean(activeMention)}>
          <form
            ref={formRef}
            onSubmit={handleSubmit}
            className="relative min-w-0 rounded-2xl border border-border/70 bg-background p-3 shadow-sm"
          >
            <PopoverAnchor asChild>
              <span
                aria-hidden="true"
                className="pointer-events-none absolute size-1 opacity-0"
                style={{
                  left: mentionAnchorPosition.left,
                  top: mentionAnchorPosition.top,
                }}
              />
            </PopoverAnchor>

            <div className="flex min-w-0 flex-1 flex-col gap-3">
              {replyTarget ? (
                <div
                  data-motion={isClosingReplyTarget ? 'exiting' : 'entering'}
                  className="motion-reply-target flex min-w-0 flex-wrap items-center gap-2 rounded-xl border border-border/70 bg-muted/40 px-3 py-2 text-xs text-muted-foreground"
                  onTransitionEnd={handleReplyTargetTransitionEnd}
                >
                  <CornerDownRight className="size-3.5 shrink-0" />
                  <span className="min-w-0 flex-1 truncate">
                    Replying to {replyTarget.authorName ?? 'Unknown'}:{' '}
                    {replyTarget.content}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    className="ml-auto"
                    onClick={() => setIsClosingReplyTarget(true)}
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
                      ? renderComposerText(content, validUsernames)
                      : null}
                  </div>
                </div>

                <Textarea
                  ref={textareaRef}
                  value={content}
                  onChange={(event) => {
                    setContent(event.target.value)
                    setCursorPosition(event.target.selectionStart)
                    setMentionSearchOverride(null)
                  }}
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
                      ? `Reply to ${replyTarget.authorName ?? 'this comment'}...`
                      : 'Write a review note. Use @ to mention a teammate.'
                  }
                  className={`scrollbar-none relative z-10 h-6 max-h-24 resize-none overflow-y-auto border-0 bg-transparent px-0 py-0 text-transparent shadow-none caret-foreground selection:bg-primary/20 placeholder:text-muted-foreground focus-visible:ring-0 ${composerTypographyClassName}`}
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
                  {createComment.isPending ? 'Posting reply' : 'Post update'}
                </Button>
              </div>
            </div>
          </form>

          <PopoverContent
            align="start"
            side="bottom"
            sideOffset={6}
            className="w-80 p-0"
          >
            <Command shouldFilter={false}>
              <CommandInput
                value={mentionSearch}
                onValueChange={setMentionSearchOverride}
                placeholder="Search employees"
              />

              {hasMentionQuery ? (
                <CommandList className="max-h-none overflow-hidden">
                  {mentionCandidates.length === 0 ? (
                    <CommandEmpty>No matching users found.</CommandEmpty>
                  ) : (
                    <ScrollArea style={{ height: mentionResultsHeight }}>
                      <CommandGroup heading="Team members">
                        {mentionResults.map((candidate) => (
                          <CommandItem
                            key={candidate.id}
                            value={candidate.id}
                            onSelect={() =>
                              handleSelectMention(
                                candidate.id,
                                candidate.username,
                              )
                            }
                          >
                            <UserRound />
                            <span>{candidate.name}</span>
                            <span className="ml-auto text-xs text-muted-foreground">
                              @{candidate.username}
                            </span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </ScrollArea>
                  )}
                </CommandList>
              ) : null}
            </Command>
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

      <div className="scrollbar-none flex min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain pr-1">
        {threads.roots.length === 0 ? (
          emptyState
        ) : (
          <div className="flex w-full min-w-0 flex-col gap-4">
            {threads.roots.map((comment) => (
              <CommentThread
                key={comment.id}
                comment={comment}
                childrenByParent={threads.childrenByParent}
                onReply={canPost ? handleSelectReply : undefined}
              />
            ))}
          </div>
        )}
      </div>
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
  onReply,
}: {
  comment: CaseComment
  childrenByParent: Map<string, CaseComment[]>
  onReply?: (comment: CaseComment) => void
}) {
  const replies = getThreadReplies(comment.id, childrenByParent)

  return (
    <div className="flex w-full min-w-0 flex-col gap-3">
      <CommentCard comment={comment} onReply={onReply} />

      {replies.length > 0 ? (
        <div className="relative ml-3 flex min-w-0 flex-col gap-3 border-l border-border/80 pl-4 sm:ml-5 sm:pl-5">
          {replies.map((reply) => (
            <div key={reply.id} className="relative min-w-0">
              <div className="absolute -left-[21px] top-5 hidden h-px w-4 bg-border sm:block" />
              <CommentCard comment={reply} onReply={onReply} nested />
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function CommentCard({
  comment,
  onReply,
  nested = false,
}: {
  comment: CaseComment
  onReply?: (comment: CaseComment) => void
  nested?: boolean
}) {
  return (
    <div
      className={[
        'w-full min-w-0 rounded-xl border border-border/70 p-3 shadow-sm transition-colors sm:p-4',
        nested
          ? 'bg-background/95 shadow-[0_1px_2px_rgba(15,23,42,0.04)]'
          : 'bg-card',
      ].join(' ')}
    >
      <div className="flex min-w-0 items-start gap-3">
        <Avatar className="size-9 shrink-0 sm:size-10">
          <AvatarFallback>{getInitials(comment.authorName)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold tracking-tight">
                {comment.authorName ?? 'Unknown'}
              </p>
              {formatUsername(comment.authorUsername) ? (
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {formatUsername(comment.authorUsername)}
                </p>
              ) : null}
            </div>
            <span className="max-w-full truncate text-xs font-medium text-muted-foreground sm:shrink-0">
              {formatDateTime(comment.createdAt)}
            </span>
          </div>
          <p className="mt-3 break-words whitespace-pre-wrap text-sm leading-6 text-foreground/90 [overflow-wrap:anywhere]">
            {renderCommentText(comment.content)}
          </p>
          {onReply ? (
            <div className="mt-3 flex items-center gap-2 border-t border-border/60 pt-2">
              <Button
                type="button"
                variant="ghost"
                size="xs"
                onClick={() => onReply(comment)}
              >
                <CornerDownRight data-icon="inline-start" />
                Reply
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
const CHATTER_DATE_TIME_FORMATTER = new Intl.DateTimeFormat('en-PK', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Asia/Karachi',
})
