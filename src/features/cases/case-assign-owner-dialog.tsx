import { useEffect, useState } from 'react'
import { CheckIcon, ChevronsUpDownIcon } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'

import { cn } from '#/lib/utils'
import { Button } from '#/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '#/components/ui/command'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
import { Field, FieldLabel } from '#/components/ui/field'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '#/components/ui/popover'
import { Spinner } from '#/components/ui/spinner'
import { useAssignCaseMutation, usersQueryOptions } from '#/hooks/use-cases-query'

interface CaseAssignOwnerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  caseId: string
  caseNumber: string
  currentOwnerId: string | null
  currentOwnerName: string | null
}

export function CaseAssignOwnerDialog({
  open,
  onOpenChange,
  caseId,
  caseNumber,
  currentOwnerId,
  currentOwnerName,
}: CaseAssignOwnerDialogProps) {
  const [popoverOpen, setPopoverOpen] = useState(false)
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [initialized, setInitialized] = useState(false)

  const { data: users = [] } = useQuery(usersQueryOptions())
  const assignMutation = useAssignCaseMutation()

  const options = [
    { label: 'Unassigned', value: '__unassigned__' },
    ...users.map((u) => ({ label: u.name, value: u.id })),
  ]

  const internalValue = selectedUserId === null ? '__unassigned__' : selectedUserId
  const resolvedOwnerId = internalValue === '__unassigned__' ? null : internalValue
  const hasChanged = initialized && resolvedOwnerId !== currentOwnerId
  const selectedLabel = options.find((o) => o.value === internalValue)?.label ?? 'Select owner...'

  useEffect(() => {
    if (open) {
      setSelectedUserId(currentOwnerId)
      setInitialized(false)
    }
  }, [open, currentOwnerId])

  function handleSelect(value: string) {
    setSelectedUserId(value === '__unassigned__' ? null : value)
    setInitialized(true)
    setPopoverOpen(false)
  }

  function handleSubmit() {
    assignMutation.mutate(
      { caseId, ownerId: resolvedOwnerId },
      {
        onSuccess: () => onOpenChange(false),
      },
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Assign Case Owner</DialogTitle>
          <DialogDescription>
            Change the owner for case{' '}
            <span className="font-mono font-medium">{caseNumber}</span>.
            Currently assigned to{' '}
            <span className="font-medium">
              {currentOwnerName ?? 'AP System'}
            </span>
            .
          </DialogDescription>
        </DialogHeader>

        <Field>
          <FieldLabel className="sr-only">Owner</FieldLabel>
          <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={popoverOpen}
                className="w-full justify-between font-normal"
              >
                {selectedLabel}
                <ChevronsUpDownIcon data-icon="inline-end" className="opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
              <Command>
                <CommandInput placeholder="Search users..." />
                <CommandList>
                  <CommandEmpty>No users found.</CommandEmpty>
                  <CommandGroup>
                    {options.map((option) => (
                      <CommandItem
                        key={option.value}
                        value={option.label}
                        onSelect={() => handleSelect(option.value)}
                      >
                        {option.label}
                        <CheckIcon
                          data-icon="inline-end"
                          className={cn(
                            'ml-auto',
                            internalValue === option.value ? 'opacity-100' : 'opacity-0',
                          )}
                        />
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </Field>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!hasChanged || assignMutation.isPending}
          >
            {assignMutation.isPending && (
              <Spinner data-icon="inline-start" />
            )}
            Assign
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
