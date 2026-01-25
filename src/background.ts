// background.ts — Web Guardian (Pre-navigation blocking + AI integration)

import { normalizeDomain, getDomainStatus, setDomainStatus } from "./domainDB";
import { classifyWebsite, classifySearchQuery, checkAIServerHealth } from "./aiClassifier";

// ------------------------------------------------------------
// Config
// ------------------------------------------------------------

// Manga/reading keywords (global)
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
  "manganato",
];

// YouTube-only risky keywords (keep small & high-signal)
const YT_RISKY_KEYWORDS: string[] = [
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
  "manganato",
  "nudity",
  "nude",
  "strip",
  "bikini",
  "lingerie",
  "twerk",
  "booty",
  "try on haul",
  "try-on haul",
  "see through",
  "seethrough",
  "transparent",
  "camel toe",
  "cleavage",
  "donut",
  "🍩",
];

// Store last search query for context (non-YouTube)
let lastSearchQuery: string = "";

// Prevent repeated blocking for same tab+url (stops spam/loops)
const recentlyBlocked = new Map<number, { url: string; ts: number }>();
const RECENT_BLOCK_MS = 3000;

function matchesAny(text: string, words: string[]): boolean {
  const t = (text || "").toLowerCase();
  return words.some((w) => t.includes(w));
}

function matchesKeywords(text: string): boolean {
  // global manga keywords
  return matchesAny(text, KEYWORDS);
}

function isYouTubeHost(host: string): boolean {
  return host === "youtube.com" || host.endsWith(".youtube.com");
}

function isYouTubeResults(url: string): boolean {
  try {
    const u = new URL(url);
    return isYouTubeHost(u.hostname) && u.pathname === "/results" && u.searchParams.has("search_query");
  } catch {
    return false;
  }
}

function isGoogleSearch(url: string): boolean {
  try {
    const u = new URL(url);
    return u.hostname.includes("google.") && u.pathname === "/search";
  } catch {
    return false;
  }
}

function isBingSearch(url: string): boolean {
  try {
    const u = new URL(url);
    return u.hostname.includes("bing.com") && u.pathname === "/search";
  } catch {
    return false;
  }
}

function isSearchUrl(url: string): boolean {
  return isGoogleSearch(url) || isBingSearch(url) || isYouTubeResults(url);
}

function getSearchQuery(url: string): string {
  try {
    const u = new URL(url);

    if (isGoogleSearch(url) || isBingSearch(url)) {
      return u.searchParams.get("q") ?? "";
    }

    if (isYouTubeResults(url)) {
      return u.searchParams.get("search_query") ?? "";
    }

    return "";
  } catch {
    return "";
  }
}

function isBlockPage(url: string): boolean {
  // chrome-extension://<id>/block.html?...
  return url.includes("block.html");
}

type NavDetails = { tabId: number; frameId: number; url?: string };

function shouldHandle(details: NavDetails): details is { tabId: number; frameId: number; url: string } {
  return (
    details.frameId === 0 &&
    details.tabId !== -1 &&
    typeof details.url === "string" &&
    details.url.length > 0
  );
}

async function redirectOnce(tabId: number, targetUrl: string) {
  const now = Date.now();
  const prev = recentlyBlocked.get(tabId);

  if (prev && prev.url === targetUrl && now - prev.ts < RECENT_BLOCK_MS) return;

  recentlyBlocked.set(tabId, { url: targetUrl, ts: now });
  chrome.tabs.update(tabId, { url: targetUrl });
}

// ------------------------------------------------------------
// Check AI server status on startup
// ------------------------------------------------------------
checkAIServerHealth().then((isHealthy) => {
  if (isHealthy) console.log("[Web Guardian] ✅ AI server connected");
  else console.warn("[Web Guardian] ⚠️ AI server not running - using rule engine only");
});

