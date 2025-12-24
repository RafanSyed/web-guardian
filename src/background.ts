// background.ts — Web Guardian (Pre-navigation blocking)

import {
  normalizeDomain,
  getDomainStatus,
  setDomainStatus
} from "./domainDB";

// ------------------------------------------------------------
// Config - Same keywords as content.ts
// ------------------------------------------------------------
const KEYWORDS: string[] = [
  "manga",
  "manhwa",
  "manhua",
  "webtoon",
  "scanlation",
  "scans",
  "chapter",
  "read manga",
  "read manhwa",
  "toon",
  "anime",
  "mangadex",
  "mangakakalot",
  "manganato"
];

function matchesKeywords(text: string): boolean {
  const t = text.toLowerCase();
  return KEYWORDS.some(k => t.includes(k));
}

function isSearchUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return (
      (u.hostname.includes("google.") && u.pathname === "/search") ||
      (u.hostname.includes("bing.com") && u.pathname === "/search")
    );
  } catch {
    return false;
  }
}

function getSearchQuery(url: string): string {
  try {
    const u = new URL(url);
    return u.searchParams.get("q") ?? "";
  } catch {
    return "";
  }
}

// ------------------------------------------------------------
// Pre-navigation blocking (instant, before page loads)
// ------------------------------------------------------------
chrome.webNavigation.onBeforeNavigate.addListener(async (details) => {
  // Only check main frame navigations (not iframes)
  if (details.frameId !== 0) return;

  const url = details.url;

  // Check if it's a search with blocked keywords
  if (isSearchUrl(url)) {
    const query = getSearchQuery(url);
    if (query && matchesKeywords(query)) {
      // Redirect to block page immediately
      const blockUrl = chrome.runtime.getURL(
        `block.html?reason=${encodeURIComponent(
          `Blocked search query: "${query}"`
        )}&url=${encodeURIComponent(url)}`
      );
      chrome.tabs.update(details.tabId, { url: blockUrl });
      return;
    }
  }

  // Check database for known blocked domains
  const domain = normalizeDomain(url);
  if (domain) {
    const status = await getDomainStatus(domain);
    if (status === "BLOCK") {
      const blockUrl = chrome.runtime.getURL(
        `block.html?reason=${encodeURIComponent(
          "This site is blocked (DB override)."
        )}&url=${encodeURIComponent(url)}`
      );
      chrome.tabs.update(details.tabId, { url: blockUrl });
      return;
    }
  }
});