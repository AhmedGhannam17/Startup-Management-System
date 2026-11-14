'use client'

import { useState } from 'react'
import Link from 'next/link'
import { saveQuotation } from '@/app/actions/financial'
import { Button } from '@/components/ui/button'
import {
  QuotationLineItems,
  type QuotationLineInput,
} from '@/components/financial/quotation-line-items'
import type { QuotationTemplate } from '@/types/supabase'

export type QuotationFormValue = {
  id: string
  client_id: string
  project_id: string | null
  title: string
  description: string | null
  template: QuotationTemplate
  issue_date: string
  valid_until: string | null
  payment_terms: string | null
  terms_and_conditions: string | null
  notes: string | null
  signatory_name: string | null
  signatory_title: string | null
}

export function QuotationForm({
  clients,
  projects,
  currency,
  quotation,
  lineItems,
  error,
  defaultClientId,
}: {
  clients: Array<{ id: string; name: string }>
  projects: Array<{ id: string; name: string; client_id: string | null }>
  currency: string
  quotation?: QuotationFormValue
  lineItems?: QuotationLineInput[]
  error?: string
  defaultClientId?: string
}) {
  const today = new Date().toISOString().slice(0, 10)
  const [clientId, setClientId] = useState(quotation?.client_id ?? defaultClientId ?? '')
  const [projectId, setProjectId] = useState(quotation?.project_id ?? '')
  return (
    <form action={saveQuotation} className="space-y-5 rounded-lg border bg-card p-6">
      {error && (
        <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </p>
      )}
      {quotation && <input type="hidden" name="id" value={quotation.id} />}
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
          Project{' '}
          <span className="font-normal text-muted-foreground">
            (optional; must belong to the selected client)
          </span>
          <select
            name="projectId"
            value={projectId}
            onChange={(event) => setProjectId(event.target.value)}
            className="field-select"
          >
            <option value="">No project</option>
            {quotation?.project_id &&
              quotation.client_id === clientId &&
              !projects.some((project) => project.id === quotation.project_id) && (
                <option value={quotation.project_id}>Existing linked project</option>
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
          Quotation title *
          <input
            name="title"
            required
            maxLength={180}
            defaultValue={quotation?.title}
            className="field-input"
          />
        </label>
        <label className="space-y-2 text-sm font-medium sm:col-span-2">
          Description
          <textarea
            name="description"
            rows={3}
            maxLength={5000}
            defaultValue={quotation?.description ?? ''}
            className="field-input"
          />
        </label>
        <label className="space-y-2 text-sm font-medium">
          Template
          <select
            name="template"
            defaultValue={quotation?.template ?? 'classic'}
            className="field-select"
          >
            {(['classic', 'modern', 'minimal'] as const).map((template) => (
              <option key={template} value={template}>
                {template}
              </option>
            ))}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="space-y-2 text-sm font-medium">
            Issue date *
            <input
              name="issueDate"
              type="date"
              required
              defaultValue={quotation?.issue_date ?? today}
              className="field-input"
            />
          </label>
          <label className="space-y-2 text-sm font-medium">
            Valid until
            <input
              name="validUntil"
              type="date"
              defaultValue={quotation?.valid_until ?? ''}
              className="field-input"
            />
          </label>
        </div>
        <label className="space-y-2 text-sm font-medium sm:col-span-2">
          Payment terms
          <textarea
            name="paymentTerms"
            rows={2}
            maxLength={3000}
            defaultValue={quotation?.payment_terms ?? ''}
            className="field-input"
          />
        </label>
        <label className="space-y-2 text-sm font-medium sm:col-span-2">
          Terms and conditions
          <textarea
            name="termsAndConditions"
            rows={3}
            maxLength={10000}
            defaultValue={quotation?.terms_and_conditions ?? ''}
            className="field-input"
          />
        </label>
        <label className="space-y-2 text-sm font-medium sm:col-span-2">
          Notes
          <textarea
            name="notes"
            rows={2}
            maxLength={5000}
            defaultValue={quotation?.notes ?? ''}
            className="field-input"
          />
        </label>
        <label className="space-y-2 text-sm font-medium">
          Signatory name
          <input
            name="signatoryName"
            maxLength={160}
            defaultValue={quotation?.signatory_name ?? ''}
            className="field-input"
          />
        </label>
        <label className="space-y-2 text-sm font-medium">
          Signatory title
          <input
            name="signatoryTitle"
            maxLength={160}
            defaultValue={quotation?.signatory_title ?? ''}
            className="field-input"
          />
        </label>
      </div>
      <QuotationLineItems currency={currency} initialItems={lineItems} />
      <div className="flex gap-3">
        <Button type="submit">{quotation ? 'Save draft' : 'Create quotation'}</Button>
        <Button asChild variant="outline">
          <Link href={quotation ? `/quotations/${quotation.id}` : '/quotations'}>Cancel</Link>
        </Button>
      </div>
    </form>
  )
}
