/* Background script for PauseSpring (Firefox / Zen Browser, MV2) */

const DEFAULT_SETTINGS = {
  enabled: true,
  // 'both' | 'tab' | 'window'
  mode: 'both',
  autoResume: true,
  pauseOnTyping: false
};

let settings = { ...DEFAULT_SETTINGS };

// Load settings at startup
browser.storage.local.get(DEFAULT_SETTINGS).then((stored) => {
  settings = { ...DEFAULT_SETTINGS, ...stored };
});

browser.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  if (changes.enabled) settings.enabled = changes.enabled.newValue;
  if (changes.mode) settings.mode = changes.mode.newValue;
  if (changes.autoResume) settings.autoResume = changes.autoResume.newValue;
  if (changes.pauseOnTyping) settings.pauseOnTyping = changes.pauseOnTyping.newValue;
});

function modeIncludesTab() {
  return settings.mode === 'tab' || settings.mode === 'both';
}

function modeIncludesWindow() {
  return settings.mode === 'window' || settings.mode === 'both';
}

async function sendPause(tabId) {
  try {
    await browser.tabs.sendMessage(tabId, { type: 'AUTOPAUSE_PAUSE' });
  } catch (e) {
    // Tab may not have content script (about:, addons, etc.) — ignore.
  }
}

async function sendResume(tabId) {
  try {
    await browser.tabs.sendMessage(tabId, { type: 'AUTOPAUSE_RESUME' });
  } catch (e) {
    // ignore
  }
}

// Single IPC: messaging a discarded/gone tab just fails silently (caught
// in sendPause), so no extra tabs.get round-trip needed.
function pauseTab(tabId) {
  if (!settings.enabled) return;
  if (tabId == null || tabId < 0) return;
  sendPause(tabId);
}

/* ---------- TAB SWITCH DETECTION ---------- */
// Fires when active tab changes within a window.
browser.tabs.onActivated.addListener(async (activeInfo) => {
  if (!settings.enabled) return;

  // Resume the newly-activated tab if autoResume is on
  if (settings.autoResume) {
    sendResume(activeInfo.tabId);
  }

  if (!modeIncludesTab()) return;

  // Firefox provides previousTabId; fall back gracefully if missing.
  const prevTabId = activeInfo.previousTabId;
  if (typeof prevTabId === 'number' && prevTabId >= 0) {
    pauseTab(prevTabId);
  } else {
    // Fallback: we can't know previous tab reliably here, so pause all
    // non-active audible tabs in this window (cheap + safe).
    try {
      const tabs = await browser.tabs.query({ windowId: activeInfo.windowId });
      for (const t of tabs) {
        if (t.id !== activeInfo.tabId && t.audible && !t.discarded) {
          sendPause(t.id);
        }
      }
    } catch (e) {}
  }
});

/* ---------- WINDOW SWITCH DETECTION ---------- */
let lastFocusedWindowId = null;

// Initialise lastFocusedWindowId
browser.windows.getLastFocused().then(
  (w) => { lastFocusedWindowId = w.id; },
  () => {}
);

browser.windows.onFocusChanged.addListener(async (newWindowId) => {
  if (!settings.enabled) return;

  const oldWindowId = lastFocusedWindowId;
  lastFocusedWindowId = newWindowId === browser.windows.WINDOW_ID_NONE ? lastFocusedWindowId : newWindowId;

  // Auto-resume: when coming back to a Firefox window, resume its active tab
  if (settings.autoResume && newWindowId !== browser.windows.WINDOW_ID_NONE) {
    try {
      const [active] = await browser.tabs.query({ active: true, windowId: newWindowId });
      if (active && active.id != null) sendResume(active.id);
    } catch (e) {}
  }

  if (!modeIncludesWindow()) return;

  if (newWindowId === browser.windows.WINDOW_ID_NONE) {
    // Focus left Firefox entirely (Alt-Tab to another app, minimize, etc.)
    // Pause active tab in every window (covers the common case without
    // spamming every background tab).
    try {
      const tabs = await browser.tabs.query({ active: true });
      for (const t of tabs) {
        if (t.id != null && !t.discarded) sendPause(t.id);
      }
    } catch (e) {}
    return;
  }

  // Focus moved from one Firefox window to another.
  // Pause the active tab of the previously-focused window.
  if (oldWindowId != null && oldWindowId !== newWindowId) {
    try {
      const tabs = await browser.tabs.query({ active: true, windowId: oldWindowId });
      for (const t of tabs) {
        if (t.id != null && !t.discarded) sendPause(t.id);
      }
    } catch (e) {
      // old window may be closed — ignore
    }
  }
});

// Typing in one tab pauses videos in other tabs (content script notifies us).
// Same-tab videos are already paused locally by the content script itself.
browser.runtime.onMessage.addListener((msg, sender) => {
  if (!msg || msg.type !== 'AUTOPAUSE_TYPING') return;
  if (!settings.enabled || !settings.pauseOnTyping) return;
  const typingTabId = sender && sender.tab && sender.tab.id;
  (async () => {
    try {
      // Filtered queries instead of one full tab scan — far less data.
      const [audibleTabs, activeTabs] = await Promise.all([
        browser.tabs.query({ audible: true }),
        browser.tabs.query({ active: true })
      ]);
      const seen = new Set();
      for (const t of audibleTabs.concat(activeTabs)) {
        if (t.id == null || t.id === typingTabId || t.discarded || seen.has(t.id)) continue;
        seen.add(t.id);
        sendPause(t.id);
      }
    } catch (e) {}
  })();
});

// When a tab becomes audible while its window is not focused / tab not active,
// pause it immediately if relevant mode is on (catches background autoplay).
browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (!settings.enabled) return;
  if (!changeInfo.audible || changeInfo.audible === false) return;
  // tab started making sound
  (async () => {
    try {
      // If tab mode is on and this tab is not the active tab in its window → pause
      if (modeIncludesTab() && !tab.active) {
        sendPause(tabId);
        return;
      }
      // If window mode is on and this tab's window is not focused → pause
      if (modeIncludesWindow()) {
        const win = await browser.windows.get(tab.windowId);
        if (!win.focused && tab.audible) {
          sendPause(tabId);
        }
      }
    } catch (e) {}
  })();
});
