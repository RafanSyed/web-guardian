// // content.ts — Web Guardian (local DB + rule engine + safe/block pipeline)

// // ------------------------------------------------------------
// // Imports (ES module, works after TS → JS compile)
// // ------------------------------------------------------------
// import {
//   normalizeDomain,
//   getDomainStatus,
//   setDomainStatus
// } from "./domainDB";

// // ------------------------------------------------------------
// // Config
// // ------------------------------------------------------------
// const USE_GATING = true;

// // Simple keywords for immediate blocking
// const KEYWORDS: string[] = [
//   "manga",
//   "manhwa",
//   "manhua",
//   "webtoon",
//   "scanlation",
//   "scans",
//   "chapter",
//   "read manga",
//   "read manhwa",
//   "toon",
//   "anime",
//   "mangadex",
//   "mangakakalot",
//   "manganato"
// ];

// // Keywords indicating dangerous content type
// const CONTENT_ROOTS: string[] = [
//   "manga",
//   "manhwa",
//   "manhua",
//   "webtoon",
//   "doujin",
//   "doujinshi",
//   "scanlation",
//   "scanlator",
//   "scanlat",
//   "hentai",
//   "ecchi",
//   "nsfw",
//   "r18",
//   "18plus",
//   "anime"
// ];

// // Words indicating reading/consumption intent
// const INTENT_WORDS: string[] = [
//   "read",
//   "chapter",
//   "chapters",
//   "online",
//   "free",
//   "raw",
//   "translated",
//   "scan",
//   "scans",
//   "viewer",
//   "full",
//   "latest"
// ];

// // Strong combined phrases
// const COMBO_PHRASES: string[] = [
//   "readmanga",
//   "readmanhwa",
//   "readmanhua",
//   "readwebtoon",
//   "mangaread",
//   "manhwaread",
//   "webtoonread",
//   "rawchapter",
//   "rawchapters"
// ];

// // ------------------------------------------------------------
// // Helpers
// // ------------------------------------------------------------

// function normalize(text: string): string {
//   return text
//     .toLowerCase()
//     .normalize("NFKD")
//     .replace(/[\u0300-\u036f]/g, "")
//     .replace(/[^a-z0-9]/g, "")
//     .replace(/0/g, "o")
//     .replace(/1/g, "i")
//     .replace(/3/g, "e")
//     .replace(/4/g, "a")
//     .replace(/5/g, "s")
//     .replace(/7/g, "t");
// }

// function matchesKeywords(text: string): boolean {
//   const t = text.toLowerCase();
//   return KEYWORDS.some(k => t.includes(k));
// }

// function escapeHtml(s: string): string {
//   return s.replace(/[&<>"']/g, (c) =>
//     ({
//       "&": "&amp;",
//       "<": "&lt;",
//       ">": "&gt;",
//       '"': "&quot;",
//       "'": "&#39;"
//     }[c] as string)
//   );
// }

// function redirectToBlock(reason: string): void {
//   const url = encodeURIComponent(location.href);
//   const r = encodeURIComponent(reason);
//   const blockUrl = chrome.runtime.getURL(`block.html?reason=${r}&url=${url}`);
//   location.replace(blockUrl);
// }

// function isGoogleSearch(): boolean {
//   return location.hostname.includes("google.") && location.pathname === "/search";
// }

// function isBingSearch(): boolean {
//   return location.hostname.includes("bing.com") && location.pathname === "/search";
// }

// function getSearchQuery(): string {
//   try {
//     return new URL(location.href).searchParams.get("q") ?? "";
//   } catch {
//     return "";
//   }
// }

// // ------------------------------------------------------------
// // TYPE: Rule result
// // ------------------------------------------------------------
// type RuleResult = "SAFE" | "BLOCK" | "UNKNOWN";

// // ------------------------------------------------------------
// // RULE ENGINE (for regular sites)
// // ------------------------------------------------------------
// function ruleCheck(text: string): RuleResult {
//   const t = normalize(text);

//   if (!USE_GATING) {
//     return "UNKNOWN";
//   }

//   const hasRoot =
//     CONTENT_ROOTS.some((r) => t.includes(normalize(r))) ||
//     COMBO_PHRASES.some((p) => t.includes(normalize(p)));

//   const hasIntent =
//     INTENT_WORDS.some((w) => t.includes(normalize(w))) ||
//     COMBO_PHRASES.some((p) => t.includes(normalize(p)));

//   // Block if both root + intent
//   if (hasRoot && hasIntent) return "BLOCK";
  
