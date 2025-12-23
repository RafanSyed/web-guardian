"use strict";
// content.ts — Web Guardian
// Blocks manga/anime/webtoon searches + pages using normalization (bypass-resistant)
// Strategy:
// 1) For Google/Bing searches: redirect immediately to block page if query matches
// 2) For normal pages: quick URL check, then DOMContentLoaded check for title/body snippet
// Notes: No proxy, no DNS, no network interception.
const BLOCK_PATTERNS = [
    // Core content roots
    "manga",
    "manhwa",
    "manhua",
    "webtoon",
    "anime",
    "doujin",
    "doujinshi",
    "scanlat", // catches scanlation/scanlator
    "scan", // generic, but paired with other patterns in practice
    "scans",
    "adult",
    "raw",
    "dubbed",
    "subbed",
    "subtitled",
    "dub",
    "sub",
    "subtitles",
    "dubs",
    "subs",
    "dubbing",
    "subbing",
    "dubbed",
    "subbed",
    "dubbing",
    // Reading/consumption intent
    "readmanga",
    "readmanhwa",
    "readmanhua",
    "readwebtoon",
    "readonline",
    "freechapter",
    "chapter",
    "chapters",
    "rawchapter",
    "rawchapters",
    "mangaread",
    "manhwaread",
    "webtoonread",
    // Explicit indicators (kept non-graphic / category-like)
    "nsfw",
    "hentai",
    "ecchi",
    "adultcomic",
    "18plus",
    "r18"
];
// Optional: if you want fewer false-positives on academic definitions,
// enable "gating" (requires BOTH a content root + an intent word).
// Set to false to be strict (block on any match).
const USE_GATING = false;
const CONTENT_ROOTS = ["manga", "manhwa", "manhua", "webtoon", "anime", "doujin", "doujinshi"];
const INTENT_WORDS = ["read", "chapter", "chapters", "online", "free", "raw", "scan", "scans", "translated"];
// ---------- Helpers ----------
function normalize(text) {
    return text
        .toLowerCase()
        // normalize unicode (ｅ → e)
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        // remove all non-letters/numbers (kills spaces/punct)
        .replace(/[^a-z0-9]/g, "")
        // common leetspeak swaps
        .replace(/0/g, "o")
        .replace(/1/g, "i")
        .replace(/3/g, "e")
        .replace(/4/g, "a")
        .replace(/5/g, "s")
        .replace(/7/g, "t");
}
function escapeHtml(s) {
    return s.replace(/[&<>"']/g, (c) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    }[c]));
}
function redirectToBlock(reason) {
    const url = encodeURIComponent(location.href);
    const r = encodeURIComponent(reason);
    const blockUrl = chrome.runtime.getURL(`block.html?reason=${r}&url=${url}`);
    // replace prevents weird back/forward loops on some pages
    location.replace(blockUrl);
}
function isGoogleSearch() {
    return location.hostname.includes("google.") && location.pathname === "/search";
}
function isBingSearch() {
    return location.hostname.includes("bing.com") && location.pathname === "/search";
}
function getSearchQueryParam() {
    try {
        const u = new URL(location.href);
        return u.searchParams.get("q") ?? "";
    }
    catch {
        return "";
    }
}
function matchesBlockedContent(text) {
    const t = normalize(text);
    if (!USE_GATING) {
        return BLOCK_PATTERNS.some((p) => t.includes(normalize(p)));
    }
    // Gated mode: require at least one root AND one intent word
    const hasRoot = CONTENT_ROOTS.some((r) => t.includes(normalize(r)));
    const hasIntent = INTENT_WORDS.some((w) => t.includes(normalize(w)));
    return hasRoot && hasIntent;
}
// ---------- Main logic ----------
// 1) Search pages: block cleanly by redirect (prevents broken UI)
if (isGoogleSearch() || isBingSearch()) {
    const q = getSearchQueryParam();
    if (q && matchesBlockedContent(q)) {
        redirectToBlock(`Blocked search query: "${escapeHtml(q)}"`);
    }
}
else {
    // 2) Normal pages: quick URL check (fast)
    const url = location.href;
    if (matchesBlockedContent(url)) {
        redirectToBlock("This page matches restricted keywords (URL).");
    }
    else {
        // 3) Later check: title + small body snippet
        window.addEventListener("DOMContentLoaded", () => {
            const title = document.title || "";
            // innerText can be expensive on huge pages; keep it small
            const bodyText = document.body?.innerText?.slice(0, 4000) ?? "";
            // Also check meta description if present
            const metaDesc = document.querySelector('meta[name="description"]')?.content ?? "";
            const combined = `${title}\n${metaDesc}\n${bodyText}`;
            if (matchesBlockedContent(combined)) {
                redirectToBlock("This page looks like restricted content (title/body).");
            }
        });
    }
}
