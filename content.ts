const KEYWORDS = [
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
  "anime"
];

function matchesKeywords(text: string): boolean {
  const t = text.toLowerCase();
  return KEYWORDS.some(k => t.includes(k));
}

function isGoogleSearch(): boolean {
  return location.hostname.includes("google.") && location.pathname === "/search";
}

function getSearchQuery(): string {
  try {
    return new URL(location.href).searchParams.get("q") ?? "";
  } catch {
    return "";
  }
}

function redirectToBlock(reason: string) {
  const url = encodeURIComponent(location.href);
  const r = encodeURIComponent(reason);

  // This is the extension's internal page:
  const blockUrl = chrome.runtime.getURL(`block.html?reason=${r}&url=${url}`);

  // Use location.replace so back button doesn’t instantly re-trigger a broken state
  location.replace(blockUrl);
}

// ✅ Clean Google search blocking (no UI break)
if (isGoogleSearch()) {
  const q = getSearchQuery();
  if (matchesKeywords(q)) {
    redirectToBlock(`Blocked search query: "${q}"`);
  }
} else {
  // Normal sites: keyword-based block (quick)
  const url = location.href;
  if (matchesKeywords(url)) {
    redirectToBlock("This page matches restricted keywords.");
  } else {
    // Late check for title/body on normal sites
    window.addEventListener("DOMContentLoaded", () => {
      const title = document.title || "";
      const bodyText = document.body?.innerText?.slice(0, 4000) ?? "";
      if (matchesKeywords(title) || matchesKeywords(bodyText)) {
        redirectToBlock("This page looks like restricted content.");
      }
    });
  }
}
