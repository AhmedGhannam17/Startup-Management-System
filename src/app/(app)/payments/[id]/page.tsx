import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { deletePayment } from '@/app/actions/financial'
import { SectionTitle } from '@/components/clients-projects/record-form'
import { ConfirmSubmitButton } from '@/components/financial/confirm-submit-button'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { createServerClient } from '@/lib/supabase/server'
import { getActiveOrganizationContext } from '@/lib/organization/context'
import type { Json } from '@/types/supabase'

function money(value: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(value)
  } catch {
    return `${currency} ${value.toFixed(2)}`
  }
}

function snapshot(value: Json | null) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return 'No stored values'
  const hidden = new Set(['organization_id', 'created_by', 'id', 'updated_at', 'created_at'])
  return Object.entries(value)
    .filter(([key]) => !hidden.has(key))
    .map(([key, item]) => `${key.replaceAll('_', ' ')}: ${String(item ?? '—')}`)
    .join('\n')
}

export default async function PaymentDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ error?: string }>
}) {
  const context = await getActiveOrganizationContext()
  if (!context) redirect('/onboarding')
  const [{ id }, query] = await Promise.all([params, searchParams])
  const supabase = await createServerClient()
  const [{ data: payment }, { data: events }] = await Promise.all([
    supabase
      .from('payments')
      .select('*')
      .eq('organization_id', context.organization.id)
      .eq('id', id)
      .maybeSingle(),
    supabase
      .from('payment_audit_events')
      .select('*')
      .eq('organization_id', context.organization.id)
      .eq('payment_id', id)
      .order('occurred_at', { ascending: false }),
  ])
  if (!payment) notFound()
  const [{ data: client }, { data: project }, { data: quote }] = await Promise.all([
    supabase
      .from('clients')
      .select('name')
      .eq('organization_id', context.organization.id)
      .eq('id', payment.client_id)
      .maybeSingle(),
    payment.project_id
      ? supabase
          .from('projects')
          .select('name')
          .eq('organization_id', context.organization.id)
          .eq('id', payment.project_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    payment.quotation_id
      ? supabase
          .from('quotations')
          .select('quote_number,title')
          .eq('organization_id', context.organization.id)
          .eq('id', payment.quotation_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ])
  const actorIds = [
    ...new Set([
      payment.created_by,
      ...(events ?? [])
        .map((event) => event.actor_id)
        .filter((actor): actor is string => Boolean(actor)),
    ]),
  ]
  const { data: profiles } = actorIds.length
    ? await supabase.from('profiles').select('id,full_name').in('id', actorIds)
    : { data: [] }
  const profileNames = new Map((profiles ?? []).map((profile) => [profile.id, profile.full_name]))
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <SectionTitle
          title={money(Number(payment.amount), payment.currency)}
          description={`${client?.name ?? 'Client'} · received ${payment.paid_on}`}
        />
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href={`/payments/${id}/edit`}>Edit payment</Link>
          </Button>
          <form action={deletePayment}>
            <input type="hidden" name="paymentId" value={id} />
            <ConfirmSubmitButton
              type="submit"
              variant="destructive"
              confirmation="Delete this payment record? Its audit event will be retained."
            >
              Delete
            </ConfirmSubmitButton>
          </form>
        </div>
      </div>
      {query.error && (
        <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {query.error}
        </p>
      )}
      <Card>
        <CardHeader>
          <CardTitle>Payment details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <p className="text-muted-foreground">Method</p>
            <p className="capitalize">{payment.method.replace('_', ' ')}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Reference</p>
            <p>{payment.reference || '—'}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Project</p>
            <p>{project?.name || 'Not linked'}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Quotation</p>
            <p>{quote ? `${quote.quote_number} · ${quote.title}` : 'Not linked'}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Recorded by</p>
            <p>{profileNames.get(payment.created_by) || 'Team member'}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Created / updated</p>
            <p>
              {new Date(payment.created_at).toLocaleString()} /{' '}
              {new Date(payment.updated_at).toLocaleString()}
            </p>
          </div>
          {payment.notes && (
            <div className="sm:col-span-2">
              <p className="text-muted-foreground">Notes</p>
              <p className="whitespace-pre-wrap">{payment.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Audit history</CardTitle>
        </CardHeader>
        <CardContent>
          {events?.length ? (
            <ol className="space-y-5">
              {events.map((event) => (
                <li key={event.id} className="space-y-2 border-b pb-4 last:border-0">
                  <div className="flex flex-wrap justify-between gap-2 text-sm">
                    <span className="font-medium capitalize">
                      {event.action} ·{' '}
                      {event.actor_id
                        ? profileNames.get(event.actor_id) || 'Team member'
                        : 'System'}
                    </span>
                    <time className="text-muted-foreground" dateTime={event.occurred_at}>
                      {new Date(event.occurred_at).toLocaleString()}
                    </time>
                  </div>
                  {event.old_values && (
                    <details>
                      <summary className="cursor-pointer text-xs text-muted-foreground">
                        Previous values
                      </summary>
                      <pre className="mt-2 whitespace-pre-wrap rounded bg-muted/30 p-3 text-xs">
                        {snapshot(event.old_values)}
                      </pre>
                    </details>
                  )}
                  {event.new_values && (
                    <details>
                      <summary className="cursor-pointer text-xs text-muted-foreground">
                        Saved values
                      </summary>
                      <pre className="mt-2 whitespace-pre-wrap rounded bg-muted/30 p-3 text-xs">
                        {snapshot(event.new_values)}
                      </pre>
                    </details>
                  )}
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-muted-foreground">
              No audit entries found for this payment.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
