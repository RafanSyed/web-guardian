import { normalizeDomain, getDomainStatus, setDomainStatus, DomainDB } from "./domainDB";

function showToast(message: string) {
  const toast = document.getElementById("toast")!;
  toast.textContent = message;
  toast.style.display = "block";
  setTimeout(() => { toast.style.display = "none"; }, 2500);
}

async function getCurrentTab(): Promise<chrome.tabs.Tab | null> {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs[0] ?? null;
}

async function loadStats() {
  const result = await chrome.storage.local.get("domainDB");
  const db = (result.domainDB || {}) as DomainDB;
  const entries = Object.values(db);
  const blocked = entries.filter(v => v === "BLOCK").length;

  document.getElementById("blocked-count")!.textContent = String(blocked);
  document.getElementById("total-count")!.textContent = String(entries.length);
}

async function init() {
  const tab = await getCurrentTab();
  const domainEl = document.getElementById("current-domain")!;
  const statusEl = document.getElementById("current-status")!;
  const blockBtn = document.getElementById("btn-block-site") as HTMLButtonElement;

  if (!tab?.url) {
    domainEl.textContent = "No active tab";
    blockBtn.disabled = true;
    blockBtn.className = "btn btn-disabled";
    return;
  }

  const domain = normalizeDomain(tab.url);

  if (!domain) {
    domainEl.textContent = "Cannot detect domain";
    blockBtn.disabled = true;
    blockBtn.className = "btn btn-disabled";
    return;
  }

  domainEl.textContent = domain;

  // Show current cached status
  const status = await getDomainStatus(domain);
  if (status === "BLOCK") {
    statusEl.innerHTML = `<span class="status-badge status-block">🚫 Already Blocked</span>`;
    // Already blocked — disable button
    blockBtn.disabled = true;
    blockBtn.className = "btn btn-disabled";
    blockBtn.textContent = "🚫 Already Blocked";
  } else {
    statusEl.innerHTML = `<span class="status-badge status-unknown">❓ Not blocked</span>`;
  }

  // Block this site button
  blockBtn.addEventListener("click", async () => {
    const confirmed = confirm(`Block "${domain}"?\n\nThis will permanently cache it as blocked.`);
    if (!confirmed) return;

    await setDomainStatus(domain, "BLOCK");
    statusEl.innerHTML = `<span class="status-badge status-block">🚫 Blocked</span>`;
    blockBtn.disabled = true;
    blockBtn.className = "btn btn-disabled";
    blockBtn.textContent = "🚫 Already Blocked";
    showToast(`"${domain}" has been blocked`);
    await loadStats();

    // Redirect current tab to block page immediately
    if (tab.id) {
      const blockUrl = chrome.runtime.getURL(
        `block.html?reason=${encodeURIComponent("Manually blocked via Web Guardian")}&url=${encodeURIComponent(tab.url!)}`
      );
      chrome.tabs.update(tab.id, { url: blockUrl });
    }
  });

  await loadStats();
}

init();