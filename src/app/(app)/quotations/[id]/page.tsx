import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import {
  archiveQuotation,
  deleteDraftQuotation,
  duplicateQuotation,
  updateQuotationStatus,
} from '@/app/actions/financial'
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

function lineTotal(item: {
  quantity: number
  unit_price: number
  discount_percent: number
  tax_percent: number
}) {
  const subtotal = Number(item.quantity) * Number(item.unit_price)
  const discounted = subtotal * (1 - Number(item.discount_percent) / 100)
  return {
    subtotal,
    discount: subtotal - discounted,
    tax: (discounted * Number(item.tax_percent)) / 100,
    total: discounted * (1 + Number(item.tax_percent) / 100),
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

export default async function QuotationDetailPage({
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
  const [{ data: quote }, { data: items }, { data: auditEvents }] = await Promise.all([
    supabase
      .from('quotations')
      .select('*')
      .eq('organization_id', context.organization.id)
      .eq('id', id)
      .maybeSingle(),
    supabase
      .from('quotation_line_items')
      .select('*')
      .eq('organization_id', context.organization.id)
      .eq('quotation_id', id)
      .order('sort_order'),
    supabase
      .from('quotation_audit_events')
      .select('*')
      .eq('organization_id', context.organization.id)
      .eq('quotation_id', id)
      .order('occurred_at', { ascending: false }),
  ])
  if (!quote) notFound()
  const [{ data: client }, { data: payments }, { data: paymentTotals }] = await Promise.all([
    supabase
      .from('clients')
      .select('name,email,address')
      .eq('organization_id', context.organization.id)
      .eq('id', quote.client_id)
      .maybeSingle(),
    supabase
      .from('payments')
      .select('id,amount,paid_on,method')
      .eq('organization_id', context.organization.id)
      .eq('quotation_id', id)
      .order('paid_on', { ascending: false })
      .limit(10),
    supabase.rpc('get_payment_totals', {
      p_organization_id: context.organization.id,
      p_client_id: null,
      p_project_id: null,
      p_quotation_id: id,
    }),
  ])
  const calculated = (items ?? []).map((item) => ({ item, ...lineTotal(item) }))
  const subtotal = calculated.reduce((sum, row) => sum + row.subtotal, 0)
  const discounts = calculated.reduce((sum, row) => sum + row.discount, 0)
  const tax = calculated.reduce((sum, row) => sum + row.tax, 0)
  const total = calculated.reduce((sum, row) => sum + row.total, 0)
  const paid = (paymentTotals ?? []).reduce(
    (sum, payment) => sum + Number(payment.total_received),
    0
  )
  const outstanding = Math.max(0, total - paid)
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <SectionTitle
          title={quote.title}
          description={`${quote.quote_number} · ${client?.name ?? 'Client'} · ${quote.status}${quote.archived_at ? ' · archived' : ''}`}
        />
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href={`/quotations/${id}/print`}>Preview / PDF</Link>
          </Button>
          {context.isManager && quote.status === 'draft' && (
            <Button asChild variant="outline">
              <Link href={`/quotations/${id}/edit`}>Edit draft</Link>
            </Button>
          )}
          {context.isManager && (
            <form action={duplicateQuotation}>
              <input type="hidden" name="quotationId" value={id} />
              <Button variant="outline">Duplicate</Button>
            </form>
          )}
          {context.isManager && (
            <form action={archiveQuotation}>
              <input type="hidden" name="quotationId" value={id} />
              <input type="hidden" name="archived" value={quote.archived_at ? 'true' : 'false'} />
              <Button variant="outline">{quote.archived_at ? 'Restore' : 'Archive'}</Button>
            </form>
          )}
          {context.isManager && quote.status === 'draft' && (
            <form action={deleteDraftQuotation}>
              <input type="hidden" name="quotationId" value={id} />
              <ConfirmSubmitButton
                type="submit"
                variant="destructive"
                confirmation="Permanently delete this draft quotation?"
              >
                Delete draft
              </ConfirmSubmitButton>
            </form>
          )}
        </div>
      </div>
      {query.error && (
        <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {query.error}
        </p>
      )}
      {context.isManager && (
        <Card>
          <CardHeader>
            <CardTitle>Quotation status</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center justify-between gap-4">
            {quote.status === 'draft' || quote.status === 'sent' ? (
              <form action={updateQuotationStatus} className="flex flex-wrap items-center gap-3">
                <input type="hidden" name="quotationId" value={id} />
                <select
                  name="status"
                  defaultValue={quote.status}
                  className="field-select w-auto min-w-40"
                >
                  {(quote.status === 'draft'
                    ? ['draft', 'sent', 'void']
                    : ['sent', 'accepted', 'rejected', 'expired', 'void']
                  ).map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
                <Button variant="outline">Update status</Button>
              </form>
            ) : (
              <p className="text-sm text-muted-foreground">
                This quotation is {quote.status}. Create a duplicate draft to make changes.
              </p>
            )}
            <span className="text-sm">
              Paid {money(paid, quote.currency)} · Balance {money(outstanding, quote.currency)}
            </span>
          </CardContent>
        </Card>
      )}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Client</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p className="font-medium">{client?.name ?? 'Client'}</p>
            <p className="text-muted-foreground">{client?.email || 'No email'}</p>
            <p className="whitespace-pre-wrap text-muted-foreground">{client?.address || ''}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Dates</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>Issued {quote.issue_date}</p>
            <p>Valid until {quote.valid_until ?? 'Not specified'}</p>
            <p className="capitalize">Template: {quote.template}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Payment summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>Total {money(total, quote.currency)}</p>
            <p>Received {money(paid, quote.currency)}</p>
            <p className="font-semibold">Outstanding {money(outstanding, quote.currency)}</p>
            {context.isManager && (
              <Button asChild className="mt-2 w-full">
                <Link
                  href={`/payments/new?clientId=${quote.client_id}&quotationId=${id}&projectId=${quote.project_id ?? ''}`}
                >
                  Record payment
                </Link>
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Items</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-left text-sm">
              <thead>
                <tr className="border-b text-xs uppercase text-muted-foreground">
                  <th className="py-2">Description</th>
                  <th className="py-2 text-right">Qty</th>
                  <th className="py-2 text-right">Unit price</th>
                  <th className="py-2 text-right">Discount</th>
                  <th className="py-2 text-right">Tax</th>
                  <th className="py-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {calculated.map(({ item, total: rowTotal }) => (
                  <tr key={item.id} className="border-b last:border-0">
                    <td className="py-3">{item.description}</td>
                    <td className="py-3 text-right">{Number(item.quantity)}</td>
                    <td className="py-3 text-right">
                      {money(Number(item.unit_price), quote.currency)}
                    </td>
                    <td className="py-3 text-right">{Number(item.discount_percent)}%</td>
                    <td className="py-3 text-right">{Number(item.tax_percent)}%</td>
                    <td className="py-3 text-right">{money(rowTotal, quote.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="ml-auto mt-4 grid max-w-xs grid-cols-2 gap-2 text-sm">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="text-right">{money(subtotal, quote.currency)}</span>
            <span className="text-muted-foreground">Discount</span>
            <span className="text-right">−{money(discounts, quote.currency)}</span>
            <span className="text-muted-foreground">Tax</span>
            <span className="text-right">{money(tax, quote.currency)}</span>
            <span className="border-t pt-2 font-semibold">Total</span>
            <span className="border-t pt-2 text-right font-semibold">
              {money(total, quote.currency)}
            </span>
          </div>
        </CardContent>
      </Card>
      {(quote.description || quote.payment_terms || quote.terms_and_conditions || quote.notes) && (
        <Card>
          <CardHeader>
            <CardTitle>Terms and notes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            {quote.description && <p className="whitespace-pre-wrap">{quote.description}</p>}
            {quote.payment_terms && (
              <div>
                <p className="font-medium">Payment terms</p>
                <p className="whitespace-pre-wrap text-muted-foreground">{quote.payment_terms}</p>
              </div>
            )}
            {quote.terms_and_conditions && (
              <div>
                <p className="font-medium">Terms and conditions</p>
                <p className="whitespace-pre-wrap text-muted-foreground">
                  {quote.terms_and_conditions}
                </p>
              </div>
            )}
            {quote.notes && (
              <div>
                <p className="font-medium">Notes</p>
                <p className="whitespace-pre-wrap text-muted-foreground">{quote.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
      {(payments ?? []).length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <CardTitle>Recorded payments</CardTitle>
            <Button asChild size="sm" variant="ghost">
              <Link href={`/payments?quotationId=${id}`}>View all</Link>
            </Button>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {payments?.map((payment) => (
                <li key={payment.id} className="flex justify-between border-b pb-2 last:border-0">
                  <Link className="hover:underline" href={`/payments/${payment.id}`}>
                    {payment.paid_on} · {payment.method.replace('_', ' ')}
                  </Link>
                  <span>{money(Number(payment.amount), quote.currency)}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
      <Card>
        <CardHeader>
          <CardTitle>Quotation history</CardTitle>
        </CardHeader>
        <CardContent>
          {auditEvents?.length ? (
            <ol className="space-y-3">
              {auditEvents.map((event) => (
                <li
                  key={event.id}
                  className="flex flex-wrap justify-between gap-2 border-b pb-3 last:border-0"
                >
                  <span className="text-sm capitalize">{event.action.replace('_', ' ')}</span>
                  <time className="text-xs text-muted-foreground" dateTime={event.occurred_at}>
                    {new Date(event.occurred_at).toLocaleString()}
                  </time>
                  <div className="w-full">
                    {(event.old_values || event.new_values) && (
                      <details className="text-xs">
                        <summary className="cursor-pointer text-muted-foreground">
                          View recorded change
                        </summary>
                        <pre className="mt-2 whitespace-pre-wrap rounded bg-muted/30 p-3">
                          {event.old_values ? `Before\n${snapshot(event.old_values)}\n\n` : ''}
                          {event.new_values ? `After\n${snapshot(event.new_values)}` : ''}
                        </pre>
                      </details>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-muted-foreground">No history has been recorded yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
