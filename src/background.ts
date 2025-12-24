// // background.ts — Web Guardian background logic
// // ------------------------------------------------------------
// // Handles:
// // - Preloading mandatory SAFE domains
// // - Navigation blocking based on DB
// // - Optional fast keyword heuristic
// // ------------------------------------------------------------

// import {
//   normalizeDomain,
//   getDomainStatus,
//   setDomainStatus,
// } from "./domainDB.js";   // ✅ FIXED PATH (must be relative to JS output)

// // TypeScript-only type (not imported from JS)
// type DomainDB = { [domain: string]: "SAFE" | "BLOCK" };

// // ------------------------------------------------------------
// // 1) Mandatory SAFE domains (baseline)
// // ------------------------------------------------------------
// const mandatorySafe: DomainDB = {
//   "instagram.com": "SAFE",
//   "google.com": "SAFE",
//   "docs.google.com": "SAFE",
//   "tiktok.com": "SAFE",
//   "usflearn.instructure.com": "SAFE",
//   "leetcode.com": "SAFE",
//   "outlook.office.com": "SAFE",
//   "app.joinhandshake.com": "SAFE",
//   "chatgpt.com": "SAFE",
//   "github.com": "SAFE",
//   "linkedin.com": "SAFE",
//   "localhost": "SAFE",
//   "login.microsoftonline.com": "SAFE",
//   "mail.google.com": "SAFE",
//   "drive.google.com": "SAFE",
//   "studentssb9.it.usf.edu": "SAFE",
//   "canvas.usf.edu": "SAFE",
//   "canvas.instructure.com": "SAFE",
//   "arabiconline.fawakih.org": "SAFE",
//   "accounts.google.com": "SAFE",
//   "youtube.com": "SAFE",
//   "netflix.com": "SAFE",
//   "my.usf.edu": "SAFE",
//   "registrar.usf.edu": "SAFE",
//   "stackoverflow.com": "SAFE",
//   "cse.google.com": "SAFE",
//   "onedrive.live.com": "SAFE",
//   "outlook.live.com": "SAFE",
//   "zerogpt.com": "SAFE",
//   "simplify.jobs": "SAFE",
//   "glassdoor.com": "SAFE",
//   "greenhouse.io": "SAFE",
//   "calculator.net": "SAFE",
//   "quillbot.com": "SAFE",
//   "islamqa.org": "SAFE",
//   "gradapply.purdue.edu": "SAFE"
// };

// // ------------------------------------------------------------
// // 2) On install → preload SAFE list
// // ------------------------------------------------------------
// chrome.runtime.onInstalled.addListener(async () => {
//   const result = await chrome.storage.local.get("domainDB");
//   const existing = (result.domainDB || {}) as DomainDB;

//   const updated = { ...mandatorySafe, ...existing };
//   await chrome.storage.local.set({ domainDB: updated });

//   console.log("SAFE baseline loaded.");
// });

// // ------------------------------------------------------------
// // 3) Fast domain-only heuristic for unknown sites
// // ------------------------------------------------------------
// function looksLikeManga(domain: string): boolean {
//   return [
//     "manga",
//     "manhwa",
//     "manhua",
//     "webtoon",
//     "scan",
//     "raw",
//     "hentai",
//     "doujin"
//   ].some(k => domain.includes(k));
// }

// // ------------------------------------------------------------
// // 4) Navigation handler
// // ------------------------------------------------------------
// chrome.webNavigation.onBeforeNavigate.addListener(async (details) => {
//   if (!details.url.startsWith("http")) return;

//   const domain = normalizeDomain(details.url);
//   const status = await getDomainStatus(domain);

//   // DB override
//   if (status === "BLOCK") {
//     chrome.tabs.update(details.tabId!, {
//       url: chrome.runtime.getURL("block.html")
//     });
//     return;
//   }

//   if (status === "SAFE") {
//     return;
//   }

//   // Unknown domain → heuristic
//   if (looksLikeManga(domain)) {
//     await setDomainStatus(domain, "BLOCK");
//     chrome.tabs.update(details.tabId!, {
//       url: chrome.runtime.getURL("block.html")
//     });
//     return;
//   }

//   // Otherwise let content.ts decide
// });



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