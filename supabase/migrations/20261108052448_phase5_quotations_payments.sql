-- Phase 5: quotations, line items, manual payments, and payment audit history.
-- Financial records are restricted to organization Owners and Project Managers.

ALTER TABLE public.projects
  ADD CONSTRAINT projects_org_client_id_key UNIQUE (organization_id, client_id, id);

CREATE TABLE private.quotation_number_counters (
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  issue_year integer NOT NULL CHECK (issue_year BETWEEN 2000 AND 9999),
  last_number integer NOT NULL CHECK (last_number > 0),
  PRIMARY KEY (organization_id, issue_year)
);
REVOKE ALL PRIVILEGES ON TABLE private.quotation_number_counters
  FROM PUBLIC, anon, authenticated;

CREATE TABLE public.quotations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  client_id uuid NOT NULL,
  project_id uuid,
  quote_number text NOT NULL,
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 180),
  description text CHECK (description IS NULL OR length(description) <= 5000),
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'sent', 'accepted', 'rejected', 'expired', 'void')),
  template text NOT NULL DEFAULT 'classic'
    CHECK (template IN ('classic', 'modern', 'minimal')),
  issue_date date NOT NULL DEFAULT CURRENT_DATE,
  valid_until date,
  currency text NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  payment_terms text CHECK (payment_terms IS NULL OR length(payment_terms) <= 3000),
  terms_and_conditions text CHECK (
    terms_and_conditions IS NULL OR length(terms_and_conditions) <= 10000
  ),
  notes text CHECK (notes IS NULL OR length(notes) <= 5000),
  signatory_name text CHECK (signatory_name IS NULL OR length(signatory_name) <= 160),
  signatory_title text CHECK (signatory_title IS NULL OR length(signatory_title) <= 160),
  archived_at timestamptz,
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT quotations_organization_id_id_key UNIQUE (organization_id, id),
  CONSTRAINT quotations_organization_client_id_key UNIQUE (organization_id, client_id, id),
  CONSTRAINT quotations_number_per_organization UNIQUE (organization_id, quote_number),
  CONSTRAINT quotations_client_fkey
    FOREIGN KEY (organization_id, client_id)
    REFERENCES public.clients(organization_id, id) ON DELETE RESTRICT,
  CONSTRAINT quotations_project_client_fkey
    FOREIGN KEY (organization_id, client_id, project_id)
    REFERENCES public.projects(organization_id, client_id, id) ON DELETE RESTRICT,
  CONSTRAINT quotations_validity_dates_check CHECK (
    valid_until IS NULL OR valid_until >= issue_date
  )
);

CREATE TABLE public.quotation_line_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  quotation_id uuid NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  description text NOT NULL CHECK (length(btrim(description)) BETWEEN 1 AND 500),
  quantity numeric(12, 3) NOT NULL CHECK (quantity > 0),
  unit_price numeric(14, 2) NOT NULL CHECK (unit_price >= 0),
  discount_percent numeric(5, 2) NOT NULL DEFAULT 0
    CHECK (discount_percent BETWEEN 0 AND 100),
  tax_percent numeric(5, 2) NOT NULL DEFAULT 0 CHECK (tax_percent BETWEEN 0 AND 100),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT quotation_line_items_quote_fkey
    FOREIGN KEY (organization_id, quotation_id)
    REFERENCES public.quotations(organization_id, id) ON DELETE CASCADE
);

