import { useState } from 'react'
import { AlertCircleIcon, CheckIcon, ChevronsUpDownIcon } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'

import { cn } from '#/lib/utils'
import { getApiErrorMessage } from '#/lib/get-api-error-message'
import { Alert, AlertDescription } from '#/components/ui/alert'
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
import { useAssignCaseMutation } from '#/hooks/use-cases-query'
import { userDirectoryQueryOptions } from '#/hooks/use-users-query'

interface CaseAssignOwnerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  caseId: string
  caseNumber: string
  currentOwnerId: string | null
  isClosed: boolean
}

export function CaseAssignOwnerDialog({
  open,
  onOpenChange,
  caseId,
  caseNumber,
  currentOwnerId,
  isClosed,
}: CaseAssignOwnerDialogProps) {
  const [popoverOpen, setPopoverOpen] = useState(false)
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)

  const { data: users = [] } = useQuery(userDirectoryQueryOptions())
  const assignMutation = useAssignCaseMutation()
  const resetAssignMutation = assignMutation.reset

  const options = [
    { label: 'AP System (New)', value: 'ap-system' },
    ...users.map((u) => ({ label: u.name, value: u.id })),
  ]
  const selectedValue = selectedUserId ?? 'ap-system'
  const hasChanged = selectedUserId !== currentOwnerId
  const selectedLabel =
    options.find((o) => o.value === selectedValue)?.label ?? 'Select owner...'

  function handleSelect(value: string) {
    setSelectedUserId(value === 'ap-system' ? null : value)
    setPopoverOpen(false)
    resetAssignMutation()
  }

  function handleSubmit() {
    if (isClosed) return

    assignMutation.mutate(
      { caseId, ownerId: selectedUserId },
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
            Assign or transfer case{' '}
            <span className="font-mono font-medium">{caseNumber}</span>. Setting
            AP System returns the case to New.
          </DialogDescription>
        </DialogHeader>

        {isClosed ? (
          <Alert variant="destructive">
            <AlertCircleIcon />
            <AlertDescription>
              This case is closed. Ownership cannot be assigned or transferred.
            </AlertDescription>
          </Alert>
        ) : null}

        <Field>
          <FieldLabel className="sr-only">Owner</FieldLabel>
          <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
            <PopoverTrigger
              render={
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={popoverOpen}
                  className="w-full justify-between font-normal"
                  disabled={isClosed}
                />
              }
            >
              {selectedLabel}
              <ChevronsUpDownIcon
                data-icon="inline-end"
                className="opacity-50"
              />
            </PopoverTrigger>
            <PopoverContent className="w-(--anchor-width) p-0" align="start">
              <Command items={options.map((option) => option.label)}>
                <CommandInput placeholder="Search users..." />
                <CommandList>
                  <CommandEmpty>No users found.</CommandEmpty>
                  <CommandGroup>
                    {options.map((option) => (
                      <CommandItem
                        key={option.value}
                        value={option.label}
                        disabled={isClosed}
                        onSelect={() => handleSelect(option.value)}
                      >
                        {option.label}
                        <CheckIcon
                          data-icon="inline-end"
                          className={cn(
                            'ml-auto',
                            selectedValue === option.value
                              ? 'opacity-100'
                              : 'opacity-0',
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

        {assignMutation.error ? (
          <Alert variant="destructive">
            <AlertCircleIcon />
            <AlertDescription>
              {getApiErrorMessage(
                assignMutation.error,
                'Unable to assign this case.',
              )}
            </AlertDescription>
          </Alert>
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isClosed || !hasChanged || assignMutation.isPending}
          >
            {assignMutation.isPending && <Spinner data-icon="inline-start" />}
            Save owner
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
