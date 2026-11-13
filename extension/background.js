// Dark Mode Exceptions — background service worker.
//
// The list of excluded hostnames lives in chrome.storage.sync under "sites".
// A single dynamically registered content script injects optout.css into
// every page on those hosts at document_start, before the first paint.

const SCRIPT_ID = 'dark-mode-optout';
const STORAGE_KEY = 'sites';

// ---------- storage ----------

async function getSites() {
  const data = await chrome.storage.sync.get(STORAGE_KEY);
  return Array.isArray(data[STORAGE_KEY]) ? data[STORAGE_KEY] : [];
}

async function setSites(sites) {
  const unique = [...new Set(sites)].sort();
  await chrome.storage.sync.set({ [STORAGE_KEY]: unique });
  await syncContentScript();
  return unique;
}

// ---------- helpers ----------

function hostFromUrl(url) {
  try {
    const u = new URL(url);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    return u.hostname || null;
  } catch {
    return null;
  }
}

// Match patterns ignore ports, so "localhost" covers every localhost port.
function matchPatterns(host) {
  return [`*://${host}/*`];
}

// Serialize registration updates so rapid clicks can't race each other.
let syncQueue = Promise.resolve();

function syncContentScript() {
  syncQueue = syncQueue.then(doSync, doSync);
  return syncQueue;
}

async function doSync() {
  const sites = await getSites();
  const existing = await chrome.scripting.getRegisteredContentScripts({ ids: [SCRIPT_ID] });
  if (existing.length) {
    await chrome.scripting.unregisterContentScripts({ ids: [SCRIPT_ID] });
  }
  if (sites.length) {
    await chrome.scripting.registerContentScripts([{
      id: SCRIPT_ID,
      matches: sites.flatMap(matchPatterns),
      css: ['optout.css'],
      runAt: 'document_start',
      allFrames: true,
      persistAcrossSessions: true,
    }]);
  }
}

// ---------- toolbar badge ----------

async function updateTab(tab, sites) {
  if (!tab || tab.id === undefined) return;
  const host = hostFromUrl(tab.url || '');
  sites = sites || (await getSites());

  if (!host) {
    await chrome.action.disable(tab.id);
    await chrome.action.setBadgeText({ tabId: tab.id, text: '' });
    await chrome.action.setTitle({ tabId: tab.id, title: 'Not available on this page' });
    return;
  }

  await chrome.action.enable(tab.id);
  const excluded = sites.includes(host);
  await chrome.action.setBadgeText({ tabId: tab.id, text: excluded ? 'OFF' : '' });
  await chrome.action.setBadgeBackgroundColor({ tabId: tab.id, color: '#d93025' });
  await chrome.action.setTitle({
    tabId: tab.id,
    title: excluded
      ? `Auto dark mode is OFF on ${host} — click to turn it back on`
      : `Turn off auto dark mode on ${host}`,
  });
}

async function updateAllTabs() {
  const [tabs, sites] = await Promise.all([chrome.tabs.query({}), getSites()]);
  await Promise.all(tabs.map((t) => updateTab(t, sites).catch(() => {})));
}

// Reload every open tab on the given hosts so the change takes effect.
async function reloadHosts(hosts) {
  const set = new Set(hosts);
  const tabs = await chrome.tabs.query({});
  for (const t of tabs) {
    const h = hostFromUrl(t.url || '');
    if (h && set.has(h)) chrome.tabs.reload(t.id).catch(() => {});
  }
}

// ---------- events ----------

chrome.action.onClicked.addListener(async (tab) => {
  const host = hostFromUrl(tab.url || '');
  if (!host) return;
  const sites = await getSites();
  const next = sites.includes(host) ? sites.filter((s) => s !== host) : [...sites, host];
  await setSites(next);
  await reloadHosts([host]);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url || changeInfo.status === 'loading') {
    updateTab(tab).catch(() => {});
  }
});

chrome.tabs.onActivated.addListener(({ tabId }) => {
  chrome.tabs.get(tabId).then((t) => updateTab(t)).catch(() => {});
});

// Covers edits from the options page and from other synced devices.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'sync' && changes[STORAGE_KEY]) {
    syncContentScript().then(updateAllTabs).catch(console.error);
  }
});

chrome.runtime.onInstalled.addListener(() => {
  syncContentScript().then(updateAllTabs).catch(console.error);
});

chrome.runtime.onStartup.addListener(() => {
  syncContentScript().then(updateAllTabs).catch(console.error);
});

// Messages from the options page.
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    if (msg?.type === 'getSites') return getSites();
    if (msg?.type === 'removeSite') {
      const next = await setSites((await getSites()).filter((s) => s !== msg.host));
      await reloadHosts([msg.host]);
      return next;
    }
    if (msg?.type === 'addSite') {
      const host = String(msg.host || '').trim().toLowerCase();
      if (!host) return getSites();
      const next = await setSites([...(await getSites()), host]);
      await reloadHosts([host]);
      return next;
    }
    return null;
  })().then(sendResponse, (e) => sendResponse({ error: String(e) }));
  return true; // async response
});