CREATE TABLE public.quotation_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  quotation_id uuid,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL CHECK (action IN ('created', 'updated', 'status_changed', 'archived', 'unarchived', 'deleted')),
  old_values jsonb,
  new_values jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  client_id uuid NOT NULL,
  project_id uuid,
  quotation_id uuid,
  amount numeric(14, 2) NOT NULL CHECK (amount > 0),
  currency text NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  paid_on date NOT NULL DEFAULT CURRENT_DATE,
  method text NOT NULL CHECK (method IN ('cash', 'bank_transfer', 'upi', 'card', 'other')),
  reference text CHECK (reference IS NULL OR length(reference) <= 240),
  notes text CHECK (notes IS NULL OR length(notes) <= 5000),
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payments_client_fkey
    FOREIGN KEY (organization_id, client_id)
    REFERENCES public.clients(organization_id, id) ON DELETE RESTRICT,
  CONSTRAINT payments_project_client_fkey
    FOREIGN KEY (organization_id, client_id, project_id)
    REFERENCES public.projects(organization_id, client_id, id) ON DELETE RESTRICT,
  CONSTRAINT payments_quotation_client_fkey
    FOREIGN KEY (organization_id, client_id, quotation_id)
    REFERENCES public.quotations(organization_id, client_id, id) ON DELETE RESTRICT
);

CREATE TABLE public.payment_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  payment_id uuid,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL CHECK (action IN ('created', 'updated', 'deleted')),
  old_values jsonb,
  new_values jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX quotations_org_status_date_idx
  ON public.quotations(organization_id, status, issue_date DESC);
CREATE INDEX quotations_org_client_date_idx
  ON public.quotations(organization_id, client_id, issue_date DESC);
CREATE INDEX quotations_org_project_idx
  ON public.quotations(organization_id, project_id) WHERE project_id IS NOT NULL;
CREATE INDEX quotation_line_items_quote_order_idx
  ON public.quotation_line_items(organization_id, quotation_id, sort_order);
CREATE INDEX quotation_audit_org_quote_date_idx
  ON public.quotation_audit_events(organization_id, quotation_id, occurred_at DESC);
CREATE INDEX payments_org_paid_on_idx ON public.payments(organization_id, paid_on DESC);
CREATE INDEX payments_org_client_date_idx
  ON public.payments(organization_id, client_id, paid_on DESC);
CREATE INDEX payments_org_project_idx
  ON public.payments(organization_id, project_id) WHERE project_id IS NOT NULL;
CREATE INDEX payments_org_quotation_idx
  ON public.payments(organization_id, quotation_id) WHERE quotation_id IS NOT NULL;
CREATE INDEX payment_audit_org_payment_date_idx
  ON public.payment_audit_events(organization_id, payment_id, occurred_at DESC);

CREATE OR REPLACE FUNCTION private.generate_quotation_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_year integer := EXTRACT(YEAR FROM NEW.issue_date)::integer;
  v_next integer;
BEGIN
  INSERT INTO private.quotation_number_counters (organization_id, issue_year, last_number)
  VALUES (NEW.organization_id, v_year, 1)
  ON CONFLICT (organization_id, issue_year)
  DO UPDATE SET last_number = private.quotation_number_counters.last_number + 1
  RETURNING last_number INTO v_next;

  NEW.quote_number := 'QUO-' || v_year::text || '-' || lpad(v_next::text, 4, '0');
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION private.guard_quotation_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.organization_id IS DISTINCT FROM OLD.organization_id
    OR NEW.quote_number IS DISTINCT FROM OLD.quote_number
    OR NEW.created_by IS DISTINCT FROM OLD.created_by
    OR NEW.id IS DISTINCT FROM OLD.id
    OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Quotation organization, number, and creator are immutable';
  END IF;
  IF EXTRACT(YEAR FROM NEW.issue_date) IS DISTINCT FROM EXTRACT(YEAR FROM OLD.issue_date) THEN
    RAISE EXCEPTION 'The issue year cannot change after a quotation number is assigned';
  END IF;
  IF OLD.status <> 'draft' AND (
    NEW.client_id IS DISTINCT FROM OLD.client_id
    OR NEW.project_id IS DISTINCT FROM OLD.project_id
    OR NEW.title IS DISTINCT FROM OLD.title
    OR NEW.description IS DISTINCT FROM OLD.description
    OR NEW.template IS DISTINCT FROM OLD.template
    OR NEW.issue_date IS DISTINCT FROM OLD.issue_date
    OR NEW.valid_until IS DISTINCT FROM OLD.valid_until
    OR NEW.currency IS DISTINCT FROM OLD.currency
    OR NEW.payment_terms IS DISTINCT FROM OLD.payment_terms
    OR NEW.terms_and_conditions IS DISTINCT FROM OLD.terms_and_conditions
    OR NEW.notes IS DISTINCT FROM OLD.notes
    OR NEW.signatory_name IS DISTINCT FROM OLD.signatory_name
    OR NEW.signatory_title IS DISTINCT FROM OLD.signatory_title
  ) THEN
    RAISE EXCEPTION 'Only draft quotations can be edited';
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status AND NOT (
    (OLD.status = 'draft' AND NEW.status IN ('sent', 'void'))
    OR (OLD.status = 'sent' AND NEW.status IN ('accepted', 'rejected', 'expired', 'void'))
  ) THEN
    RAISE EXCEPTION 'This quotation status transition is not allowed';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION private.guard_quotation_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF OLD.status <> 'draft' THEN
    RAISE EXCEPTION 'Only draft quotations can be deleted';
  END IF;
  RETURN OLD;
