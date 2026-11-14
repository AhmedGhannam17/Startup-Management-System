-- Phase 4: project milestones, tasks, checklist items, and task discussion.
-- All rows remain organization scoped and inherit project visibility.

CREATE TABLE public.milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id uuid NOT NULL,
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 160),
  description text CHECK (description IS NULL OR length(description) <= 5000),
  status text NOT NULL DEFAULT 'not_started'
    CHECK (status IN ('not_started', 'in_progress', 'completed', 'on_hold')),
  due_date date,
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT milestones_organization_project_id_key UNIQUE (organization_id, project_id, id),
  CONSTRAINT milestones_project_fkey
    FOREIGN KEY (organization_id, project_id)
    REFERENCES public.projects(organization_id, id) ON DELETE CASCADE
);

CREATE TABLE public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id uuid NOT NULL,
  milestone_id uuid,
  assignee_id uuid,
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 180),
  description text CHECK (description IS NULL OR length(description) <= 10000),
  status text NOT NULL DEFAULT 'todo'
    CHECK (status IN ('todo', 'in_progress', 'completed', 'blocked')),
  priority text NOT NULL DEFAULT 'medium'
    CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  due_date date,
  sort_order integer NOT NULL DEFAULT 0,
  completed_at timestamptz,
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tasks_organization_id_id_key UNIQUE (organization_id, id),
  CONSTRAINT tasks_project_fkey
    FOREIGN KEY (organization_id, project_id)
    REFERENCES public.projects(organization_id, id) ON DELETE CASCADE,
  CONSTRAINT tasks_milestone_fkey
    FOREIGN KEY (organization_id, project_id, milestone_id)
    REFERENCES public.milestones(organization_id, project_id, id) ON DELETE SET NULL (milestone_id),
  CONSTRAINT tasks_assignee_fkey
    FOREIGN KEY (organization_id, assignee_id)
    REFERENCES public.organization_members(organization_id, user_id)
    ON DELETE SET NULL (assignee_id),
  CONSTRAINT tasks_completed_timestamp_check CHECK (
    (status = 'completed' AND completed_at IS NOT NULL)
    OR (status <> 'completed' AND completed_at IS NULL)
  )
);

CREATE TABLE public.task_checklist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  task_id uuid NOT NULL,
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 300),
  is_completed boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  completed_at timestamptz,
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT task_checklist_items_task_fkey
    FOREIGN KEY (organization_id, task_id)
    REFERENCES public.tasks(organization_id, id) ON DELETE CASCADE,
  CONSTRAINT task_checklist_items_completion_check CHECK (
    (is_completed AND completed_at IS NOT NULL)
    OR (NOT is_completed AND completed_at IS NULL)
  )
);

CREATE TABLE public.task_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  task_id uuid NOT NULL,
  author_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE RESTRICT,
  body text NOT NULL CHECK (length(btrim(body)) BETWEEN 1 AND 5000),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT task_comments_task_fkey
    FOREIGN KEY (organization_id, task_id)
    REFERENCES public.tasks(organization_id, id) ON DELETE CASCADE
);

CREATE INDEX milestones_org_project_due_idx
  ON public.milestones(organization_id, project_id, due_date);
CREATE INDEX milestones_org_status_idx ON public.milestones(organization_id, status);
CREATE INDEX tasks_org_project_status_idx
  ON public.tasks(organization_id, project_id, status, priority);
CREATE INDEX tasks_org_assignee_status_idx
  ON public.tasks(organization_id, assignee_id, status) WHERE assignee_id IS NOT NULL;
CREATE INDEX tasks_org_due_idx ON public.tasks(organization_id, due_date) WHERE due_date IS NOT NULL;
CREATE INDEX tasks_org_milestone_idx
  ON public.tasks(organization_id, milestone_id) WHERE milestone_id IS NOT NULL;
CREATE INDEX task_checklist_items_task_order_idx
  ON public.task_checklist_items(organization_id, task_id, sort_order, created_at);
CREATE INDEX task_comments_task_created_idx
  ON public.task_comments(organization_id, task_id, created_at DESC);

