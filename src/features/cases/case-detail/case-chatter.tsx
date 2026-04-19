import {
  useDeferredValue,
  useRef,
  useState,
} from 'react'
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
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from '#/components/ui/popover'
import { Spinner } from '#/components/ui/spinner'
import { Textarea } from '#/components/ui/textarea'
import {
  caseCommentsQueryOptions,
  useCreateComment,
} from '#/hooks/use-case-detail-query'
import { usersQueryOptions } from '#/hooks/use-cases-query'
import type { CaseComment } from '#/schemas/cases.schema'

interface CaseChatterProps {
  caseId: string
  embedded?: boolean
}

type MentionMatch = {
  query: string
  start: number
  end: number
}

function compareCommentsByNewest(first: CaseComment, second: CaseComment) {
  return new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime()
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('en-PK', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
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

function getMentionMatch(content: string, caretPosition: number): MentionMatch | null {
  const prefix = content.slice(0, caretPosition)
  const match = prefix.match(/(^|\s)@([^\s@]*)$/)

  if (!match) return null

  return {
    query: match[2] ?? '',
    start: caretPosition - (match[2]?.length ?? 0) - 1,
    end: caretPosition,
  }
}

function renderCommentText(content: string) {
  const parts = content.split(/(@[^\s]+)/g).filter(Boolean)

  return parts.map((part, index) =>
    part.startsWith('@') ? (
      <span
        key={`${part}-${index}`}
        className="rounded-full bg-sky-500/10 px-1.5 py-0.5 font-semibold text-sky-700"
      >
        {part}
      </span>
    ) : (
      <span key={`${part}-${index}`}>{part}</span>
    ),
  )
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
    childrenByParent.set(parentId, siblings.toSorted(compareCommentsByNewest))
  }

  return {
    roots,
    childrenByParent,
  }
}

export function CaseChatter({
  caseId,
  embedded = false,
}: CaseChatterProps) {
  const { data: comments } = useSuspenseQuery(caseCommentsQueryOptions(caseId))
  const { data: users } = useSuspenseQuery(usersQueryOptions())
  const createComment = useCreateComment(caseId)

  const [content, setContent] = useState('')
  const [cursorPosition, setCursorPosition] = useState(0)
  const [replyTarget, setReplyTarget] = useState<CaseComment | null>(null)
  const [mentionMap, setMentionMap] = useState<Record<string, string>>({})

  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const deferredContent = useDeferredValue(content)
  const activeMention = getMentionMatch(deferredContent, cursorPosition)
  const threads = buildCommentThreads(comments)

  const mentionCandidates = users.filter((candidate) => {
    if (!activeMention) return false

    const query = activeMention.query.trim().toLowerCase()
    if (!query) return true

    return (
      candidate.name.toLowerCase().includes(query) ||
      candidate.username.toLowerCase().includes(query) ||
      candidate.email.toLowerCase().includes(query)
    )
  })

  function handleSelectMention(userId: string, name: string) {
    if (!activeMention) return

    const before = content.slice(0, activeMention.start)
    const after = content.slice(activeMention.end)
    const token = `@${name}`
    const nextContent = `${before}${token} ${after}`
    const nextCursorPosition = before.length + token.length + 1

    setContent(nextContent)
    setCursorPosition(nextCursorPosition)
    setMentionMap((currentMap) => ({
      ...currentMap,
      [token]: userId,
    }))

    requestAnimationFrame(() => {
      if (!textareaRef.current) return
      textareaRef.current.focus()
      textareaRef.current.setSelectionRange(
        nextCursorPosition,
        nextCursorPosition,
      )
    })
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmedContent = content.trim()
    if (!trimmedContent) return

    const mentions = Array.from(
      new Set(
        Object.entries(mentionMap)
          .filter(([token]) => trimmedContent.includes(token))
          .map(([, id]) => id),
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
          setReplyTarget(null)
          setMentionMap({})
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
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <Popover open={Boolean(activeMention)}>
        <PopoverAnchor asChild>
          <form
            onSubmit={handleSubmit}
            className="rounded-2xl border border-border/70 bg-background p-3 shadow-sm"
          >
            <div className="flex min-w-0 flex-1 flex-col gap-3">
                {replyTarget ? (
                  <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border/70 bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                    <CornerDownRight className="size-3.5" />
                    <span>
                      Replying to {replyTarget.authorName ?? 'Unknown'}:
                      {' '}
                      {replyTarget.content}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      className="ml-auto"
                      onClick={() => setReplyTarget(null)}
                    >
                      <X />
                    </Button>
                  </div>
                ) : null}

                <Textarea
                  ref={textareaRef}
                  value={content}
                  onChange={(event) => {
                    setContent(event.target.value)
                    setCursorPosition(event.target.selectionStart ?? 0)
                  }}
                  onSelect={(event) =>
                    setCursorPosition(event.currentTarget.selectionStart ?? 0)
                  }
                  onClick={(event) =>
                    setCursorPosition(event.currentTarget.selectionStart ?? 0)
                  }
                  placeholder={
                    replyTarget
                      ? `Reply to ${replyTarget.authorName ?? 'this comment'}...`
                      : 'Write a review note. Use @ to mention a teammate.'
                  }
                  className="h-6 max-h-24 resize-none overflow-y-auto border-0 bg-transparent px-0 py-0 leading-6 shadow-none focus-visible:ring-0"
                />

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
        </PopoverAnchor>

        <PopoverContent align="start" className="w-80 p-0">
          <Command shouldFilter={false}>
            <CommandInput placeholder="Mention a teammate" />
            <CommandList>
              <CommandEmpty>No matching users found.</CommandEmpty>
              <CommandGroup heading="Team members">
                {mentionCandidates.slice(0, 8).map((candidate) => (
                  <CommandItem
                    key={candidate.id}
                    value={candidate.id}
                    onSelect={() =>
                      handleSelectMention(candidate.id, candidate.username)
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
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      <div className="flex min-h-0 flex-1 overflow-y-auto pr-1">
        {threads.roots.length === 0 ? (
          emptyState
        ) : (
          <div className="flex w-full min-w-0 flex-col gap-4">
            {threads.roots.map((comment) => (
              <CommentThread
                key={comment.id}
                comment={comment}
                childrenByParent={threads.childrenByParent}
                onReply={setReplyTarget}
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
  depth = 0,
}: {
  comment: CaseComment
  childrenByParent: Map<string, CaseComment[]>
  onReply: (comment: CaseComment) => void
  depth?: number
}) {
  const replies = childrenByParent.get(comment.id) ?? []
  const isNestedReply = depth > 0

  return (
    <div className="flex w-full min-w-0 flex-col gap-3">
      <div
        className={[
          'w-full rounded-2xl border border-border/70 p-4 shadow-sm transition-colors',
          isNestedReply
            ? 'bg-background/95 shadow-[0_1px_2px_rgba(15,23,42,0.04)]'
            : 'bg-card',
        ].join(' ')}
      >
        <div className="flex items-start gap-3">
          <Avatar className="size-10 shrink-0">
            <AvatarFallback>{getInitials(comment.authorName)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-start justify-between gap-3">
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
              <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                {formatDateTime(comment.createdAt)}
              </span>
            </div>
            <p className="mt-3 wrap-break-word whitespace-pre-wrap text-sm leading-6 text-foreground/90">
              {renderCommentText(comment.content)}
            </p>
            <div className="mt-4 flex items-center gap-2 border-t border-border/60 pt-3">
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
          </div>
        </div>
      </div>

      {replies.length > 0 ? (
        <div className="relative ml-5 flex min-w-0 flex-col gap-3 pl-7">
          {/* Continuous vertical thread rail */}
          <div className="absolute left-2.25 top-0 bottom-6 w-0.5 rounded-full bg-linear-to-b from-primary/30 via-primary/20 to-transparent" />
          {replies.map((reply, index) => (
            <div key={reply.id} className="relative min-w-0">
              {/* Curved elbow connector */}
              <div className="absolute -left-4.75 top-0 h-5.5 w-5 rounded-bl-xl border-b-2 border-l-2 border-primary/30" />
              {/* Junction dot */}
              <div className="absolute -left-0.75 top-4.5 size-2.5 rounded-full bg-primary/25 ring-2 ring-background" />
              <CommentThread
                comment={reply}
                childrenByParent={childrenByParent}
                onReply={onReply}
                depth={depth + 1}
              />
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}