END;
$$;

CREATE OR REPLACE FUNCTION private.guard_quotation_line_item()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_organization_id uuid;
  v_quotation_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_organization_id := OLD.organization_id;
    v_quotation_id := OLD.quotation_id;
  ELSE
    v_organization_id := NEW.organization_id;
    v_quotation_id := NEW.quotation_id;
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.quotations AS q
    WHERE q.organization_id = v_organization_id
      AND q.id = v_quotation_id
      AND q.status <> 'draft'
  ) THEN
    RAISE EXCEPTION 'Line items on issued quotations cannot be changed';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION private.can_manage_quotation(
  p_organization_id uuid,
  p_quotation_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT private.is_org_admin(p_organization_id)
    AND EXISTS (
      SELECT 1 FROM public.quotations AS q
      WHERE q.organization_id = p_organization_id AND q.id = p_quotation_id
    );
$$;

CREATE OR REPLACE FUNCTION public.get_payment_totals(
  p_organization_id uuid,
  p_client_id uuid DEFAULT NULL,
  p_project_id uuid DEFAULT NULL,
  p_quotation_id uuid DEFAULT NULL
)
RETURNS TABLE(currency text, total_received numeric, received_this_month numeric)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT
    p.currency,
    COALESCE(sum(p.amount), 0)::numeric AS total_received,
    COALESCE(
      sum(p.amount) FILTER (
        WHERE p.paid_on >= date_trunc('month', CURRENT_DATE)::date
      ),
      0
    )::numeric AS received_this_month
  FROM public.payments AS p
  WHERE p.organization_id = p_organization_id
    AND (p_client_id IS NULL OR p.client_id = p_client_id)
    AND (p_project_id IS NULL OR p.project_id = p_project_id)
    AND (p_quotation_id IS NULL OR p.quotation_id = p_quotation_id)
    AND private.is_org_admin(p_organization_id)
  GROUP BY p.currency;
$$;

CREATE OR REPLACE FUNCTION private.audit_payment_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.payment_audit_events (
      organization_id, payment_id, actor_id, action, new_values
    ) VALUES (
      NEW.organization_id, NEW.id, (SELECT auth.uid()), 'created', to_jsonb(NEW)
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.payment_audit_events (
      organization_id, payment_id, actor_id, action, old_values, new_values
    ) VALUES (
      NEW.organization_id, NEW.id, (SELECT auth.uid()), 'updated', to_jsonb(OLD), to_jsonb(NEW)
    );
    RETURN NEW;
  ELSE
    INSERT INTO public.payment_audit_events (
      organization_id, payment_id, actor_id, action, old_values
    ) VALUES (
      OLD.organization_id, OLD.id, (SELECT auth.uid()), 'deleted', to_jsonb(OLD)
    );
    RETURN OLD;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION private.audit_quotation_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_action text;
  v_organization_id uuid;
  v_quotation_id uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_action := 'created';
    v_organization_id := NEW.organization_id;
    v_quotation_id := NEW.id;
    INSERT INTO public.quotation_audit_events (
      organization_id, quotation_id, actor_id, action, new_values
    ) VALUES (
      v_organization_id, v_quotation_id, (SELECT auth.uid()), v_action, to_jsonb(NEW)
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.archived_at IS DISTINCT FROM OLD.archived_at THEN
      v_action := CASE WHEN NEW.archived_at IS NULL THEN 'unarchived' ELSE 'archived' END;
    ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
      v_action := 'status_changed';
    ELSE
      v_action := 'updated';
    END IF;
    INSERT INTO public.quotation_audit_events (
      organization_id, quotation_id, actor_id, action, old_values, new_values
    ) VALUES (
      NEW.organization_id, NEW.id, (SELECT auth.uid()), v_action, to_jsonb(OLD), to_jsonb(NEW)
    );
    RETURN NEW;
  ELSE
    INSERT INTO public.quotation_audit_events (
      organization_id, quotation_id, actor_id, action, old_values
    ) VALUES (
      OLD.organization_id, OLD.id, (SELECT auth.uid()), 'deleted', to_jsonb(OLD)
    );
    RETURN OLD;
  END IF;
END;
$$;

CREATE TRIGGER quotations_generate_number
  BEFORE INSERT ON public.quotations
  FOR EACH ROW EXECUTE FUNCTION private.generate_quotation_number();
CREATE TRIGGER quotations_guard_update
  BEFORE UPDATE ON public.quotations
  FOR EACH ROW EXECUTE FUNCTION private.guard_quotation_update();
CREATE TRIGGER quotations_guard_delete
  BEFORE DELETE ON public.quotations
  FOR EACH ROW EXECUTE FUNCTION private.guard_quotation_delete();
CREATE TRIGGER quotations_write_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.quotations
  FOR EACH ROW EXECUTE FUNCTION private.audit_quotation_change();
CREATE TRIGGER quotation_line_items_guard
  BEFORE INSERT OR UPDATE OR DELETE ON public.quotation_line_items
  FOR EACH ROW EXECUTE FUNCTION private.guard_quotation_line_item();
CREATE TRIGGER payments_write_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION private.audit_payment_change();

REVOKE ALL ON FUNCTION private.generate_quotation_number()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.guard_quotation_update()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.guard_quotation_delete()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.guard_quotation_line_item()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.can_manage_quotation(uuid, uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.audit_payment_change()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.audit_quotation_change()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.can_manage_quotation(uuid, uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.get_payment_totals(uuid, uuid, uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_payment_totals(uuid, uuid, uuid, uuid)
  TO authenticated;

-- Atomic, caller-scoped quotation save. It relies on RLS and table privileges
-- (SECURITY INVOKER), and replaces line items within the same transaction.
CREATE OR REPLACE FUNCTION public.save_quotation(
  p_id uuid,
  p_organization_id uuid,
  p_client_id uuid,
  p_project_id uuid,
  p_title text,
  p_description text,
  p_template text,
  p_issue_date date,
  p_valid_until date,
  p_currency text,
  p_payment_terms text,
  p_terms_and_conditions text,
  p_notes text,
  p_signatory_name text,
  p_signatory_title text,
  p_line_items jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_existing_status text;
BEGIN
  IF (SELECT auth.uid()) IS NULL
    OR NOT private.is_org_admin(p_organization_id) THEN
    RAISE EXCEPTION 'You do not have permission to manage quotations'
      USING ERRCODE = '42501';
  END IF;
  IF p_id IS NULL OR p_title IS NULL OR length(btrim(p_title)) NOT BETWEEN 1 AND 180
    OR p_currency IS NULL OR p_currency !~ '^[A-Z]{3}$'
    OR p_template IS NULL OR p_template NOT IN ('classic', 'modern', 'minimal') THEN
    RAISE EXCEPTION 'Quotation details are invalid' USING ERRCODE = '22023';
  END IF;
  IF p_line_items IS NULL OR jsonb_typeof(p_line_items) <> 'array' THEN
    RAISE EXCEPTION 'Quotation items must be a list' USING ERRCODE = '22023';
  END IF;
  IF jsonb_array_length(p_line_items) NOT BETWEEN 1 AND 100 THEN
    RAISE EXCEPTION 'Quotation must have between one and one hundred items'
      USING ERRCODE = '22023';
  END IF;

  SELECT q.status INTO v_existing_status
  FROM public.quotations AS q
  WHERE q.organization_id = p_organization_id AND q.id = p_id;

  IF FOUND THEN
    IF v_existing_status <> 'draft' THEN
      RAISE EXCEPTION 'Only draft quotations can be edited' USING ERRCODE = '42501';
    END IF;
    UPDATE public.quotations
    SET client_id = p_client_id,
        project_id = p_project_id,
        title = btrim(p_title),
        description = NULLIF(btrim(p_description), ''),
        template = p_template,
        issue_date = p_issue_date,
        valid_until = p_valid_until,
        currency = p_currency,
        payment_terms = NULLIF(btrim(p_payment_terms), ''),
        terms_and_conditions = NULLIF(btrim(p_terms_and_conditions), ''),
        notes = NULLIF(btrim(p_notes), ''),
        signatory_name = NULLIF(btrim(p_signatory_name), ''),
        signatory_title = NULLIF(btrim(p_signatory_title), '')
    WHERE organization_id = p_organization_id AND id = p_id;
    DELETE FROM public.quotation_line_items
    WHERE organization_id = p_organization_id AND quotation_id = p_id;
  ELSE
    INSERT INTO public.quotations (
      id, organization_id, client_id, project_id, title, description, template,
      issue_date, valid_until, currency, payment_terms, terms_and_conditions,
      notes, signatory_name, signatory_title, created_by
    ) VALUES (
      p_id, p_organization_id, p_client_id, p_project_id, btrim(p_title),
      NULLIF(btrim(p_description), ''), p_template, p_issue_date, p_valid_until,
      p_currency, NULLIF(btrim(p_payment_terms), ''),
      NULLIF(btrim(p_terms_and_conditions), ''), NULLIF(btrim(p_notes), ''),
      NULLIF(btrim(p_signatory_name), ''), NULLIF(btrim(p_signatory_title), ''),
      (SELECT auth.uid())
    );
  END IF;

  INSERT INTO public.quotation_line_items (
    organization_id, quotation_id, sort_order, description, quantity,
    unit_price, discount_percent, tax_percent
  )
  SELECT
    p_organization_id,
    p_id,
    line.sort_order,
    btrim(line.description),
    line.quantity,
    line.unit_price,
    COALESCE(line.discount_percent, 0),
    COALESCE(line.tax_percent, 0)
  FROM jsonb_to_recordset(p_line_items) AS line(
    sort_order integer,
    description text,
    quantity numeric,
    unit_price numeric,
    discount_percent numeric,
    tax_percent numeric
  );

  RETURN p_id;
END;
$$;

REVOKE ALL ON FUNCTION public.save_quotation(
  uuid, uuid, uuid, uuid, text, text, text, date, date, text, text, text,
  text, text, text, jsonb
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_quotation(
  uuid, uuid, uuid, uuid, text, text, text, date, date, text, text, text,
  text, text, text, jsonb
) TO authenticated;

CREATE OR REPLACE FUNCTION private.guard_payment_tenant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.organization_id IS DISTINCT FROM OLD.organization_id
      OR NEW.created_by IS DISTINCT FROM OLD.created_by
      OR NEW.id IS DISTINCT FROM OLD.id
      OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'Payment organization and creator cannot be changed';
    END IF;
  END IF;
  IF NEW.quotation_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.quotations AS q
    WHERE q.organization_id = NEW.organization_id
      AND q.client_id = NEW.client_id
      AND q.id = NEW.quotation_id
      AND q.currency = NEW.currency
  ) THEN
    RAISE EXCEPTION 'Payment currency must match its linked quotation';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.guard_payment_tenant()
  FROM PUBLIC, anon, authenticated;
CREATE TRIGGER payments_guard_tenant
  BEFORE INSERT OR UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION private.guard_payment_tenant();

REVOKE ALL PRIVILEGES ON TABLE
  public.quotations,
  public.quotation_line_items,
  public.quotation_audit_events,
  public.payments,
  public.payment_audit_events
FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.quotations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.quotation_line_items TO authenticated;
GRANT SELECT ON TABLE public.quotation_audit_events TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.payments TO authenticated;
GRANT SELECT ON TABLE public.payment_audit_events TO authenticated;

ALTER TABLE public.quotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotation_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotation_audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_audit_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY quotations_select_org_admins ON public.quotations
  FOR SELECT TO authenticated USING (private.is_org_admin(organization_id));
CREATE POLICY quotations_insert_org_admins ON public.quotations
  FOR INSERT TO authenticated
  WITH CHECK (
    private.is_org_admin(organization_id)
    AND created_by = (SELECT auth.uid())
  );
CREATE POLICY quotations_update_org_admins ON public.quotations
  FOR UPDATE TO authenticated
  USING (private.is_org_admin(organization_id))
  WITH CHECK (private.is_org_admin(organization_id));
CREATE POLICY quotations_delete_org_admins ON public.quotations
  FOR DELETE TO authenticated USING (private.is_org_admin(organization_id));

CREATE POLICY quotation_line_items_select_org_admins ON public.quotation_line_items
  FOR SELECT TO authenticated USING (private.can_manage_quotation(organization_id, quotation_id));
CREATE POLICY quotation_line_items_insert_org_admins ON public.quotation_line_items
  FOR INSERT TO authenticated
  WITH CHECK (private.can_manage_quotation(organization_id, quotation_id));
CREATE POLICY quotation_line_items_update_org_admins ON public.quotation_line_items
  FOR UPDATE TO authenticated
  USING (private.can_manage_quotation(organization_id, quotation_id))
  WITH CHECK (private.can_manage_quotation(organization_id, quotation_id));
CREATE POLICY quotation_line_items_delete_org_admins ON public.quotation_line_items
  FOR DELETE TO authenticated USING (private.can_manage_quotation(organization_id, quotation_id));

CREATE POLICY quotation_audit_select_org_admins ON public.quotation_audit_events
  FOR SELECT TO authenticated USING (private.is_org_admin(organization_id));

CREATE POLICY payments_select_org_admins ON public.payments
  FOR SELECT TO authenticated USING (private.is_org_admin(organization_id));
CREATE POLICY payments_insert_org_admins ON public.payments
  FOR INSERT TO authenticated
  WITH CHECK (
    private.is_org_admin(organization_id)
    AND created_by = (SELECT auth.uid())
  );
CREATE POLICY payments_update_org_admins ON public.payments
  FOR UPDATE TO authenticated
  USING (private.is_org_admin(organization_id))
  WITH CHECK (private.is_org_admin(organization_id));
CREATE POLICY payments_delete_org_admins ON public.payments
  FOR DELETE TO authenticated USING (private.is_org_admin(organization_id));

CREATE POLICY payment_audit_select_org_admins ON public.payment_audit_events
  FOR SELECT TO authenticated USING (private.is_org_admin(organization_id));
