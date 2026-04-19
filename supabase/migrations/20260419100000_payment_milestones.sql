CREATE TABLE payment_milestones (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id  uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL,
  label       text NOT NULL DEFAULT '',
  amount      numeric(12,2) NOT NULL DEFAULT 0,
  due_date    date,
  status      text NOT NULL DEFAULT 'unpaid'
              CHECK (status IN ('unpaid', 'paid')),
  paid_at     timestamptz,
  sort_order  integer NOT NULL DEFAULT 0,
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE payment_milestones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner" ON payment_milestones FOR ALL
  USING  (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
