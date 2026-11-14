import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { archiveClient } from '@/app/actions/clients-projects'
import { createServerClient } from '@/lib/supabase/server'
import { getActiveOrganizationContext } from '@/lib/organization/context'
import type { Database } from '@/types/supabase'

export default async function ClientPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ error?: string }>
}) {
  const context = await getActiveOrganizationContext()
  if (!context) redirect('/onboarding')
  const { id } = await params
  const supabase = await createServerClient()
  const { data: clientData } = await supabase
    .from('clients')
    .select('*')
    .eq('id', id)
    .eq('organization_id', context.organization.id)
    .maybeSingle()
  const client = clientData as unknown as Database['public']['Tables']['clients']['Row'] | null
  if (!client) notFound()
  const [
    { data: privateDetailsData },
    { data: projectsData },
    { data: quotes },
    { data: payments },
    query,
  ] = await Promise.all([
    context.isManager
      ? supabase
          .from('client_private_details')
          .select('tax_id,internal_notes')
          .eq('client_id', id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from('projects')
      .select('id,name,status')
      .eq('client_id', id)
      .eq('organization_id', context.organization.id)
      .order('created_at', { ascending: false }),
    context.isManager
      ? supabase
          .from('quotations')
          .select('id,quote_number,title,status,issue_date,currency,archived_at')
          .eq('organization_id', context.organization.id)
          .eq('client_id', id)
          .order('issue_date', { ascending: false })
      : Promise.resolve({ data: [] }),
    context.isManager
      ? supabase
          .from('payments')
          .select('id,quotation_id,amount,currency,paid_on,method,reference')
          .eq('organization_id', context.organization.id)
          .eq('client_id', id)
          .order('paid_on', { ascending: false })
      : Promise.resolve({ data: [] }),
    searchParams,
  ])
  const privateDetails = privateDetailsData as unknown as
    Database['public']['Tables']['client_private_details']['Row'] | null
  const projects = projectsData as unknown as Array<
    Pick<Database['public']['Tables']['projects']['Row'], 'id' | 'name' | 'status'>
  > | null
  const quoteIds = (quotes ?? []).map((quote) => quote.id)
  const { data: lineItems } = quoteIds.length
    ? await supabase
        .from('quotation_line_items')
        .select('quotation_id,quantity,unit_price,discount_percent,tax_percent')
        .eq('organization_id', context.organization.id)
        .in('quotation_id', quoteIds)
    : { data: [] }
  const totalsByQuote = new Map<string, number>()
  for (const item of lineItems ?? []) {
    const net =
      Number(item.quantity) * Number(item.unit_price) * (1 - Number(item.discount_percent) / 100)
    totalsByQuote.set(
      item.quotation_id,
      (totalsByQuote.get(item.quotation_id) ?? 0) + net * (1 + Number(item.tax_percent) / 100)
    )
  }
  const paidByQuote = new Map<string, number>()
  for (const payment of payments ?? []) {
    if (!payment.quotation_id) continue
    paidByQuote.set(
      payment.quotation_id,
      (paidByQuote.get(payment.quotation_id) ?? 0) + Number(payment.amount)
    )
  }
  const totalPaidByCurrency = new Map<string, number>()
  for (const payment of payments ?? [])
    totalPaidByCurrency.set(
      payment.currency,
      (totalPaidByCurrency.get(payment.currency) ?? 0) + Number(payment.amount)
    )
  const money = (amount: number, currency: string) => {
    try {
      return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount)
    } catch {
      return `${currency} ${amount.toFixed(2)}`
    }
  }
  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{client.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {client.archived_at ? 'Archived client' : 'Active client'}
          </p>
        </div>
        <div className="flex gap-2">
          {context.isManager && (
            <>
              <Button asChild variant="outline">
                <Link href={`/clients/${id}/edit`}>Edit client</Link>
              </Button>
              <form action={archiveClient}>
                <input type="hidden" name="id" value={id} />
                <input
                  type="hidden"
                  name="archived"
                  value={client.archived_at ? 'true' : 'false'}
                />
                <Button variant="outline">{client.archived_at ? 'Restore' : 'Archive'}</Button>
              </form>
            </>
          )}
        </div>
      </div>
      {query.error && (
        <p role="alert" className="rounded bg-destructive/10 p-3 text-sm text-destructive">
          {query.error}
        </p>
      )}
      <Card>
        <CardHeader>
          <CardTitle>Contact details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 text-sm sm:grid-cols-2">
          {[
            ['Contact', client.contact_name],
            ['Email', client.email],
            ['Phone', client.phone],
            ['Website', client.website],
            ['Category', client.business_category],
            ['Address', client.address],
          ].map(([k, v]) => (
            <div key={k}>
              <p className="text-muted-foreground">{k}</p>
              <p>{v || '—'}</p>
            </div>
          ))}
        </CardContent>
      </Card>
      {context.isManager && (
        <Card>
          <CardHeader>
            <CardTitle>Owner and manager details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p>Tax / business ID: {privateDetails?.tax_id || '—'}</p>
            <p className="whitespace-pre-wrap">
              {privateDetails?.internal_notes || 'No internal notes.'}
            </p>
          </CardContent>
        </Card>
      )}
      <Card>
        <CardHeader>
          <CardTitle>Projects</CardTitle>
        </CardHeader>
        <CardContent>
          {projects?.length ? (
            <ul className="space-y-2">
              {projects.map((p) => (
                <li key={p.id}>
                  <Link className="hover:underline" href={`/projects/${p.id}`}>
                    {p.name}
                  </Link>
                  <span className="ml-2 text-xs text-muted-foreground">
                    {p.status.replace('_', ' ')}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No projects for this client yet.</p>
          )}
        </CardContent>
      </Card>
      {context.isManager && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <CardTitle>Quotations</CardTitle>
            <div className="flex gap-2">
              <Button asChild size="sm" variant="outline">
                <Link href={`/quotations?clientId=${id}`}>View all</Link>
              </Button>
              <Button asChild size="sm">
                <Link href={`/quotations/new?clientId=${id}`}>Create quotation</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {quotes?.length ? (
              <ul className="space-y-3">
                {quotes.map((quote) => {
                  const total = totalsByQuote.get(quote.id) ?? 0
                  const paid = paidByQuote.get(quote.id) ?? 0
                  return (
                    <li
                      key={quote.id}
                      className="flex flex-wrap items-center justify-between gap-3 border-b pb-3 last:border-0"
                    >
                      <div>
                        <Link
                          href={`/quotations/${quote.id}`}
                          className="font-medium hover:underline"
                        >
                          {quote.quote_number} · {quote.title}
                        </Link>
                        <p className="text-xs capitalize text-muted-foreground">
                          {quote.status}
                          {quote.archived_at ? ' · archived' : ''} · issued {quote.issue_date}
                        </p>
                      </div>
                      <div className="text-right text-sm">
                        <p>{money(total, quote.currency)}</p>
                        <p className="text-xs text-muted-foreground">
                          Outstanding {money(Math.max(0, total - paid), quote.currency)}
                        </p>
                      </div>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No quotations for this client yet.</p>
            )}
          </CardContent>
        </Card>
      )}
      {context.isManager && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <CardTitle>Payments</CardTitle>
            <div className="flex gap-2">
              <Button asChild size="sm" variant="outline">
                <Link href={`/payments?clientId=${id}`}>View all</Link>
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link href={`/payments/new?clientId=${id}`}>Record payment</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="mb-4 flex flex-wrap gap-3">
              {[...totalPaidByCurrency].map(([currency, amount]) => (
                <div key={currency} className="rounded border bg-muted/10 px-3 py-2 text-sm">
                  <span className="text-muted-foreground">Received · {currency}</span>
                  <p className="font-semibold">{money(amount, currency)}</p>
                </div>
              ))}
            </div>
            {payments?.length ? (
              <ul className="space-y-2">
                {payments.map((payment) => (
                  <li
                    key={payment.id}
                    className="flex flex-wrap justify-between gap-2 border-b pb-2 text-sm last:border-0"
                  >
                    <Link href={`/payments/${payment.id}`} className="hover:underline">
                      {payment.paid_on} · {payment.method.replace('_', ' ')}
                      {payment.reference ? ` · ${payment.reference}` : ''}
                    </Link>
                    <span>{money(Number(payment.amount), payment.currency)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No payments for this client yet.</p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
