/* PauseSpring content script: pauses <video> / <audio> on demand from background.
 * Optimized: settings are cached once (no storage I/O per event), the
 * MutationObserver only runs while the page is hidden, and all hot-path
 * checks are synchronous. */
(function () {
  // Track elements we paused so auto-resume can restore only those.
  const pausedByUs = new Set();

  // Single settings cache — loaded once, kept fresh via onChanged.
  // This avoids a storage (disk/IPC) read on every keystroke, mutation
  // batch, or visibility event.
  const cfg = { enabled: true, mode: 'both', autoResume: true, pauseOnTyping: false };
  browser.storage.local.get(cfg).then((s) => {
    Object.assign(cfg, s);
    updateObserver();
  });
  if (browser.storage && browser.storage.onChanged) {
    browser.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local') return;
      let relevant = false;
      for (const k of ['enabled', 'mode', 'autoResume', 'pauseOnTyping']) {
        if (changes[k]) {
          cfg[k] = changes[k].newValue;
          relevant = true;
        }
      }
      if (relevant) updateObserver();
    });
  }

  function getMediaElements() {
    return document.querySelectorAll('video, audio');
  }

  function pauseAll() {
    const media = getMediaElements();
    for (const el of media) {
      try {
        if (!el.paused) {
          el.pause();
          pausedByUs.add(el);
        }
      } catch (e) {}
    }
  }

  function resumeOurs() {
    if (!cfg.enabled || !cfg.autoResume || pausedByUs.size === 0) return;
    for (const el of pausedByUs) {
      try {
        if (!el.isConnected || !el.paused) {
          pausedByUs.delete(el);
          continue;
        }
        const p = el.play();
        if (p && typeof p.then === 'function') {
          p.then(
            () => pausedByUs.delete(el),
            () => {
              // Autoplay blocked — keep in set so next focus/visible retries.
            }
          );
        } else {
          pausedByUs.delete(el);
        }
      } catch (e) {}
    }
  }

  // Listen for background commands (authoritative tab/window detection).
  browser.runtime.onMessage.addListener((msg) => {
    if (!msg || !msg.type) return;
    if (msg.type === 'AUTOPAUSE_PAUSE') {
      clearTypingResumeTimer();
      pauseAll();
    } else if (msg.type === 'AUTOPAUSE_RESUME') {
      resumeOurs();
    }
  });

  // Fallback / safety net for 'both' mode: if page becomes hidden
  // (tab switch, minimize) pause immediately even if background missed it.
  // Modes 'tab-only' / 'window-only' are handled strictly by background
  // to avoid pausing on the wrong kind of switch, so we only self-pause here
  // when mode === 'both'.
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      // Became visible again (tab switch back, minimize restore) → resume
      resumeOurs();
    } else {
      clearTypingResumeTimer();
      if (cfg.enabled && cfg.mode === 'both') pauseAll();
    }
    updateObserver();
  });

  // Window focus return (Alt-Tab back to Firefox): document may never have
  // become hidden, so visibilitychange won't fire — resume on focus instead.
  window.addEventListener('focus', () => {
    resumeOurs();
  });

  /* ---------- PAUSE WHEN TYPING ---------- */
  function isEditableTarget(target) {
    if (!target || target.nodeType !== 1) return false;
    const tag = target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
      return !target.readOnly && !target.disabled;
    }
    if (target.isContentEditable) return true;
    if (target.closest) {
      return !!target.closest('[contenteditable="true"], [role="textbox"], [role="searchbox"]');
    }
    return false;
  }

  let lastTypingPause = 0;
  let lastTypingNotify = 0;
  let typingResumeTimer = null;
  const TYPING_RESUME_DELAY_MS = 500;
  const TYPING_NOTIFY_COOLDOWN_MS = 5000;

  function clearTypingResumeTimer() {
    if (typingResumeTimer !== null) {
      clearTimeout(typingResumeTimer);
      typingResumeTimer = null;
    }
  }

  function scheduleTypingResume() {
    // Resume shortly after the user stops typing.
    clearTypingResumeTimer();
    typingResumeTimer = setTimeout(() => {
      typingResumeTimer = null;
      if (document.hidden) return;
      resumeOurs();
    }, TYPING_RESUME_DELAY_MS);
  }

  window.addEventListener(
    'keydown',
    (e) => {
      if (!cfg.enabled || !cfg.pauseOnTyping) return;
      if (e.isComposing) return;
      // Ignore shortcuts (Ctrl/⌘/Alt combos) and non-text keys.
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const isTextKey = e.key.length === 1 || e.key === 'Backspace' || e.key === 'Delete';
      if (!isTextKey) return;
      // Only when typing text — not spacebar-play, arrows, 'f' fullscreen, etc.
      if (!isEditableTarget(e.target)) return;
      // Every keystroke restarts the "stopped typing" idle countdown.
      scheduleTypingResume();
      // Cooldowns so holding a key doesn't spam pause work or messages.
      const now = Date.now();
      if (now - lastTypingPause >= 1500) {
        lastTypingPause = now;
        pauseAll();
      }
      if (now - lastTypingNotify >= TYPING_NOTIFY_COOLDOWN_MS) {
        lastTypingNotify = now;
        try {
          browser.runtime.sendMessage({ type: 'AUTOPAUSE_TYPING' });
        } catch (err) {}
      }
    },
    true
  );

  // Catch autoplayed media added dynamically (YouTube SPA, etc.):
  // if a new playing element appears while page is hidden and mode is 'both', pause it.
  // The observer is only connected while hidden — zero cost on visible pages.
  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      const added = m.addedNodes;
      for (let i = 0; i < added.length; i++) {
        const node = added[i];
        if (node.nodeType !== 1) continue;
        let els;
        if (node.matches && node.matches('video, audio')) {
          pauseNode(node);
          continue;
        }
        if (node.querySelectorAll) {
          els = node.querySelectorAll('video, audio');
          for (const el of els) pauseNode(el);
        }
      }
    }
  });

  function pauseNode(el) {
    try {
      if (!el.paused) {
        el.pause();
        pausedByUs.add(el);
      } else if (el.autoplay) {
        pausedByUs.add(el);
      }
    } catch (e) {}
  }

  function updateObserver() {
    try {
      observer.disconnect();
      if (document.hidden && cfg.enabled && cfg.mode === 'both') {
        observer.observe(document.documentElement || document, {
          childList: true,
          subtree: true
        });
      }
    } catch (e) {}
  }

  updateObserver();

  // If user manually plays, forget that element (don't auto-resume it later unexpectedly).
  // Note: 'play' only fires when playback actually starts, so a blocked
  // auto-resume play() stays in the set and retries on the next trigger.
  document.addEventListener(
    'play',
    (e) => {
      const el = e.target;
      if (el && (el.tagName === 'VIDEO' || el.tagName === 'AUDIO')) {
        pausedByUs.delete(el);
      }
    },
    true
  );
})();
