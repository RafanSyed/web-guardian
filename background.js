"use strict";
const SAFE_CACHE = new Set();
const BLOCKED_CACHE = new Set();
chrome.webNavigation.onBeforeNavigate.addListener(async (details) => {
    if (!details.url.startsWith("http"))
        return;
    const domain = new URL(details.url).hostname;
    if (BLOCKED_CACHE.has(domain)) {
        chrome.tabs.update(details.tabId, {
            url: chrome.runtime.getURL("block.html")
        });
        return;
    }
    if (SAFE_CACHE.has(domain)) {
        return;
    }
    // TEMP: keyword heuristic (fast, free)
    if (looksLikeManga(domain)) {
        BLOCKED_CACHE.add(domain);
        chrome.tabs.update(details.tabId, {
            url: chrome.runtime.getURL("block.html")
        });
        return;
    }
    // TODO: AI check (later)
});
function looksLikeManga(domain) {
    return [
        "manga",
        "manhwa",
        "webtoon",
        "scan",
        "raw",
        "anime"
    ].some(k => domain.includes(k));
}
