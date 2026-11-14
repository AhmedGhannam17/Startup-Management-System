import Link from 'next/link'
import { redirect } from 'next/navigation'
import { SectionTitle } from '@/components/clients-projects/record-form'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { createServerClient } from '@/lib/supabase/server'
import { getActiveOrganizationContext } from '@/lib/organization/context'
import type { Json } from '@/types/supabase'

function snapshot(value: Json | null) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return 'No stored values'
  return Object.entries(value)
    .filter(
      ([key]) => !['organization_id', 'created_by', 'id', 'updated_at', 'created_at'].includes(key)
    )
    .map(([key, item]) => `${key.replaceAll('_', ' ')}: ${String(item ?? '—')}`)
    .join('\n')
}

export default async function QuotationHistoryPage() {
  const context = await getActiveOrganizationContext()
  if (!context) redirect('/onboarding')
  if (!context.isManager)
    redirect('/quotations?error=Quotation history is available to Owners and Project Managers.')
  const supabase = await createServerClient()
  const { data: events } = await supabase
    .from('quotation_audit_events')
    .select('*')
    .eq('organization_id', context.organization.id)
    .order('occurred_at', { ascending: false })
    .limit(200)
  const actorIds = [
    ...new Set(
      (events ?? []).map((event) => event.actor_id).filter((id): id is string => Boolean(id))
    ),
  ]
  const { data: profiles } = actorIds.length
    ? await supabase.from('profiles').select('id,full_name').in('id', actorIds)
    : { data: [] }
  const names = new Map((profiles ?? []).map((profile) => [profile.id, profile.full_name]))
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <SectionTitle
          title="Quotation history"
          description="Recent quotation changes, status updates, archives, and deletions."
        />
        <Button asChild variant="outline">
          <Link href="/quotations">Back to quotations</Link>
        </Button>
      </div>
      <Card>
        <CardContent className="divide-y p-0">
          {events?.map((event) => (
            <article key={event.id} className="space-y-3 p-5">
              <div className="flex flex-wrap justify-between gap-2">
                <div>
                  <p className="font-medium capitalize">{event.action.replace('_', ' ')}</p>
                  <p className="text-xs text-muted-foreground">
                    {event.quotation_id
                      ? `Quotation ${event.quotation_id.slice(0, 8)}`
                      : 'Quotation record'}{' '}
                    · {event.actor_id ? names.get(event.actor_id) || 'Team member' : 'System'}
                  </p>
                </div>
                <time className="text-sm text-muted-foreground" dateTime={event.occurred_at}>
                  {new Date(event.occurred_at).toLocaleString()}
                </time>
              </div>
              <div className="grid gap-3 text-xs sm:grid-cols-2">
                {event.old_values && (
                  <details>
                    <summary className="cursor-pointer font-medium text-muted-foreground">
                      Previous values
                    </summary>
                    <pre className="mt-2 whitespace-pre-wrap rounded bg-muted/30 p-3">
                      {snapshot(event.old_values)}
                    </pre>
                  </details>
                )}
                {event.new_values && (
                  <details>
                    <summary className="cursor-pointer font-medium text-muted-foreground">
                      Saved values
                    </summary>
                    <pre className="mt-2 whitespace-pre-wrap rounded bg-muted/30 p-3">
                      {snapshot(event.new_values)}
                    </pre>
                  </details>
                )}
              </div>
            </article>
          ))}
          {!events?.length && (
            <p className="p-8 text-sm text-muted-foreground">No quotation history yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
