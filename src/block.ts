// block.ts
const params = new URLSearchParams(location.search);

const reason = params.get("reason") || "This page was blocked.";
const url = params.get("url") || "";

const reasonEl = document.getElementById("reason");
const urlEl = document.getElementById("url");

if (reasonEl) reasonEl.textContent = reason;
if (urlEl) urlEl.textContent = url;
