// background.ts — Web Guardian (Pre-navigation blocking + AI integration)

import {
  normalizeDomain,
  getDomainStatus,
  setDomainStatus
} from "./domainDB";

import { 
  classifyWebsite, 
  classifySearchQuery,     // <-- FIX: added import
  checkAIServerHealth 
} from "./aiClassifier";

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

// Store last search query for context
let lastSearchQuery: string = "";

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
// Check AI server status on startup
// ------------------------------------------------------------
checkAIServerHealth().then((isHealthy) => {
  if (isHealthy) {
    console.log("[Web Guardian] ✅ AI server connected");
  } else {
    console.warn("[Web Guardian] ⚠️ AI server not running - using rule engine only");
    console.warn("[Web Guardian] Start server with: node server/ai-server.js");
  }
});

// ------------------------------------------------------------
// Pre-navigation blocking (instant, before page loads)
// ------------------------------------------------------------
chrome.webNavigation.onBeforeNavigate.addListener(async (details) => {
  // Only check main frame navigations (not iframes)
  if (details.frameId !== 0) return;

  const url = details.url;

  // ------------------------------------------------------------
  // SEARCH QUERY HANDLING
  // ------------------------------------------------------------
  if (isSearchUrl(url)) {
    const query = getSearchQuery(url);

    // Save search query for context during website classification
    if (query) lastSearchQuery = query;

    // 1️⃣ Keyword instant block
    if (query && matchesKeywords(query)) {
      const blockUrl = chrome.runtime.getURL(
        `block.html?reason=${encodeURIComponent(
          `Blocked search query: "${query}" (keyword match)`
        )}&url=${encodeURIComponent(url)}`
      );
      chrome.tabs.update(details.tabId, { url: blockUrl });
      return;
    }

    // 2️⃣ AI-based search classification
    if (query) {
      console.log(`[Web Guardian] 🤖 Classifying search with AI: "${query}"`);

      const aiResult = await classifySearchQuery(query);

      if (aiResult === "BLOCK") {
        console.log(`[Web Guardian] 🚫 AI blocked search: "${query}"`);
        const blockUrl = chrome.runtime.getURL(
          `block.html?reason=${encodeURIComponent(
            `AI blocked search: "${query}"`
          )}&url=${encodeURIComponent(url)}`
        );
        chrome.tabs.update(details.tabId, { url: blockUrl });
        return;
      }
    }

    // Allow search result page to load
    return;
  }

  // ------------------------------------------------------------
  // WEBSITE NAVIGATION HANDLING
  // ------------------------------------------------------------
  const domain = normalizeDomain(url);
  if (!domain) return;

  // 1️⃣ Check DB cache
  const storedStatus = await getDomainStatus(domain);
  
  if (storedStatus === "SAFE") {
    console.log(`[Web Guardian] ✅ ${domain} - cached SAFE`);
    return;
  }
  
  if (storedStatus === "BLOCK") {
    console.log(`[Web Guardian] 🚫 ${domain} - cached BLOCK`);
    const blockUrl = chrome.runtime.getURL(
      `block.html?reason=${encodeURIComponent("This site is blocked (cached)")}&url=${encodeURIComponent(url)}`
    );
    chrome.tabs.update(details.tabId, { url: blockUrl });
    return;
  }

  // 2️⃣ Quick keyword scan for obvious manga URLs
  if (matchesKeywords(url)) {
    console.log(`[Web Guardian] 🚫 ${domain} - blocked by keyword URL scan`);
    await setDomainStatus(domain, "BLOCK");
    const blockUrl = chrome.runtime.getURL(
      `block.html?reason=${encodeURIComponent("This site matches restricted keywords")}&url=${encodeURIComponent(url)}`
    );
    chrome.tabs.update(details.tabId, { url: blockUrl });
    return;
  }

  // 3️⃣ AI classification for unknown domains
  console.log(`[Web Guardian] 🤖 ${domain} - sending to AI...`);
  
  const aiResult = await classifyWebsite(
    domain,
    url,
    undefined,
    lastSearchQuery
  );

  if (aiResult === "BLOCK") {
    console.log(`[Web Guardian] 🚫 ${domain} - AI classified as BLOCK`);
    await setDomainStatus(domain, "BLOCK");

    const blockUrl = chrome.runtime.getURL(
      `block.html?reason=${encodeURIComponent(
        "AI classified this site as restricted content"
      )}&url=${encodeURIComponent(url)}`
    );
    chrome.tabs.update(details.tabId, { url: blockUrl });
    return;
  }

  if (aiResult === "SAFE") {
    console.log(`[Web Guardian] ✅ ${domain} - AI classified SAFE`);
    await setDomainStatus(domain, "SAFE");
    return;
  }

  // 4️⃣ AI returned UNKNOWN → let content.ts do deeper checks
  console.log(`[Web Guardian] ⏭️ ${domain} - passing to content script`);
});

// Clear last search query after 5 minutes
setInterval(() => {
  if (lastSearchQuery) {
    lastSearchQuery = "";
    console.log("[Web Guardian] Cleared search context");
  }
}, 5 * 60 * 1000);
