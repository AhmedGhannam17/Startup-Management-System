import Link from 'next/link'
import { redirect } from 'next/navigation'
import { SectionTitle } from '@/components/clients-projects/record-form'
import { Button } from '@/components/ui/button'
import { createServerClient } from '@/lib/supabase/server'
import { getActiveOrganizationContext } from '@/lib/organization/context'

function money(value: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(value)
  } catch {
    return `${currency} ${value.toFixed(2)}`
  }
}

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string
    method?: string
    error?: string
    page?: string
    clientId?: string
    quotationId?: string
  }>
}) {
  const context = await getActiveOrganizationContext()
  if (!context) redirect('/onboarding')
  const params = await searchParams
  const supabase = await createServerClient()
  const page = Math.max(1, Number.parseInt(params.page ?? '1', 10) || 1)
  const methods = ['cash', 'bank_transfer', 'upi', 'card', 'other'] as const
  let query = supabase
    .from('payments')
    .select('id,client_id,project_id,quotation_id,amount,currency,paid_on,method,reference', {
      count: 'exact',
    })
    .eq('organization_id', context.organization.id)
    .order('paid_on', { ascending: false })
    .range((page - 1) * 50, page * 50 - 1)
  if (methods.includes(params.method as (typeof methods)[number]))
    query = query.eq('method', params.method as (typeof methods)[number])
  const clientId =
    params.clientId && /^[0-9a-f-]{36}$/i.test(params.clientId) ? params.clientId : undefined
  if (clientId) query = query.eq('client_id', clientId)
  const quotationId =
    params.quotationId && /^[0-9a-f-]{36}$/i.test(params.quotationId)
      ? params.quotationId
      : undefined
  if (quotationId) query = query.eq('quotation_id', quotationId)
  const search = params.q?.trim().replace(/[,%()]/g, '')
  if (search && /^[0-9a-f-]{36}$/i.test(search)) query = query.eq('id', search)
  else if (search) query = query.ilike('reference', `%${search}%`)
  const [{ data: paymentRows, count }, { data: totals }] = await Promise.all([
    query,
    supabase.rpc('get_payment_totals', {
      p_organization_id: context.organization.id,
      p_client_id: null,
      p_project_id: null,
      p_quotation_id: null,
    }),
  ])
  const clientIds = [...new Set((paymentRows ?? []).map((payment) => payment.client_id))]
  const { data: clients } = clientIds.length
    ? await supabase
        .from('clients')
        .select('id,name')
        .eq('organization_id', context.organization.id)
        .in('id', clientIds)
    : { data: [] }
  const names = new Map((clients ?? []).map((client) => [client.id, client.name]))
  const totalsByCurrency = new Map(
    (totals ?? []).map((row) => [
      row.currency,
      { total: Number(row.total_received), month: Number(row.received_this_month) },
    ])
  )
  if (!totalsByCurrency.size)
    totalsByCurrency.set(context.organization.currency, { total: 0, month: 0 })
  const filterParams = new URLSearchParams()
  if (params.q) filterParams.set('q', params.q)
  if (params.method) filterParams.set('method', params.method)
  if (clientId) filterParams.set('clientId', clientId)
  if (quotationId) filterParams.set('quotationId', quotationId)
  const pageHref = (value: number) => {
    const next = new URLSearchParams(filterParams)
    next.set('page', String(value))
    return `/payments?${next.toString()}`
  }
  const pageCount = Math.max(1, Math.ceil((count ?? 0) / 50))

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <SectionTitle
          title="Payments"
          description="Record and review money received from clients."
        />
        {context.isManager && (
          <Button asChild>
            <Link href="/payments/new">Record payment</Link>
          </Button>
        )}
      </div>
      {params.error && (
        <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {params.error}
        </p>
      )}
      {!context.isManager && (
        <p className="rounded-md border bg-muted/20 p-4 text-sm text-muted-foreground">
          Payment and revenue records are available to Owners and Project Managers.
        </p>
      )}
      {context.isManager && (
        <div className="grid gap-4 sm:grid-cols-2">
          {[...totalsByCurrency].map(([currency, totalsForCurrency]) => (
            <div key={currency} className="rounded-lg border bg-card p-5">
              <p className="text-sm text-muted-foreground">Received · {currency}</p>
              <p className="mt-2 text-2xl font-semibold">
                {money(totalsForCurrency.total, currency)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {money(totalsForCurrency.month, currency)} received this month
              </p>
            </div>
          ))}
        </div>
      )}
      {context.isManager && (
        <div className="flex justify-end">
          <Button asChild size="sm" variant="ghost">
            <Link href="/payments/history">View audit history</Link>
          </Button>
        </div>
      )}
      <form className="flex flex-wrap gap-2 rounded-lg border bg-card p-4">
        {clientId && <input type="hidden" name="clientId" value={clientId} />}
        {quotationId && <input type="hidden" name="quotationId" value={quotationId} />}
        <input
          name="q"
          defaultValue={params.q}
          placeholder="Search reference or payment ID"
          className="field-input min-w-48 flex-1"
        />
        <select
          name="method"
          defaultValue={params.method ?? ''}
          className="field-select w-auto min-w-40"
        >
          <option value="">All methods</option>
          {methods.map((method) => (
            <option key={method} value={method}>
              {method.replace('_', ' ')}
            </option>
          ))}
        </select>
        <Button variant="outline">Filter</Button>
      </form>
      <div className="overflow-hidden rounded-lg border bg-card">
        <div className="grid grid-cols-[minmax(0,1fr)_130px_130px_150px] gap-3 border-b bg-muted/30 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground max-sm:hidden">
          <span>Client / reference</span>
          <span>Method</span>
          <span>Amount</span>
          <span>Received</span>
        </div>
        {(paymentRows ?? []).map((payment) => (
          <div
            key={payment.id}
            className="grid gap-2 border-b px-4 py-4 last:border-0 sm:grid-cols-[minmax(0,1fr)_130px_130px_150px] sm:items-center sm:gap-3"
          >
            <div className="min-w-0">
              <Link href={`/payments/${payment.id}`} className="font-medium hover:underline">
                {names.get(payment.client_id) ?? 'Client'}
              </Link>
              <p className="truncate text-xs text-muted-foreground">
                {payment.reference || `Payment ${payment.id.slice(0, 8)}`}
              </p>
            </div>
            <span className="text-sm capitalize">{payment.method.replace('_', ' ')}</span>
            <span className="text-sm">{money(Number(payment.amount), payment.currency)}</span>
            <span className="text-sm text-muted-foreground">{payment.paid_on}</span>
          </div>
        ))}
        {!paymentRows?.length && (
          <p className="p-10 text-center text-sm text-muted-foreground">
            No payments match this filter.
          </p>
        )}
      </div>
      {pageCount > 1 && (
        <nav aria-label="Payment pages" className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {page} of {pageCount}
          </p>
          <div className="flex gap-2">
            {page > 1 && (
              <Button asChild variant="outline">
                <Link href={pageHref(page - 1)}>Previous</Link>
              </Button>
            )}
            {page < pageCount && (
              <Button asChild variant="outline">
                <Link href={pageHref(page + 1)}>Next</Link>
              </Button>
            )}
          </div>
        </nav>
      )}
    </div>
  )
}
