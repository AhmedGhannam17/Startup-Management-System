import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { SectionTitle } from '@/components/clients-projects/record-form'
import { PrintButton } from '@/components/financial/print-button'
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

export default async function QuotationPrintPage({ params }: { params: Promise<{ id: string }> }) {
  const context = await getActiveOrganizationContext()
  if (!context) redirect('/onboarding')
  const { id } = await params
  const supabase = await createServerClient()
  const [{ data: quote }, { data: items }] = await Promise.all([
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
  ])
  if (!quote) notFound()
  const { data: client } = await supabase
    .from('clients')
    .select('name,email,phone,address')
    .eq('organization_id', context.organization.id)
    .eq('id', quote.client_id)
    .maybeSingle()
  const rows = (items ?? []).map((item) => {
    const subtotal = Number(item.quantity) * Number(item.unit_price)
    const discount = subtotal * (Number(item.discount_percent) / 100)
    const taxable = subtotal - discount
    const tax = taxable * (Number(item.tax_percent) / 100)
    return { item, subtotal, discount, tax, total: taxable + tax }
  })
  const subtotal = rows.reduce((sum, row) => sum + row.subtotal, 0)
  const discount = rows.reduce((sum, row) => sum + row.discount, 0)
  const tax = rows.reduce((sum, row) => sum + row.tax, 0)
  const total = rows.reduce((sum, row) => sum + row.total, 0)
  const templateClass =
    quote.template === 'modern'
      ? 'border-t-8 border-primary'
      : quote.template === 'minimal'
        ? 'border-0 shadow-none'
        : 'border'
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="print-hidden flex items-center justify-between gap-4">
        <SectionTitle
          title="Quotation preview"
          description="Use your browser's print dialog to save or print a PDF."
        />
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href={`/quotations/${id}`}>Back</Link>
          </Button>
          <PrintButton />
        </div>
      </div>
      <article
        className={`quotation-print space-y-8 rounded-lg bg-white p-8 text-slate-950 shadow-sm sm:p-12 ${templateClass}`}
      >
        <header className="flex flex-wrap justify-between gap-6 border-b pb-6">
          <div>
            <p className="text-2xl font-bold">{context.organization.name}</p>
            <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">
              {[
                context.organization.address,
                context.organization.phone,
                context.organization.email,
                context.organization.website,
              ]
                .filter(Boolean)
                .join('\n')}
            </p>
            {context.organization.tax_id && (
              <p className="mt-2 text-xs text-slate-500">
                Business ID: {context.organization.tax_id}
              </p>
            )}
          </div>
          <div className="text-left sm:text-right">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
              Quotation
            </p>
            <p className="mt-1 text-xl font-bold">{quote.quote_number}</p>
            <p className="mt-2 text-sm">Issued {quote.issue_date}</p>
            <p className="text-sm">Valid through {quote.valid_until ?? '—'}</p>
          </div>
        </header>
        <div className="grid gap-8 sm:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Prepared for
            </p>
            <p className="mt-2 font-semibold">{client?.name ?? 'Client'}</p>
            <p className="whitespace-pre-wrap text-sm text-slate-600">
              {[client?.address, client?.email, client?.phone].filter(Boolean).join('\n')}
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Subject</p>
            <p className="mt-2 font-semibold">{quote.title}</p>
            {quote.description && (
              <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">{quote.description}</p>
            )}
          </div>
        </div>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-300 text-xs uppercase text-slate-500">
              <th className="py-3">Description</th>
              <th className="py-3 text-right">Qty</th>
              <th className="py-3 text-right">Unit price</th>
              <th className="py-3 text-right">Discount</th>
              <th className="py-3 text-right">Tax</th>
              <th className="py-3 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ item, total: rowTotal }) => (
              <tr key={item.id} className="border-b border-slate-200">
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
        <div className="ml-auto grid max-w-xs grid-cols-2 gap-x-8 gap-y-2 border-t border-slate-300 pt-4 text-right">
          <p className="text-sm text-slate-600">Subtotal</p>
          <p className="text-sm">{money(subtotal, quote.currency)}</p>
          <p className="text-sm text-slate-600">Discount</p>
          <p className="text-sm">−{money(discount, quote.currency)}</p>
          <p className="text-sm text-slate-600">Tax</p>
          <p className="text-sm">{money(tax, quote.currency)}</p>
          <p className="border-t border-slate-300 pt-3 font-semibold">Total</p>
          <p className="border-t border-slate-300 pt-3 text-xl font-bold">
            {money(total, quote.currency)}
          </p>
        </div>
        {(quote.payment_terms || quote.terms_and_conditions || quote.notes) && (
          <div className="space-y-4 border-t border-slate-200 pt-5 text-sm">
            {quote.payment_terms && (
              <div>
                <p className="font-semibold">Payment terms</p>
                <p className="mt-1 whitespace-pre-wrap text-slate-600">{quote.payment_terms}</p>
              </div>
            )}
            {quote.terms_and_conditions && (
              <div>
                <p className="font-semibold">Terms and conditions</p>
                <p className="mt-1 whitespace-pre-wrap text-slate-600">
                  {quote.terms_and_conditions}
                </p>
              </div>
            )}
            {quote.notes && (
              <div>
                <p className="font-semibold">Notes</p>
                <p className="mt-1 whitespace-pre-wrap text-slate-600">{quote.notes}</p>
              </div>
            )}
          </div>
        )}
        <footer className="border-t border-slate-200 pt-5 text-sm text-slate-600">
          {quote.signatory_name && (
            <p className="font-semibold text-slate-950">
              {quote.signatory_name}
              {quote.signatory_title ? ` · ${quote.signatory_title}` : ''}
            </p>
          )}
          <p className="mt-2">Thank you for considering {context.organization.name}.</p>
        </footer>
      </article>
    </div>
  )
}
