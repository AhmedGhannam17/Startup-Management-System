import { deleteMilestone, saveMilestone } from '@/app/actions/work-management'
import { ConfirmSubmitButton } from '@/components/financial/confirm-submit-button'
import { Button } from '@/components/ui/button'
import type { MilestoneStatus } from '@/types/supabase'

export type MilestoneFormValue = {
  id: string
  name: string
  description: string | null
  status: MilestoneStatus
  due_date: string | null
}

export function MilestoneForm({
  projectId,
  milestone,
}: {
  projectId: string
  milestone?: MilestoneFormValue
}) {
  return (
    <div className="space-y-2 rounded-md border p-3">
      <form action={saveMilestone} className="grid gap-3 sm:grid-cols-2">
        <input type="hidden" name="projectId" value={projectId} />
        {milestone && <input type="hidden" name="id" value={milestone.id} />}
        <label className="space-y-1 text-xs font-medium sm:col-span-2">
          Name *
          <input
            name="name"
            required
            maxLength={160}
            defaultValue={milestone?.name}
            className="field-input"
          />
        </label>
        <label className="space-y-1 text-xs font-medium sm:col-span-2">
          Description
          <textarea
            name="description"
            rows={2}
            maxLength={5000}
            defaultValue={milestone?.description ?? ''}
            className="field-input"
          />
        </label>
        <label className="space-y-1 text-xs font-medium">
          Status
          <select
            name="status"
            defaultValue={milestone?.status ?? 'not_started'}
            className="field-select"
          >
            {(['not_started', 'in_progress', 'completed', 'on_hold'] as const).map((status) => (
              <option key={status} value={status}>
                {status.replace('_', ' ')}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-xs font-medium">
          Due date
          <input
            type="date"
            name="dueDate"
            defaultValue={milestone?.due_date ?? ''}
            className="field-input"
          />
        </label>
        <div className="sm:col-span-2">
          <Button size="sm">{milestone ? 'Save milestone' : 'Add milestone'}</Button>
        </div>
      </form>
      {milestone && (
        <form action={deleteMilestone}>
          <input type="hidden" name="projectId" value={projectId} />
          <input type="hidden" name="milestoneId" value={milestone.id} />
          <ConfirmSubmitButton
            size="sm"
            type="submit"
            variant="outline"
            confirmation="Delete this milestone? Tasks will remain in the project without a milestone link."
          >
            Delete milestone
          </ConfirmSubmitButton>
        </form>
      )}
    </div>
  )
}
