const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";

export async function geocodeAddress(
  address: string
): Promise<{ lat: number; lng: number } | null> {
  if (!MAPBOX_TOKEN || !address.trim()) return null;
  try {
    const encoded = encodeURIComponent(address);
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encoded}.json?access_token=${MAPBOX_TOKEN}&limit=1`;
    const res = await fetch(url, { next: { revalidate: 86400 } });
    if (!res.ok) return null;
    const json = await res.json();
    const feature = json?.features?.[0];
    if (!feature) return null;
    const [lng, lat] = feature.geometry.coordinates as [number, number];
    return { lat, lng };
  } catch {
    return null;
  }
}
