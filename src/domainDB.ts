export type DomainStatus = "SAFE" | "BLOCK";

// Type of the DB object stored in chrome.storage.local
export interface DomainDB {
  [domain: string]: DomainStatus;
}

export function normalizeDomain(url: string): string {
  try {
    const u = new URL(url);
    const parts = u.hostname.split(".");
    if (parts.length <= 2) return u.hostname;
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
