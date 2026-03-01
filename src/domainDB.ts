export type DomainStatus = "SAFE" | "BLOCK";

// Type of the DB object stored in chrome.storage.local
export interface DomainDB {
  [domain: string]: DomainStatus;
}

export function normalizeDomain(url: string): string {
  try {
    const u = new URL(url);
    const parts = u.hostname.split(".");

    // If it's an IP address, return as-is
    if (/^\d+\.\d+\.\d+\.\d+$/.test(u.hostname)) return u.hostname;

    // Known multi-part TLD patterns
    // If second-to-last part is very short (2 chars) AND last part is short (2-3 chars)
    // it's likely a country-code TLD like .co.uk, .com.au, .org.br etc.
    const last = parts[parts.length - 1];
    const secondLast = parts[parts.length - 2];

    const isMultiPartTLD =
      last.length <= 3 &&           // country code e.g. "uk", "au", "br"
      secondLast.length <= 3 &&     // second part e.g. "co", "org", "com", "net"
      parts.length >= 3;            // needs at least one more part before it

    if (isMultiPartTLD) {
      // Take 3 parts: e.g. afcbournemouth.co.uk
      return parts.slice(-3).join(".");
    }

    // Normal domain: take last 2 parts
    return parts.slice(-2).join(".");

  } catch {
    return "";
  }
}

export async function getDomainStatus(domain: string): Promise<DomainStatus | null> {
  const result = await chrome.storage.local.get("domainDB");

  const domainDB = (result.domainDB || {}) as DomainDB;

  return domainDB[domain] ?? null;
}

export async function setDomainStatus(domain: string, status: DomainStatus) {
  const result = await chrome.storage.local.get("domainDB");

  const domainDB = (result.domainDB || {}) as DomainDB;

  const updated: DomainDB = {
    ...domainDB,
    [domain]: status
  };

  await chrome.storage.local.set({ domainDB: updated });
}
