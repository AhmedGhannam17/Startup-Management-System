'use client'

import { useState } from 'react'
import Link from 'next/link'
import { saveTask } from '@/app/actions/work-management'
import { Button } from '@/components/ui/button'
import type { TaskPriority, TaskStatus } from '@/types/supabase'

type ProjectOption = { id: string; name: string }
type MilestoneOption = { id: string; project_id: string; name: string }
type MemberOption = { id: string; name: string; role: string }

export type TaskFormValue = {
  id: string
  project_id: string
  milestone_id: string | null
  assignee_id: string | null
  title: string
  description: string | null
  status: TaskStatus
  priority: TaskPriority
  due_date: string | null
}

export function TaskForm({
  projects,
  milestones,
  members,
  task,
  defaultProjectId,
  error,
}: {
  projects: ProjectOption[]
  milestones: MilestoneOption[]
  members: MemberOption[]
  task?: TaskFormValue
  defaultProjectId?: string
  error?: string
}) {
  const initialProjectId = task?.project_id ?? defaultProjectId ?? projects[0]?.id ?? ''
  const [projectId, setProjectId] = useState(initialProjectId)
  const initialProjectName = projects.find((project) => project.id === initialProjectId)?.name
  return (
    <form action={saveTask} className="space-y-5 rounded-lg border bg-card p-6">
      {error && (
        <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </p>
      )}
      {task && <input type="hidden" name="id" value={task.id} />}
      {task ? (
        <>
          <input type="hidden" name="projectId" value={task.project_id} />
          <div className="rounded-md border bg-muted/20 px-3 py-2 text-sm">
            Project: <span className="font-medium">{initialProjectName ?? 'Current project'}</span>
          </div>
        </>
      ) : (
        <label className="block space-y-2 text-sm font-medium">
          Project *
          <select
            name="projectId"
            required
            value={projectId}
            onChange={(event) => setProjectId(event.target.value)}
            className="field-select"
          >
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <label className="block space-y-2 text-sm font-medium">
        Task title *
        <input
          name="title"
          required
          maxLength={180}
          defaultValue={task?.title}
          className="field-input"
        />
      </label>
      <label className="block space-y-2 text-sm font-medium">
        Description
        <textarea
          name="description"
          rows={4}
          maxLength={10000}
          defaultValue={task?.description ?? ''}
          className="field-input"
        />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block space-y-2 text-sm font-medium">
          Milestone
          <select
            name="milestoneId"
            defaultValue={task?.milestone_id ?? ''}
            className="field-select"
          >
            <option value="">No milestone</option>
            {milestones
              .filter((milestone) => milestone.project_id === projectId)
              .map((milestone) => (
                <option key={milestone.id} value={milestone.id}>
                  {milestone.name}
                </option>
              ))}
          </select>
        </label>
        <label className="block space-y-2 text-sm font-medium">
          Assigned to
          <select name="assigneeId" defaultValue={task?.assignee_id ?? ''} className="field-select">
            <option value="">Unassigned</option>
            {members.map((member) => (
              <option key={member.id} value={member.id}>
                {member.name} · {member.role}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-2 text-sm font-medium">
          Status
          <select name="status" defaultValue={task?.status ?? 'todo'} className="field-select">
            {(['todo', 'in_progress', 'blocked', 'completed'] as const).map((status) => (
              <option key={status} value={status}>
                {status.replace('_', ' ')}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-2 text-sm font-medium">
          Priority
          <select
            name="priority"
            defaultValue={task?.priority ?? 'medium'}
            className="field-select"
          >
            {(['low', 'medium', 'high', 'urgent'] as const).map((priority) => (
              <option key={priority} value={priority}>
                {priority}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-2 text-sm font-medium sm:col-span-2">
          Due date
          <input
            name="dueDate"
            type="date"
            defaultValue={task?.due_date ?? ''}
            className="field-input"
          />
        </label>
      </div>
      <div className="flex gap-3">
        <Button type="submit">{task ? 'Save task' : 'Create task'}</Button>
        <Button asChild variant="outline">
          <Link href={task ? `/tasks/${task.id}` : '/tasks'}>Cancel</Link>
        </Button>
      </div>
    </form>
  )
}
