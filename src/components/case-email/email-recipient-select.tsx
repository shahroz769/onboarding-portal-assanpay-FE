import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
} from '#/components/ui/field'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'
import type { EmailRecipientType } from '#/schemas/cases.schema'

type EmailRecipientSelectProps = {
  value: EmailRecipientType
  onValueChange: (value: EmailRecipientType) => void
  submitterEmail: string | null
  businessEmail: string | null
  disabled?: boolean
}

export function EmailRecipientSelect({
  value,
  onValueChange,
  submitterEmail,
  businessEmail,
  disabled = false,
}: EmailRecipientSelectProps) {
  return (
    <Field>
      <FieldLabel>Send to</FieldLabel>
      <FieldContent>
        <Select
          items={[
            { value: 'submitter', label: 'Submitter Email' },
            { value: 'business', label: 'Business Email' },
          ]}
          value={value}
          onValueChange={(nextValue) =>
            onValueChange(nextValue as EmailRecipientType)
          }
          disabled={disabled}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="submitter" disabled={!submitterEmail}>
                Submitter Email
              </SelectItem>
              <SelectItem value="business" disabled={!businessEmail}>
                Business Email
              </SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
        <FieldDescription>
          {value === 'business'
            ? (businessEmail ?? 'No business email on file.')
            : (submitterEmail ?? 'No submitter email on file.')}
        </FieldDescription>
      </FieldContent>
    </Field>
  )
}
