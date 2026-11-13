import { Field, FieldLabel } from '#/components/ui/field'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'
import { PRIORITIES, PRIORITY_LABELS } from '#/schemas/merchants.schema'
import type { Priority } from '#/schemas/merchants.schema'

const PRIORITY_ITEMS = PRIORITIES.map((p) => ({
  value: p,
  label: PRIORITY_LABELS[p],
}))

/** Priority picker shared by the case and merchant priority dialogs. */
export function PrioritySelectField({
  value,
  onValueChange,
}: {
  value: Priority
  onValueChange: (value: Priority) => void
}) {
  return (
    <Field>
      <FieldLabel>Priority</FieldLabel>
      <Select
        items={PRIORITY_ITEMS}
        value={value}
        onValueChange={(v) => onValueChange(v as Priority)}
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Select priority" />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {PRIORITIES.map((p) => (
              <SelectItem key={p} value={p}>
                {PRIORITY_LABELS[p]}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </Field>
  )
}
