'use server'

import { randomUUID } from 'node:crypto'
import type { PostgrestError } from '@supabase/postgrest-js'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getActiveOrganizationContext } from '@/lib/organization/context'
import { getUserFriendlyDatabaseError } from '@/lib/errors'
import { createServerClient } from '@/lib/supabase/server'
import { paymentSchema, quotationSchema, quotationStatuses } from '@/lib/validations/financial'
import type { Json, PaymentMethod, QuotationStatus } from '@/types/supabase'

function field(form: FormData, name: string) {
  const value = form.get(name)
  return typeof value === 'string' ? value.trim() : ''
}

function isValidDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`))
}

function managerOnly(
  context: Awaited<ReturnType<typeof getActiveOrganizationContext>>
): context is NonNullable<typeof context> {
  return Boolean(context?.isManager)
}

function friendly(error: PostgrestError) {
  return getUserFriendlyDatabaseError(error)
}

export async function saveQuotation(form: FormData) {
  const context = await getActiveOrganizationContext()
  const id = field(form, 'id')
  const rawItems = field(form, 'lineItems')
  let lineItems: unknown
  try {
    lineItems = JSON.parse(rawItems)
  } catch {
    redirect(
      `${id ? `/quotations/${id}/edit` : '/quotations/new'}?error=Review the quotation items.`
    )
  }
  const parsed = quotationSchema.safeParse({
    clientId: field(form, 'clientId'),
    projectId: field(form, 'projectId'),
    title: field(form, 'title'),
    description: field(form, 'description'),
    template: field(form, 'template'),
    issueDate: field(form, 'issueDate'),
    validUntil: field(form, 'validUntil'),
    paymentTerms: field(form, 'paymentTerms'),
    termsAndConditions: field(form, 'termsAndConditions'),
    notes: field(form, 'notes'),
    signatoryName: field(form, 'signatoryName'),
    signatoryTitle: field(form, 'signatoryTitle'),
    lineItems,
  })
  const formPath = id ? `/quotations/${id}/edit` : '/quotations/new'
  if (!managerOnly(context))
    redirect('/quotations?error=Only Owners and Project Managers can manage quotations.')
  if (!parsed.success)
    redirect(
      `${formPath}?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? 'Review the quotation fields.')}`
    )
  if (
    !isValidDate(parsed.data.issueDate) ||
    (parsed.data.validUntil && !isValidDate(parsed.data.validUntil))
  )
    redirect(`${formPath}?error=Enter valid quotation dates.`)
  if (parsed.data.validUntil && parsed.data.validUntil < parsed.data.issueDate)
    redirect(`${formPath}?error=The validity date must be on or after the issue date.`)

  const supabase = await createServerClient()
  let existingQuote: { status: string; issue_date: string; client_id: string } | null = null
  if (id) {
    const { data } = await supabase
      .from('quotations')
      .select('status,issue_date,client_id')
      .eq('organization_id', context.organization.id)
      .eq('id', id)
      .maybeSingle()
    existingQuote = data
    if (!existingQuote || existingQuote.status !== 'draft')
      redirect(`/quotations/${id}?error=Only draft quotations can be edited.`)
    if (existingQuote.issue_date.slice(0, 4) !== parsed.data.issueDate.slice(0, 4))
      redirect(
        `${formPath}?error=The issue year cannot change after a quotation number is assigned.`
      )
  }
  const { data: client } = await supabase
    .from('clients')
    .select('id,archived_at')
    .eq('organization_id', context.organization.id)
    .eq('id', parsed.data.clientId)
    .maybeSingle()
  if (!client || (client.archived_at && existingQuote?.client_id !== client.id))
    redirect(`${formPath}?error=Choose an active client in this workspace.`)

  const quotationId = id || randomUUID()
  const { data, error } = await supabase.rpc('save_quotation', {
    p_id: quotationId,
    p_organization_id: context.organization.id,
    p_client_id: parsed.data.clientId,
    p_project_id: parsed.data.projectId || null,
    p_title: parsed.data.title,
    p_description: parsed.data.description || null,
    p_template: parsed.data.template,
    p_issue_date: parsed.data.issueDate,
    p_valid_until: parsed.data.validUntil || null,
    p_currency: context.organization.currency,
    p_payment_terms: parsed.data.paymentTerms || null,
    p_terms_and_conditions: parsed.data.termsAndConditions || null,
    p_notes: parsed.data.notes || null,
    p_signatory_name: parsed.data.signatoryName || null,
    p_signatory_title: parsed.data.signatoryTitle || null,
    p_line_items: parsed.data.lineItems as Json,
  })
  if (error) redirect(`${formPath}?error=${encodeURIComponent(friendly(error))}`)
  const savedId = data || quotationId
  revalidatePath('/quotations')
  revalidatePath(`/quotations/${savedId}`)
  revalidatePath(`/clients/${parsed.data.clientId}`)
  if (parsed.data.projectId) revalidatePath(`/projects/${parsed.data.projectId}`)
  revalidatePath('/dashboard')
  redirect(`/quotations/${savedId}`)
}

export async function updateQuotationStatus(form: FormData) {
  const context = await getActiveOrganizationContext()
  const id = field(form, 'quotationId')
  const status = field(form, 'status')
  if (!managerOnly(context))
    redirect('/quotations?error=Only Owners and Project Managers can manage quotations.')
  if (!quotationStatuses.includes(status as QuotationStatus))
    redirect(`/quotations/${id}?error=Choose a valid quotation status.`)
  const supabase = await createServerClient()
  const { error } = await supabase
    .from('quotations')
    .update({ status: status as QuotationStatus })
    .eq('organization_id', context.organization.id)
    .eq('id', id)
  if (error) redirect(`/quotations/${id}?error=${encodeURIComponent(friendly(error))}`)
  const { data: quote } = await supabase
    .from('quotations')
    .select('client_id,project_id')
    .eq('organization_id', context.organization.id)
    .eq('id', id)
    .maybeSingle()
  revalidatePath('/quotations')
  revalidatePath(`/quotations/${id}`)
  if (quote) revalidatePath(`/clients/${quote.client_id}`)
  if (quote?.project_id) revalidatePath(`/projects/${quote.project_id}`)
  revalidatePath('/dashboard')
  redirect(`/quotations/${id}`)
}

export async function archiveQuotation(form: FormData) {
  const context = await getActiveOrganizationContext()
  const id = field(form, 'quotationId')
  const archived = field(form, 'archived') === 'true'
  if (!managerOnly(context))
    redirect('/quotations?error=Only Owners and Project Managers can manage quotations.')
  const supabase = await createServerClient()
  const { error } = await supabase
    .from('quotations')
    .update({ archived_at: archived ? null : new Date().toISOString() })
    .eq('organization_id', context.organization.id)
    .eq('id', id)
  if (error) redirect(`/quotations/${id}?error=${encodeURIComponent(friendly(error))}`)
  const { data: quote } = await supabase
    .from('quotations')
    .select('client_id,project_id')
    .eq('organization_id', context.organization.id)
    .eq('id', id)
    .maybeSingle()
  revalidatePath('/quotations')
  revalidatePath(`/quotations/${id}`)
  if (quote) revalidatePath(`/clients/${quote.client_id}`)
  if (quote?.project_id) revalidatePath(`/projects/${quote.project_id}`)
  redirect(`/quotations/${id}`)
}

export async function deleteDraftQuotation(form: FormData) {
  const context = await getActiveOrganizationContext()
  const id = field(form, 'quotationId')
  if (!managerOnly(context))
    redirect('/quotations?error=Only Owners and Project Managers can manage quotations.')
  const supabase = await createServerClient()
  const { data: quote } = await supabase
    .from('quotations')
    .select('client_id,project_id')
    .eq('organization_id', context.organization.id)
    .eq('id', id)
    .maybeSingle()
  const { error } = await supabase
    .from('quotations')
    .delete()
    .eq('organization_id', context.organization.id)
    .eq('id', id)
    .eq('status', 'draft')
  if (error) redirect(`/quotations/${id}?error=${encodeURIComponent(friendly(error))}`)
  revalidatePath('/quotations')
  if (quote) revalidatePath(`/clients/${quote.client_id}`)
  if (quote?.project_id) revalidatePath(`/projects/${quote.project_id}`)
  redirect('/quotations')
}

export async function duplicateQuotation(form: FormData) {
  const context = await getActiveOrganizationContext()
  const id = field(form, 'quotationId')
  if (!managerOnly(context))
    redirect('/quotations?error=Only Owners and Project Managers can manage quotations.')
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
      .select('sort_order,description,quantity,unit_price,discount_percent,tax_percent')
      .eq('organization_id', context.organization.id)
      .eq('quotation_id', id)
      .order('sort_order'),
  ])
  if (!quote || !items?.length)
    redirect('/quotations?error=This quotation could not be duplicated.')
  const newId = randomUUID()
  const today = new Date().toISOString().slice(0, 10)
  const { error } = await supabase.rpc('save_quotation', {
    p_id: newId,
    p_organization_id: context.organization.id,
    p_client_id: quote.client_id,
    p_project_id: quote.project_id,
    p_title: `${quote.title} (copy)`.slice(0, 180),
    p_description: quote.description,
    p_template: quote.template,
    p_issue_date: today,
    p_valid_until: null,
    p_currency: quote.currency,
    p_payment_terms: quote.payment_terms,
    p_terms_and_conditions: quote.terms_and_conditions,
    p_notes: quote.notes,
    p_signatory_name: quote.signatory_name,
    p_signatory_title: quote.signatory_title,
    p_line_items: items as unknown as Json,
  })
  if (error) redirect(`/quotations/${id}?error=${encodeURIComponent(friendly(error))}`)
  revalidatePath('/quotations')
  revalidatePath(`/clients/${quote.client_id}`)
  if (quote.project_id) revalidatePath(`/projects/${quote.project_id}`)
  redirect(`/quotations/${newId}`)
}

export async function savePayment(form: FormData) {
  const context = await getActiveOrganizationContext()
  const id = field(form, 'id')
  const parsed = paymentSchema.safeParse({
    clientId: field(form, 'clientId'),
    projectId: field(form, 'projectId'),
    quotationId: field(form, 'quotationId'),
    amount: field(form, 'amount'),
    paidOn: field(form, 'paidOn'),
    method: field(form, 'method'),
    reference: field(form, 'reference'),
    notes: field(form, 'notes'),
  })
  const path = id ? `/payments/${id}/edit` : '/payments/new'
  if (!managerOnly(context))
    redirect('/payments?error=Only Owners and Project Managers can manage payments.')
  if (!parsed.success)
    redirect(
      `${path}?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? 'Review the payment fields.')}`
    )
  if (!isValidDate(parsed.data.paidOn)) redirect(`${path}?error=Enter a valid payment date.`)
  const supabase = await createServerClient()
  let currency = context.organization.currency
  if (id) {
    const { data: existing } = await supabase
      .from('payments')
      .select('currency')
      .eq('organization_id', context.organization.id)
      .eq('id', id)
      .maybeSingle()
    if (!existing) redirect('/payments?error=That payment could not be found.')
    currency = existing.currency
  }
  const { data: client } = await supabase
    .from('clients')
    .select('id')
    .eq('organization_id', context.organization.id)
    .eq('id', parsed.data.clientId)
    .maybeSingle()
  if (!client) redirect(`${path}?error=Choose a client in this workspace.`)
  if (parsed.data.quotationId) {
    const { data: quote } = await supabase
      .from('quotations')
      .select('id,currency')
      .eq('organization_id', context.organization.id)
      .eq('id', parsed.data.quotationId)
      .eq('client_id', parsed.data.clientId)
      .maybeSingle()
    if (!quote) redirect(`${path}?error=Choose a quotation belonging to the selected client.`)
    currency = quote.currency
  }
  const values = {
    client_id: parsed.data.clientId,
    project_id: parsed.data.projectId || null,
    quotation_id: parsed.data.quotationId || null,
    amount: Number(parsed.data.amount),
    currency,
    paid_on: parsed.data.paidOn,
    method: parsed.data.method as PaymentMethod,
    reference: parsed.data.reference || null,
    notes: parsed.data.notes || null,
  }
  let paymentId = id
  if (id) {
    const { error } = await supabase
      .from('payments')
      .update(values)
      .eq('organization_id', context.organization.id)
      .eq('id', id)
    if (error) redirect(`${path}?error=${encodeURIComponent(friendly(error))}`)
  } else {
    paymentId = randomUUID()
    const { error } = await supabase.from('payments').insert({
      ...values,
      id: paymentId,
      organization_id: context.organization.id,
      created_by: context.membership.user_id,
    })
    if (error) redirect(`${path}?error=${encodeURIComponent(friendly(error))}`)
  }
  revalidatePath('/payments')
  revalidatePath(`/payments/${paymentId}`)
  revalidatePath(`/clients/${parsed.data.clientId}`)
  if (parsed.data.projectId) revalidatePath(`/projects/${parsed.data.projectId}`)
  if (parsed.data.quotationId) revalidatePath(`/quotations/${parsed.data.quotationId}`)
  revalidatePath('/quotations')
  revalidatePath('/dashboard')
  redirect(`/payments/${paymentId}`)
}

export async function deletePayment(form: FormData) {
  const context = await getActiveOrganizationContext()
  const id = field(form, 'paymentId')
  if (!managerOnly(context))
    redirect('/payments?error=Only Owners and Project Managers can manage payments.')
  const supabase = await createServerClient()
  const { data: payment } = await supabase
    .from('payments')
    .select('client_id,project_id,quotation_id')
    .eq('organization_id', context.organization.id)
    .eq('id', id)
    .maybeSingle()
  const { error } = await supabase
    .from('payments')
    .delete()
    .eq('organization_id', context.organization.id)
    .eq('id', id)
  if (error) redirect(`/payments/${id}?error=${encodeURIComponent(friendly(error))}`)
  revalidatePath('/payments')
  if (payment) revalidatePath(`/clients/${payment.client_id}`)
  if (payment?.project_id) revalidatePath(`/projects/${payment.project_id}`)
  if (payment?.quotation_id) revalidatePath(`/quotations/${payment.quotation_id}`)
  revalidatePath('/quotations')
  revalidatePath('/dashboard')
  redirect('/payments')
}