CREATE OR REPLACE FUNCTION private.can_manage_project_tasks(
  p_organization_id uuid,
  p_project_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT private.is_org_member(p_organization_id)
    AND (
      private.is_org_owner(p_organization_id)
      OR EXISTS (
        SELECT 1
        FROM public.projects AS p
        LEFT JOIN public.project_members AS pm
          ON pm.organization_id = p.organization_id
          AND pm.project_id = p.id
          AND pm.user_id = (SELECT auth.uid())
        WHERE p.organization_id = p_organization_id
          AND p.id = p_project_id
          AND (
            (p.created_by = (SELECT auth.uid()) AND private.is_org_admin(p_organization_id))
            OR pm.is_project_manager
            OR pm.can_manage_tasks
          )
      )
    );
$$;

CREATE OR REPLACE FUNCTION private.can_manage_project_milestones(
  p_organization_id uuid,
  p_project_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT private.is_org_member(p_organization_id)
    AND (
      private.is_org_owner(p_organization_id)
      OR EXISTS (
        SELECT 1
        FROM public.projects AS p
        LEFT JOIN public.project_members AS pm
          ON pm.organization_id = p.organization_id
          AND pm.project_id = p.id
          AND pm.user_id = (SELECT auth.uid())
        WHERE p.organization_id = p_organization_id
          AND p.id = p_project_id
          AND (
            (p.created_by = (SELECT auth.uid()) AND private.is_org_admin(p_organization_id))
            OR pm.is_project_manager
            OR pm.can_manage_milestones
          )
      )
    );
$$;

CREATE OR REPLACE FUNCTION private.can_view_task(p_organization_id uuid, p_task_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.tasks AS t
    WHERE t.organization_id = p_organization_id
      AND t.id = p_task_id
      AND private.can_view_project(t.organization_id, t.project_id)
  );
$$;

CREATE OR REPLACE FUNCTION private.can_manage_task(p_organization_id uuid, p_task_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.tasks AS t
    WHERE t.organization_id = p_organization_id
      AND t.id = p_task_id
      AND private.can_view_project(t.organization_id, t.project_id)
      AND (
        private.can_manage_project_tasks(t.organization_id, t.project_id)
        OR t.assignee_id = (SELECT auth.uid())
      )
  );
$$;

CREATE OR REPLACE FUNCTION private.can_assign_project_task(
  p_organization_id uuid,
  p_project_id uuid,
  p_assignee_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT p_assignee_id IS NULL OR EXISTS (
    SELECT 1
    FROM public.organization_members AS om
    JOIN public.projects AS p
      ON p.organization_id = om.organization_id
    WHERE om.organization_id = p_organization_id
      AND om.user_id = p_assignee_id
      AND p.id = p_project_id
      AND (
        om.role = 'owner'
        OR p.visibility = 'organization'
        OR EXISTS (
          SELECT 1 FROM public.project_members AS pm
          WHERE pm.organization_id = p.organization_id
            AND pm.project_id = p.id
            AND pm.user_id = p_assignee_id
            AND pm.can_view
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION private.guard_task_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.organization_id IS DISTINCT FROM OLD.organization_id
    OR NEW.project_id IS DISTINCT FROM OLD.project_id
    OR NEW.created_by IS DISTINCT FROM OLD.created_by
    OR NEW.id IS DISTINCT FROM OLD.id
    OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Task ownership and project cannot be changed';
  END IF;

  IF NOT private.can_manage_project_tasks(OLD.organization_id, OLD.project_id) THEN
    IF OLD.assignee_id IS DISTINCT FROM (SELECT auth.uid())
      OR NEW.title IS DISTINCT FROM OLD.title
      OR NEW.description IS DISTINCT FROM OLD.description
      OR NEW.milestone_id IS DISTINCT FROM OLD.milestone_id
      OR NEW.assignee_id IS DISTINCT FROM OLD.assignee_id
      OR NEW.priority IS DISTINCT FROM OLD.priority
      OR NEW.due_date IS DISTINCT FROM OLD.due_date
      OR NEW.sort_order IS DISTINCT FROM OLD.sort_order THEN
      RAISE EXCEPTION 'Only a task manager can edit task details';
    END IF;
  END IF;

  IF NEW.status = 'completed' THEN
    IF OLD.status IS DISTINCT FROM NEW.status OR OLD.completed_at IS NULL THEN
      NEW.completed_at := now();
    ELSE
      NEW.completed_at := OLD.completed_at;
    END IF;
  ELSE
    NEW.completed_at := NULL;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION private.set_task_completion_timestamp()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.status = 'completed' THEN
    NEW.completed_at := now();
  ELSE
    NEW.completed_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION private.guard_milestone_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.organization_id IS DISTINCT FROM OLD.organization_id
    OR NEW.project_id IS DISTINCT FROM OLD.project_id
    OR NEW.created_by IS DISTINCT FROM OLD.created_by
    OR NEW.id IS DISTINCT FROM OLD.id
    OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Milestone organization, project, and creator cannot be changed';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

-- Project capabilities imply the ability to see the project's operational view.
-- Without this, a task manager could be authorized to create tasks while RLS
-- hides the project and its tasks from them.
CREATE OR REPLACE FUNCTION private.ensure_project_member_visibility()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.is_project_manager OR NEW.can_edit OR NEW.can_manage_members
    OR NEW.can_manage_tasks OR NEW.can_manage_milestones OR NEW.can_edit_info
    OR NEW.can_access_sensitive THEN
    NEW.can_view := true;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION private.guard_task_checklist_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_project_id uuid;
  v_assignee_id uuid;
BEGIN
  IF NEW.organization_id IS DISTINCT FROM OLD.organization_id
    OR NEW.task_id IS DISTINCT FROM OLD.task_id
    OR NEW.created_by IS DISTINCT FROM OLD.created_by
    OR NEW.id IS DISTINCT FROM OLD.id
    OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Checklist ownership cannot be changed';
  END IF;

  SELECT t.project_id, t.assignee_id
    INTO v_project_id, v_assignee_id
  FROM public.tasks AS t
  WHERE t.organization_id = OLD.organization_id AND t.id = OLD.task_id;

  IF NOT private.can_manage_project_tasks(OLD.organization_id, v_project_id) THEN
    IF v_assignee_id IS DISTINCT FROM (SELECT auth.uid())
      OR NEW.title IS DISTINCT FROM OLD.title
      OR NEW.sort_order IS DISTINCT FROM OLD.sort_order THEN
      RAISE EXCEPTION 'Only the assignee can complete checklist items';
    END IF;
  END IF;

  IF NEW.is_completed THEN
    NEW.completed_at := COALESCE(OLD.completed_at, now());
  ELSE
    NEW.completed_at := NULL;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.reorder_task_checklist_item(
  p_organization_id uuid,
  p_task_id uuid,
  p_item_id uuid,
  p_direction integer
)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_project_id uuid;
  v_ids uuid[];
  v_index integer;
  v_neighbor integer;
  v_swap uuid;
BEGIN
  IF p_direction NOT IN (-1, 1) THEN
    RAISE EXCEPTION 'Checklist direction is invalid' USING ERRCODE = '22023';
  END IF;

  SELECT t.project_id INTO v_project_id
  FROM public.tasks AS t
  WHERE t.organization_id = p_organization_id AND t.id = p_task_id;
  IF NOT FOUND OR NOT private.can_manage_project_tasks(p_organization_id, v_project_id) THEN
    RAISE EXCEPTION 'You do not have permission to reorder this checklist'
      USING ERRCODE = '42501';
  END IF;

  PERFORM ci.id
  FROM public.task_checklist_items AS ci
  WHERE ci.organization_id = p_organization_id AND ci.task_id = p_task_id
  ORDER BY ci.sort_order, ci.created_at, ci.id
  FOR UPDATE;

  SELECT array_agg(ci.id ORDER BY ci.sort_order, ci.created_at, ci.id)
  INTO v_ids
  FROM public.task_checklist_items AS ci
  WHERE ci.organization_id = p_organization_id AND ci.task_id = p_task_id;
  v_index := array_position(v_ids, p_item_id);
  IF v_index IS NULL THEN
    RAISE EXCEPTION 'Checklist item was not found' USING ERRCODE = 'P0002';
  END IF;

  v_neighbor := v_index + p_direction;
  IF v_neighbor < 1 OR v_neighbor > cardinality(v_ids) THEN
    RETURN v_index;
  END IF;

  v_swap := v_ids[v_index];
  v_ids[v_index] := v_ids[v_neighbor];
  v_ids[v_neighbor] := v_swap;

  UPDATE public.task_checklist_items AS ci
  SET sort_order = ordered.ordinal - 1
  FROM unnest(v_ids) WITH ORDINALITY AS ordered(id, ordinal)
  WHERE ci.organization_id = p_organization_id
    AND ci.task_id = p_task_id
    AND ci.id = ordered.id;
  RETURN v_neighbor;
END;
$$;

CREATE TRIGGER tasks_guard_update
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION private.guard_task_update();
CREATE TRIGGER tasks_set_completion_timestamp
  BEFORE INSERT ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION private.set_task_completion_timestamp();
CREATE TRIGGER task_checklist_items_guard_update
  BEFORE UPDATE ON public.task_checklist_items
  FOR EACH ROW EXECUTE FUNCTION private.guard_task_checklist_update();
CREATE TRIGGER milestones_guard_update
  BEFORE UPDATE ON public.milestones
  FOR EACH ROW EXECUTE FUNCTION private.guard_milestone_update();
CREATE TRIGGER project_members_ensure_visibility
  BEFORE INSERT OR UPDATE ON public.project_members
  FOR EACH ROW EXECUTE FUNCTION private.ensure_project_member_visibility();

UPDATE public.project_members
SET can_view = true
WHERE is_project_manager
  OR can_edit
  OR can_manage_members
  OR can_manage_tasks
  OR can_manage_milestones
  OR can_edit_info
  OR can_access_sensitive;

REVOKE ALL ON FUNCTION private.can_manage_project_tasks(uuid, uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.can_manage_project_milestones(uuid, uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.can_view_task(uuid, uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.can_manage_task(uuid, uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.can_assign_project_task(uuid, uuid, uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.guard_task_update()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.guard_task_checklist_update()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.set_task_completion_timestamp()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.guard_milestone_update()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.ensure_project_member_visibility()
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION private.can_manage_project_tasks(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.can_manage_project_milestones(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.can_view_task(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.can_manage_task(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.can_assign_project_task(uuid, uuid, uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.reorder_task_checklist_item(uuid, uuid, uuid, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reorder_task_checklist_item(uuid, uuid, uuid, integer)
  TO authenticated;

REVOKE ALL PRIVILEGES ON TABLE
  public.milestones,
  public.tasks,
  public.task_checklist_items,
  public.task_comments
FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.milestones TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.tasks TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.task_checklist_items TO authenticated;
GRANT SELECT, INSERT, DELETE ON TABLE public.task_comments TO authenticated;

ALTER TABLE public.milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_checklist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY milestones_select_project_members ON public.milestones
  FOR SELECT TO authenticated
  USING (private.can_view_project(organization_id, project_id));
CREATE POLICY milestones_insert_project_managers ON public.milestones
  FOR INSERT TO authenticated
  WITH CHECK (
    private.can_manage_project_milestones(organization_id, project_id)
    AND created_by = (SELECT auth.uid())
  );
CREATE POLICY milestones_update_project_managers ON public.milestones
  FOR UPDATE TO authenticated
  USING (private.can_manage_project_milestones(organization_id, project_id))
  WITH CHECK (private.can_manage_project_milestones(organization_id, project_id));
CREATE POLICY milestones_delete_project_managers ON public.milestones
  FOR DELETE TO authenticated
  USING (private.can_manage_project_milestones(organization_id, project_id));

CREATE POLICY tasks_select_project_members ON public.tasks
  FOR SELECT TO authenticated
  USING (private.can_view_project(organization_id, project_id));
CREATE POLICY tasks_insert_task_managers ON public.tasks
  FOR INSERT TO authenticated
  WITH CHECK (
    private.can_manage_project_tasks(organization_id, project_id)
    AND private.can_assign_project_task(organization_id, project_id, assignee_id)
    AND created_by = (SELECT auth.uid())
  );
CREATE POLICY tasks_update_managers_or_assignee ON public.tasks
  FOR UPDATE TO authenticated
  USING (private.can_manage_task(organization_id, id))
  WITH CHECK (
    private.can_manage_task(organization_id, id)
    AND private.can_assign_project_task(organization_id, project_id, assignee_id)
  );
CREATE POLICY tasks_delete_task_managers ON public.tasks
  FOR DELETE TO authenticated
  USING (private.can_manage_project_tasks(organization_id, project_id));

CREATE POLICY task_checklist_items_select_project_members ON public.task_checklist_items
  FOR SELECT TO authenticated
  USING (private.can_view_task(organization_id, task_id));
CREATE POLICY task_checklist_items_insert_task_managers ON public.task_checklist_items
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tasks AS t
      WHERE t.organization_id = task_checklist_items.organization_id
        AND t.id = task_checklist_items.task_id
        AND private.can_manage_project_tasks(t.organization_id, t.project_id)
    )
    AND created_by = (SELECT auth.uid())
  );
CREATE POLICY task_checklist_items_update_task_members ON public.task_checklist_items
  FOR UPDATE TO authenticated
  USING (private.can_manage_task(organization_id, task_id))
  WITH CHECK (private.can_manage_task(organization_id, task_id));
CREATE POLICY task_checklist_items_delete_task_managers ON public.task_checklist_items
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tasks AS t
      WHERE t.organization_id = task_checklist_items.organization_id
        AND t.id = task_checklist_items.task_id
        AND private.can_manage_project_tasks(t.organization_id, t.project_id)
    )
  );

CREATE POLICY task_comments_select_project_members ON public.task_comments
  FOR SELECT TO authenticated
  USING (private.can_view_task(organization_id, task_id));
CREATE POLICY task_comments_insert_project_members ON public.task_comments
  FOR INSERT TO authenticated
  WITH CHECK (
    private.can_view_task(organization_id, task_id)
    AND author_id = (SELECT auth.uid())
  );
CREATE POLICY task_comments_delete_author_or_manager ON public.task_comments
  FOR DELETE TO authenticated
  USING (
    private.can_view_task(organization_id, task_id)
    AND (
      author_id = (SELECT auth.uid())
      OR EXISTS (
      SELECT 1 FROM public.tasks AS t
      WHERE t.organization_id = task_comments.organization_id
        AND t.id = task_comments.task_id
        AND private.can_manage_project_tasks(t.organization_id, t.project_id)
      )
    )
  );
