/* Shared logic for popup.html and options.html */
(function () {
  const DEFAULTS = { enabled: true, mode: 'both', autoResume: true, pauseOnTyping: false };
  const enabledEl = document.getElementById('enabled');
  const autoResumeEl = document.getElementById('autoResume');
  const pauseOnTypingEl = document.getElementById('pauseOnTyping');
  const modeEls = Array.from(document.querySelectorAll('input[name="mode"]'));

  async function load() {
    try {
      const s = await browser.storage.local.get(DEFAULTS);
      enabledEl.checked = s.enabled !== false;
      autoResumeEl.checked = s.autoResume !== false;
      if (pauseOnTypingEl) pauseOnTypingEl.checked = s.pauseOnTyping === true;
      const mode = s.mode || 'both';
      modeEls.forEach((r) => { r.checked = r.value === mode; });
    } catch (e) {}
  }

  async function save(patch) {
    // storage.local.set merges top-level keys — no get-then-set round-trip.
    await browser.storage.local.set(patch);
  }

  enabledEl.addEventListener('change', () => save({ enabled: enabledEl.checked }));
  autoResumeEl.addEventListener('change', () => save({ autoResume: autoResumeEl.checked }));
  if (pauseOnTypingEl) pauseOnTypingEl.addEventListener('change', () => save({ pauseOnTyping: pauseOnTypingEl.checked }));
  modeEls.forEach((r) => r.addEventListener('change', () => {
    if (r.checked) save({ mode: r.value });
  }));

  // In-extension privacy panel (exists in popup.html and options.html).
  const privacyLink = document.getElementById('privacyLink');
  const privacyOverlay = document.getElementById('privacyOverlay');
  const privacyClose = document.getElementById('privacyClose');
  if (privacyLink && privacyOverlay) {
    privacyLink.addEventListener('click', (e) => {
      e.preventDefault();
      privacyOverlay.hidden = false;
    });
  }
  if (privacyClose && privacyOverlay) {
    privacyClose.addEventListener('click', () => {
      privacyOverlay.hidden = true;
    });
  }

  load();
})();
