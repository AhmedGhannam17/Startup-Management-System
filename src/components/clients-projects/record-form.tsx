import Link from 'next/link'
import { Button } from '@/components/ui/button'

type Field = {
  name: string
  label: string
  type?: string
  value?: string | null
  required?: boolean
  options?: Array<[string, string]>
  multiline?: boolean
  sensitive?: boolean
}

export function RecordForm({
  action,
  fields,
  id,
  error,
}: {
  action: (formData: FormData) => void | Promise<void>
  fields: Field[]
  id?: string
  error?: string
}) {
  return (
    <form action={action} className="space-y-5 rounded-lg border bg-card p-6">
      {error && (
        <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </p>
      )}
      {id && <input type="hidden" name="id" value={id} />}
      <div className="grid gap-5 md:grid-cols-2">
        {fields.map((field) => (
          <label
            key={field.name}
            className={`space-y-2 text-sm font-medium ${field.multiline ? 'md:col-span-2' : ''}`}
          >
            {field.label}
            {field.required && ' *'}
            {field.options ? (
              <select
                name={field.name}
                defaultValue={field.value ?? field.options[0][0]}
                className="flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm"
                required={field.required}
              >
                {field.options.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            ) : field.multiline ? (
              <textarea
                name={field.name}
                defaultValue={field.value ?? ''}
                rows={4}
                className="flex w-full rounded-md border bg-background px-3 py-2 text-sm"
              />
            ) : (
              <input
                name={field.name}
                type={field.type ?? 'text'}
                defaultValue={field.value ?? ''}
                required={field.required}
                className="flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm"
              />
            )}
          </label>
        ))}
      </div>
      <div className="flex gap-3">
        <Button type="submit">Save</Button>
        <Button asChild variant="outline">
          <Link
            href={
              id
                ? fields.some((f) => f.name === 'clientId')
                  ? `/projects/${id}`
                  : `/clients/${id}`
                : fields.some((f) => f.name === 'clientId')
                  ? '/projects'
                  : '/clients'
            }
          >
            Cancel
          </Link>
        </Button>
      </div>
    </form>
  )
}

export function SectionTitle({ title, description }: { title: string; description?: string }) {
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
    </div>
  )
}
