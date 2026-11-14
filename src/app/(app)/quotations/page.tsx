import Link from 'next/link'
import { redirect } from 'next/navigation'
import { SectionTitle } from '@/components/clients-projects/record-form'
import { Button } from '@/components/ui/button'
import { createServerClient } from '@/lib/supabase/server'
import { getActiveOrganizationContext } from '@/lib/organization/context'
import { quotationStatuses } from '@/lib/validations/financial'

function money(value: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(value)
  } catch {
    return `${currency} ${value.toFixed(2)}`
  }
}

function total(
  items: Array<{
    quantity: number
    unit_price: number
    discount_percent: number
    tax_percent: number
  }>
) {
  return items.reduce((sum, item) => {
    const afterDiscount =
      Number(item.quantity) * Number(item.unit_price) * (1 - Number(item.discount_percent) / 100)
    return sum + afterDiscount + (afterDiscount * Number(item.tax_percent)) / 100
  }, 0)
}

export default async function QuotationsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string
    status?: string
    archived?: string
    error?: string
    page?: string
    clientId?: string
  }>
}) {
  const context = await getActiveOrganizationContext()
  if (!context) redirect('/onboarding')
  const params = await searchParams
  const supabase = await createServerClient()
  const page = Math.max(1, Number.parseInt(params.page ?? '1', 10) || 1)
  const search = params.q?.replace(/[^a-zA-Z0-9\s-]/g, '').trim()
  let query = supabase
    .from('quotations')
    .select('id,quote_number,title,status,issue_date,valid_until,client_id,archived_at', {
      count: 'exact',
    })
    .eq('organization_id', context.organization.id)
    .order('issue_date', { ascending: false })
    .range((page - 1) * 50, page * 50 - 1)
  if (search) query = query.or(`title.ilike.%${search}%,quote_number.ilike.%${search}%`)
  const clientId =
    params.clientId && /^[0-9a-f-]{36}$/i.test(params.clientId) ? params.clientId : undefined
  if (clientId) query = query.eq('client_id', clientId)
  if (quotationStatuses.includes(params.status as (typeof quotationStatuses)[number]))
    query = query.eq('status', params.status as (typeof quotationStatuses)[number])
  if (params.archived !== 'true') query = query.is('archived_at', null)
  const { data: quotations, count } = await query
  const quoteIds = (quotations ?? []).map((quote) => quote.id)
  const clientIds = [...new Set((quotations ?? []).map((quote) => quote.client_id))]
  const [{ data: items }, { data: clients }] = await Promise.all([
    quoteIds.length
      ? supabase
          .from('quotation_line_items')
          .select('quotation_id,quantity,unit_price,discount_percent,tax_percent')
          .eq('organization_id', context.organization.id)
          .in('quotation_id', quoteIds)
      : Promise.resolve({ data: [] }),
    clientIds.length
      ? supabase
          .from('clients')
          .select('id,name')
          .eq('organization_id', context.organization.id)
          .in('id', clientIds)
      : Promise.resolve({ data: [] }),
  ])
  const clientNames = new Map((clients ?? []).map((client) => [client.id, client.name]))
  const quoteTotals = new Map<string, number>()
  for (const item of items ?? []) {
    const current = quoteTotals.get(item.quotation_id) ?? 0
    quoteTotals.set(item.quotation_id, current + total([item]))
  }
  const filterParams = new URLSearchParams()
  if (params.q) filterParams.set('q', params.q)
  if (params.status) filterParams.set('status', params.status)
  if (params.archived) filterParams.set('archived', params.archived)
  if (clientId) filterParams.set('clientId', clientId)
  const pageHref = (value: number) => {
    const next = new URLSearchParams(filterParams)
    next.set('page', String(value))
    return `/quotations?${next.toString()}`
  }
  const pageCount = Math.max(1, Math.ceil((count ?? 0) / 50))
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <SectionTitle
          title="Quotations"
          description="Prepare, issue, and track client proposals."
        />
        {context.isManager && (
          <Button asChild>
            <Link href="/quotations/new">Create quotation</Link>
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
          Quotation and pricing records are available to Owners and Project Managers.
        </p>
      )}
      {context.isManager && (
        <div className="flex justify-end">
          <Button asChild size="sm" variant="ghost">
            <Link href="/quotations/history">View quotation history</Link>
          </Button>
        </div>
      )}
      <form className="flex flex-wrap gap-2 rounded-lg border bg-card p-4">
        {clientId && <input type="hidden" name="clientId" value={clientId} />}
        <input
          name="q"
          defaultValue={params.q}
          placeholder="Search quotation titles"
          className="field-input min-w-48 flex-1"
        />
        <select
          name="status"
          defaultValue={params.status ?? ''}
          className="field-select w-auto min-w-36"
        >
          <option value="">All statuses</option>
          {quotationStatuses.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
        <select
          name="archived"
          defaultValue={params.archived ?? ''}
          className="field-select w-auto min-w-36"
        >
          <option value="">Active quotations</option>
          <option value="true">Include archived</option>
        </select>
        <Button variant="outline">Filter</Button>
      </form>
      <div className="overflow-hidden rounded-lg border bg-card">
        <div className="grid grid-cols-[minmax(0,1fr)_140px_130px_150px] gap-3 border-b bg-muted/30 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground max-sm:hidden">
          <span>Quotation</span>
          <span>Status</span>
          <span>Total</span>
          <span>Issue date</span>
        </div>
        {(quotations ?? []).map((quote) => (
          <div
            key={quote.id}
            className="grid gap-2 border-b px-4 py-4 last:border-0 sm:grid-cols-[minmax(0,1fr)_140px_130px_150px] sm:items-center sm:gap-3"
          >
            <div className="min-w-0">
              <Link href={`/quotations/${quote.id}`} className="font-medium hover:underline">
                {quote.quote_number} · {quote.title}
              </Link>
              <p className="truncate text-xs text-muted-foreground">
                {clientNames.get(quote.client_id) ?? 'Client'}
                {quote.archived_at ? ' · archived' : ''}
              </p>
            </div>
            <span className="text-sm capitalize">{quote.status}</span>
            <span className="text-sm">
              {money(quoteTotals.get(quote.id) ?? 0, context.organization.currency)}
            </span>
            <span className="text-sm text-muted-foreground">{quote.issue_date}</span>
          </div>
        ))}
        {!quotations?.length && (
          <p className="p-10 text-center text-sm text-muted-foreground">
            No quotations match these filters.
          </p>
        )}
      </div>
      {pageCount > 1 && (
        <nav aria-label="Quotation pages" className="flex items-center justify-between">
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
