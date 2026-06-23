// Photo URL helpers for the private `job-photos` bucket.
//
// The bucket is private, so images are served through authorizing proxy routes
// (/api/photo for the logged-in app, /api/portal-photo for the homeowner portal)
// which check access and stream the bytes. These helpers build those URLs.
//
// They accept either a storage path ("jobId/during/123.jpg") or a legacy full
// public URL (older message attachments were stored as public URLs) and
// normalize to the path, so existing data keeps working with no migration.

export function jobPhotoPath(value: string): string {
  if (!value) return value;
  const marker = "/job-photos/";
  const i = value.lastIndexOf(marker);
  if (i !== -1) {
    let p = value.slice(i + marker.length);
    const q = p.indexOf("?");
    if (q !== -1) p = p.slice(0, q);
    try {
      return decodeURIComponent(p);
    } catch {
      return p;
    }
  }
  return value;
}

/** Proxy URL for the authenticated app (verifies the caller owns the job). */
export function photoProxyUrl(value: string): string {
  return `/api/photo?path=${encodeURIComponent(jobPhotoPath(value))}`;
}

/** Proxy URL for the public homeowner portal (verifies the portal token). */
export function portalPhotoProxyUrl(value: string, jobId: string, token: string): string {
  return (
    `/api/portal-photo?job=${encodeURIComponent(jobId)}` +
    `&token=${encodeURIComponent(token)}` +
    `&path=${encodeURIComponent(jobPhotoPath(value))}`
  );
}