//   // Also block combo phrases on their own (they inherently contain both)
//   if (COMBO_PHRASES.some((p) => t.includes(normalize(p)))) return "BLOCK";

//   return "UNKNOWN";
// }

// // ------------------------------------------------------------
// // 🚨 IMMEDIATE SEARCH BLOCKING (runs first, synchronously)
// // ------------------------------------------------------------
// if (isGoogleSearch() || isBingSearch()) {
//   const q = getSearchQuery();
//   if (matchesKeywords(q)) {
//     redirectToBlock(`Blocked search query: "${escapeHtml(q)}"`);
//     // Stop execution here
//     throw new Error("Search blocked");
//   }
// }

// // ------------------------------------------------------------
// // MAIN EXECUTION PIPELINE FOR REGULAR SITES
// // DB → RULES → (AI later) → DB
// // ------------------------------------------------------------
// (async function () {
//   // Skip DB checks for search engines
//   if (isGoogleSearch() || isBingSearch()) {
//     return;
//   }

//   const domain: string = normalizeDomain(location.href);
//   if (!domain) return;

//   // 1️⃣ DB OVERRIDE
//   const stored: string | null = await getDomainStatus(domain);

//   if (stored === "SAFE") {
//     return;
//   }

//   if (stored === "BLOCK") {
//     redirectToBlock("This site is blocked (DB override).");
//     return;
//   }

//   // 2️⃣ UNKNOWN DOMAIN → RULE CHECKS

//   // --- URL CHECK ---
//   const url = location.href;
//   if (matchesKeywords(url)) {
//     await setDomainStatus(domain, "BLOCK");
//     redirectToBlock("This page matches restricted keywords.");
//     return;
//   }

//   const urlCheck: RuleResult = ruleCheck(url);
//   if (urlCheck === "BLOCK") {
//     await setDomainStatus(domain, "BLOCK");
//     redirectToBlock("This page matches restricted content (URL).");
//     return;
//   }

//   // --- DOM CHECK ---
//   window.addEventListener("DOMContentLoaded", async () => {
//     const title: string = document.title || "";
//     const metaDesc: string =
//       (document.querySelector('meta[name="description"]') as HTMLMetaElement | null)?.content ??
//       "";
//     const bodyText: string = document.body?.innerText?.slice(0, 4000) ?? "";

//     // Simple keyword check first
//     if (matchesKeywords(title) || matchesKeywords(bodyText)) {
//       await setDomainStatus(domain, "BLOCK");
//       redirectToBlock("This page looks like restricted content.");
//       return;
//     }

//     // Advanced rule check
//     const combined: string = `${title}\n${metaDesc}\n${bodyText}`;
//     const bodyResult: RuleResult = ruleCheck(combined);

//     if (bodyResult === "BLOCK") {
//       await setDomainStatus(domain, "BLOCK");
//       redirectToBlock("This page looks like restricted content (title/body).");
//       return;
//     }

//     // 3️⃣ SAFE fallback (AI will refine later)
//     await setDomainStatus(domain, "SAFE");
//   });
// })();



// content.ts — Web Guardian (local DB + rule engine + safe/block pipeline)

// ------------------------------------------------------------
// Imports (ES module, works after TS → JS compile)
// ------------------------------------------------------------
import {
  normalizeDomain,
  getDomainStatus,
  setDomainStatus
} from "./domainDB";

// ------------------------------------------------------------
// Config
// ------------------------------------------------------------
const USE_GATING = true;

// Simple keywords for immediate blocking
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

// Keywords indicating dangerous content type
const CONTENT_ROOTS: string[] = [
  "manga",
  "manhwa",
  "manhua",
  "webtoon",
  "doujin",
  "doujinshi",
  "scanlation",
  "scanlator",
  "scanlat",
  "hentai",
  "ecchi",
  "nsfw",
  "r18",
  "18plus",
  "anime"
];

// Words indicating reading/consumption intent
const INTENT_WORDS: string[] = [
  "read",
  "chapter",
  "chapters",
  "online",
  "free",
  "raw",
  "translated",
  "scan",
  "scans",
  "viewer",
  "full",
  "latest"
];

// Strong combined phrases
const COMBO_PHRASES: string[] = [
  "readmanga",
  "readmanhwa",
  "readmanhua",
  "readwebtoon",
  "mangaread",
  "manhwaread",
  "webtoonread",
  "rawchapter",
  "rawchapters"
];

// ------------------------------------------------------------
// Helpers
// ------------------------------------------------------------

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "")
    .replace(/0/g, "o")
    .replace(/1/g, "i")
    .replace(/3/g, "e")
    .replace(/4/g, "a")
    .replace(/5/g, "s")
    .replace(/7/g, "t");
}

