CREATE TABLE punch_list_photos (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id uuid NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  punch_list_item_id uuid REFERENCES punch_list_items(id) ON DELETE SET NULL,
  storage_path text NOT NULL,
  description text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE punch_list_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users manage own punch list photos"
  ON punch_list_photos FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX punch_list_photos_job_id_idx ON punch_list_photos(job_id);
CREATE INDEX punch_list_photos_item_id_idx ON punch_list_photos(punch_list_item_id);
