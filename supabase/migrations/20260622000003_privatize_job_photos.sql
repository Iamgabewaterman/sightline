-- Fix 4 — make the job-photos bucket private.
--
-- ⚠️ DEPLOY ORDERING: apply this ONLY AFTER the app code that serves photos via
-- the /api/photo and /api/portal-photo proxies is deployed. Applying it while
-- the old getPublicUrl-based build is live will break every image until deploy.
--
-- After this runs, the bucket is private: direct public URLs 404, and photos are
-- reachable only through the authorizing proxy routes (which stream bytes using
-- the service role). Uploads/deletes by authenticated users keep working via the
-- existing insert/update/delete policies.

UPDATE storage.buckets SET public = false WHERE id = 'job-photos';

DROP POLICY IF EXISTS "Public read access to job-photos" ON storage.objects;