function matchesKeywords(text: string): boolean {
  const t = text.toLowerCase();
  return KEYWORDS.some(k => t.includes(k));
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    }[c] as string)
  );
}

function redirectToBlock(reason: string): void {
  const url = encodeURIComponent(location.href);
  const r = encodeURIComponent(reason);
  const blockUrl = chrome.runtime.getURL(`block.html?reason=${r}&url=${url}`);
  location.replace(blockUrl);
}

function isGoogleSearch(): boolean {
  return location.hostname.includes("google.") && location.pathname === "/search";
}

function isBingSearch(): boolean {
  return location.hostname.includes("bing.com") && location.pathname === "/search";
}

function getSearchQuery(): string {
  try {
    return new URL(location.href).searchParams.get("q") ?? "";
  } catch {
    return "";
  }
}

// ------------------------------------------------------------
// TYPE: Rule result
// ------------------------------------------------------------
type RuleResult = "SAFE" | "BLOCK" | "UNKNOWN";

// ------------------------------------------------------------
// RULE ENGINE (for regular sites)
// ------------------------------------------------------------
function ruleCheck(text: string): RuleResult {
  const t = normalize(text);

  if (!USE_GATING) {
    return "UNKNOWN";
  }

  const hasRoot =
    CONTENT_ROOTS.some((r) => t.includes(normalize(r))) ||
    COMBO_PHRASES.some((p) => t.includes(normalize(p)));

  const hasIntent =
    INTENT_WORDS.some((w) => t.includes(normalize(w))) ||
    COMBO_PHRASES.some((p) => t.includes(normalize(p)));

  // Block if both root + intent
  if (hasRoot && hasIntent) return "BLOCK";
  
  // Also block combo phrases on their own (they inherently contain both)
  if (COMBO_PHRASES.some((p) => t.includes(normalize(p)))) return "BLOCK";

  return "UNKNOWN";
}

// ------------------------------------------------------------
// Search blocking is now handled by background.ts for instant blocking
// This is just a backup in case background script misses it
// ------------------------------------------------------------
if (isGoogleSearch() || isBingSearch()) {
  const q = getSearchQuery();
  if (matchesKeywords(q)) {
    redirectToBlock(`Blocked search query: "${escapeHtml(q)}"`);
  }
}

// ------------------------------------------------------------
// MAIN EXECUTION PIPELINE FOR REGULAR SITES
// DB → RULES → (AI later) → DB
// ------------------------------------------------------------
(async function () {
  // Skip DB checks for search engines
  if (isGoogleSearch() || isBingSearch()) {
    return;
  }

  const domain: string = normalizeDomain(location.href);
  if (!domain) return;

  // 1️⃣ DB OVERRIDE
  const stored: string | null = await getDomainStatus(domain);

  if (stored === "SAFE") {
    return;
  }

  if (stored === "BLOCK") {
    redirectToBlock("This site is blocked (DB override).");
    return;
  }

  // 2️⃣ UNKNOWN DOMAIN → RULE CHECKS

  // --- URL CHECK ---
  const url = location.href;
  if (matchesKeywords(url)) {
    await setDomainStatus(domain, "BLOCK");
    redirectToBlock("This page matches restricted keywords.");
    return;
  }

  const urlCheck: RuleResult = ruleCheck(url);
  if (urlCheck === "BLOCK") {
    await setDomainStatus(domain, "BLOCK");
    redirectToBlock("This page matches restricted content (URL).");
    return;
  }

  // --- DOM CHECK ---
  window.addEventListener("DOMContentLoaded", async () => {
    const title: string = document.title || "";
    const metaDesc: string =
      (document.querySelector('meta[name="description"]') as HTMLMetaElement | null)?.content ??
      "";
    const bodyText: string = document.body?.innerText?.slice(0, 4000) ?? "";

    // Simple keyword check first
    if (matchesKeywords(title) || matchesKeywords(bodyText)) {
      await setDomainStatus(domain, "BLOCK");
      redirectToBlock("This page looks like restricted content.");
      return;
    }

    // Advanced rule check
    const combined: string = `${title}\n${metaDesc}\n${bodyText}`;
    const bodyResult: RuleResult = ruleCheck(combined);

    if (bodyResult === "BLOCK") {
      await setDomainStatus(domain, "BLOCK");
      redirectToBlock("This page looks like restricted content (title/body).");
      return;
    }

    // 3️⃣ SAFE fallback (AI will refine later)
    await setDomainStatus(domain, "SAFE");
  });
})();