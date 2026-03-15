export interface ParsedAddress {
  zip: string | null;
  city: string | null;
  state: string | null;
}

/**
 * Extracts zip, city, and state from a free-text US address string.
 * Handles "123 Main St, Portland, OR 97201" and similar formats.
 */
export function parseAddress(address: string | null | undefined): ParsedAddress {
  if (!address) return { zip: null, city: null, state: null };

  // Match: ", City Name, ST 12345" or ", City Name ST 12345"
  const match = address.match(/,\s*([^,]+?),?\s+([A-Z]{2})\s+(\d{5})(?:-\d{4})?/i);
  if (match) {
    return {
      city: match[1].trim(),
      state: match[2].toUpperCase(),
      zip: match[3],
    };
  }

  // Fallback: just a bare zip code anywhere in the string
  const zipMatch = address.match(/\b(\d{5})(?:-\d{4})?\b/);
  return {
    zip: zipMatch ? zipMatch[1] : null,
    city: null,
    state: null,
  };
}
