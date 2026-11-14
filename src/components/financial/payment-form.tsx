'use client'

import { useState } from 'react'
import Link from 'next/link'
import { savePayment } from '@/app/actions/financial'
import { Button } from '@/components/ui/button'
import type { PaymentMethod } from '@/types/supabase'

export type PaymentFormValue = {
  id: string
  client_id: string
  project_id: string | null
  quotation_id: string | null
  amount: number
  paid_on: string
  currency: string
  method: PaymentMethod
  reference: string | null
  notes: string | null
}

export function PaymentForm({
  clients,
  projects,
  quotations,
  currency,
  payment,
  error,
  defaultClientId,
  defaultProjectId,
  defaultQuotationId,
}: {
  clients: Array<{ id: string; name: string }>
  projects: Array<{ id: string; name: string; client_id: string | null }>
  quotations: Array<{
    id: string
    quote_number: string
    title: string
    client_id: string
    currency: string
  }>
  currency: string
  payment?: PaymentFormValue
  error?: string
  defaultClientId?: string
  defaultProjectId?: string
  defaultQuotationId?: string
}) {
  const [clientId, setClientId] = useState(payment?.client_id ?? defaultClientId ?? '')
  const [projectId, setProjectId] = useState(payment?.project_id ?? defaultProjectId ?? '')
  const [quotationId, setQuotationId] = useState(payment?.quotation_id ?? defaultQuotationId ?? '')
  const amountCurrency =
    quotations.find((quotation) => quotation.id === quotationId)?.currency ??
    payment?.currency ??
    currency
  return (
    <form action={savePayment} className="space-y-5 rounded-lg border bg-card p-6">
      {error && (
        <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </p>
      )}
      {payment && <input type="hidden" name="id" value={payment.id} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-2 text-sm font-medium">
          Client *
          <select
            name="clientId"
            required
            value={clientId}
            onChange={(event) => {
              setClientId(event.target.value)
              setProjectId('')
              setQuotationId('')
            }}
            className="field-select"
          >
            <option value="" disabled>
              Select a client
            </option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-2 text-sm font-medium">
          Project <span className="font-normal text-muted-foreground">(optional)</span>
          <select
            name="projectId"
            value={projectId}
            onChange={(event) => setProjectId(event.target.value)}
            className="field-select"
          >
            <option value="">No project</option>
            {(payment?.project_id ?? defaultProjectId) &&
              clientId === (payment?.client_id ?? defaultClientId) &&
              !projects.some(
                (project) => project.id === (payment?.project_id ?? defaultProjectId)
              ) && (
                <option value={payment?.project_id ?? defaultProjectId}>
                  Existing linked project
                </option>
              )}
            {projects
              .filter((project) => project.client_id === clientId)
              .map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
          </select>
        </label>
        <label className="space-y-2 text-sm font-medium sm:col-span-2">
          Quotation <span className="font-normal text-muted-foreground">(optional)</span>
          <select
            name="quotationId"
            value={quotationId}
            onChange={(event) => setQuotationId(event.target.value)}
            className="field-select"
          >
            <option value="">No quotation</option>
            {quotations
              .filter((quotation) => quotation.client_id === clientId)
              .map((quotation) => (
                <option key={quotation.id} value={quotation.id}>
                  {quotation.quote_number} · {quotation.title}
                </option>
              ))}
          </select>
        </label>
        <label className="space-y-2 text-sm font-medium">
          Amount ({amountCurrency}) *
          <input
            name="amount"
            type="number"
            required
            min="0.01"
            step="0.01"
            defaultValue={payment?.amount}
            className="field-input"
          />
        </label>
        <label className="space-y-2 text-sm font-medium">
          Date received *
          <input
            name="paidOn"
            type="date"
            required
            defaultValue={payment?.paid_on ?? new Date().toISOString().slice(0, 10)}
            className="field-input"
          />
        </label>
        <label className="space-y-2 text-sm font-medium">
          Method
          <select
            name="method"
            defaultValue={payment?.method ?? 'bank_transfer'}
            className="field-select"
          >
            {(['cash', 'bank_transfer', 'upi', 'card', 'other'] as const).map((method) => (
              <option key={method} value={method}>
                {method.replace('_', ' ')}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-2 text-sm font-medium">
          Reference
          <input
            name="reference"
            maxLength={240}
            defaultValue={payment?.reference ?? ''}
            className="field-input"
          />
        </label>
        <label className="space-y-2 text-sm font-medium sm:col-span-2">
          Internal notes
          <textarea
            name="notes"
            rows={3}
            maxLength={5000}
            defaultValue={payment?.notes ?? ''}
            className="field-input"
          />
        </label>
      </div>
      <p className="text-xs text-muted-foreground">
        Project and quotation, if selected, must belong to the chosen client. This payment retains
        its currency if workspace settings change.
      </p>
      <div className="flex gap-3">
        <Button type="submit">{payment ? 'Save payment' : 'Record payment'}</Button>
        <Button asChild variant="outline">
          <Link href={payment ? `/payments/${payment.id}` : '/payments'}>Cancel</Link>
        </Button>
      </div>
    </form>
  )
}