// ------------------------------------------------------------
// Main handler (called by multiple webNavigation events)
// ------------------------------------------------------------
async function handleMainFrameUrl(tabId: number, url: string) {
  // 0) Never process our own block page (prevents infinite loops)
  if (isBlockPage(url)) return;

  // ------------------------------------------------------------
  // A) SEARCH QUERY HANDLING (Google/Bing/YouTube results)
  // ------------------------------------------------------------
  if (isSearchUrl(url)) {
    const query = getSearchQuery(url);

    // Save search query context ONLY for Google/Bing (not YouTube)
    if (query && (isGoogleSearch(url) || isBingSearch(url))) {
      lastSearchQuery = query;
    }

    // ---------------------------
    // YouTube search results page
    // ---------------------------
    if (isYouTubeResults(url)) {
      // ✅ 1) Apply GLOBAL keyword blocking on YouTube searches too (manga/webtoon/etc.)
      if (query && matchesKeywords(query)) {
        const blockUrl = chrome.runtime.getURL(
          `block.html?reason=${encodeURIComponent(
            `Blocked YouTube search: "${query}" (global keyword match)`
          )}&url=${encodeURIComponent(url)}`
        );
        await redirectOnce(tabId, blockUrl);
        return;
      }

      // ✅ 2) Apply YouTube-only risky keywords
      if (query && matchesAny(query, YT_RISKY_KEYWORDS)) {
        const blockUrl = chrome.runtime.getURL(
          `block.html?reason=${encodeURIComponent(
            `Blocked YouTube search: "${query}" (YT risky keyword)`
          )}&url=${encodeURIComponent(url)}`
        );
        await redirectOnce(tabId, blockUrl);
        return;
      }

      // ✅ 3) If it passes keywords → run AI (with YouTube context)
      if (query) {
        console.log(`[Web Guardian] 🤖 Classifying YouTube search with AI: "${query}"`);
        const aiResult = await classifySearchQuery(`[YOUTUBE_SEARCH] ${query}`);

        if (aiResult === "BLOCK") {
          const blockUrl = chrome.runtime.getURL(
            `block.html?reason=${encodeURIComponent(
              `AI blocked YouTube search: "${query}"`
            )}&url=${encodeURIComponent(url)}`
          );
          await redirectOnce(tabId, blockUrl);
          return;
        }
      }

      // Allowed YouTube search results if not blocked
      return;
    }

    // ---------------------------
    // Google / Bing searches
    // ---------------------------

    // 1️⃣ Global keyword instant block
    if (query && matchesKeywords(query)) {
      const blockUrl = chrome.runtime.getURL(
        `block.html?reason=${encodeURIComponent(
          `Blocked search query: "${query}" (keyword match)`
        )}&url=${encodeURIComponent(url)}`
      );
      await redirectOnce(tabId, blockUrl);
      return;
    }

    // 2️⃣ AI-based search classification
    if (query) {
      console.log(`[Web Guardian] 🤖 Classifying search with AI: "${query}"`);
      const aiResult = await classifySearchQuery(query);

      if (aiResult === "BLOCK") {
        const blockUrl = chrome.runtime.getURL(
          `block.html?reason=${encodeURIComponent(
            `AI blocked search: "${query}"`
          )}&url=${encodeURIComponent(url)}`
        );
        await redirectOnce(tabId, blockUrl);
        return;
      }
    }

    return;
  }

  // ------------------------------------------------------------
  // B) WEBSITE NAVIGATION HANDLING
  // ------------------------------------------------------------
  const domain = normalizeDomain(url);
  if (!domain) return;

  // ✅ IMPORTANT: Never classify YouTube as a WEBSITE.
  // YouTube is allowed as a site; ONLY searches (/results) are filtered.
  if (domain === "youtube.com" || domain.endsWith(".youtube.com")) {
    return;
  }

  // 1) Check DB cache (non-YouTube only)
  const storedStatus = await getDomainStatus(domain);

  if (storedStatus === "SAFE") {
    console.log(`[Web Guardian] ✅ ${domain} - cached SAFE`);
    return;
  }

  if (storedStatus === "BLOCK") {
    console.log(`[Web Guardian] 🚫 ${domain} - cached BLOCK`);
    const blockUrl = chrome.runtime.getURL(
      `block.html?reason=${encodeURIComponent(
        "This site is blocked (cached)"
      )}&url=${encodeURIComponent(url)}`
    );
    await redirectOnce(tabId, blockUrl);
    return;
  }

  // 2) Keyword URL scan
  if (matchesKeywords(url)) {
    console.log(`[Web Guardian] 🚫 ${domain} - blocked by keyword URL scan`);
    await setDomainStatus(domain, "BLOCK");

    const blockUrl = chrome.runtime.getURL(
      `block.html?reason=${encodeURIComponent(
        "This site matches restricted keywords"
      )}&url=${encodeURIComponent(url)}`
    );
    await redirectOnce(tabId, blockUrl);
    return;
  }

  // 3) AI classification (non-YouTube only)
  console.log(`[Web Guardian] 🤖 ${domain} - sending to AI...`);
  const aiResult = await classifyWebsite(domain, url, undefined, lastSearchQuery);

  if (aiResult === "BLOCK") {
    console.log(`[Web Guardian] 🚫 ${domain} - AI classified as BLOCK`);
    await setDomainStatus(domain, "BLOCK");

    const blockUrl = chrome.runtime.getURL(
      `block.html?reason=${encodeURIComponent(
        "AI classified this site as restricted content"
      )}&url=${encodeURIComponent(url)}`
    );
    await redirectOnce(tabId, blockUrl);
    return;
  }

  if (aiResult === "SAFE") {
    console.log(`[Web Guardian] ✅ ${domain} - AI classified SAFE`);
    await setDomainStatus(domain, "SAFE");
    return;
  }

  console.log(`[Web Guardian] ⏭️ ${domain} - passing to content script`);
}

// ------------------------------------------------------------
// Register listeners (covers normal nav + YouTube SPA)
// ------------------------------------------------------------

chrome.webNavigation.onBeforeNavigate.addListener((details) => {
  if (!shouldHandle(details)) return;
  handleMainFrameUrl(details.tabId, details.url);
});

chrome.webNavigation.onCommitted.addListener((details) => {
  if (!shouldHandle(details)) return;
  handleMainFrameUrl(details.tabId, details.url);
});

chrome.webNavigation.onHistoryStateUpdated.addListener((details) => {
  if (!shouldHandle(details)) return;
  handleMainFrameUrl(details.tabId, details.url);
});

// Clear last search query after 5 minutes
setInterval(() => {
  if (lastSearchQuery) {
    lastSearchQuery = "";
    console.log("[Web Guardian] Cleared search context");
  }
}, 5 * 60 * 1000);

// Cleanup recentlyBlocked map occasionally
setInterval(() => {
  const now = Date.now();
  for (const [tabId, entry] of recentlyBlocked.entries()) {
    if (now - entry.ts > 30_000) recentlyBlocked.delete(tabId);
  }
}, 30_000);
