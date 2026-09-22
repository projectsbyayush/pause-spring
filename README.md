# 🌱 PauseSpring

**Never miss a moment of your video again.**

PauseSpring automatically pauses your videos when you switch tabs, jump to another app, or start typing — and plays them again the moment you come back. Made for **Firefox** and **Zen Browser**.

![Zen Browser](https://img.shields.io/badge/Zen%20Browser-compatible-739080)
![Firefox](https://img.shields.io/badge/Firefox-109%2B-ff7139)
![License](https://img.shields.io/badge/license-MIT-739080)

## Why you'll love it

- 📺 **You switch tabs mid-video** → it pauses. You come back → it resumes. Magic.
- 💬 **You start typing a reply or comment** → it pauses so you don't miss anything. Stop typing → it resumes in half a second.
- 🛑 **Videos you paused yourself stay paused.** PauseSpring only resumes what *it* paused — never overrides you.
- 🎬 **Works everywhere you watch** — YouTube, Twitch, Netflix, and any other site with video or audio.
- 🔒 **Private by design** — no accounts, no tracking, nothing leaves your browser.

## Get it (1 minute)

**Firefox / Zen Browser:**

1. Download the latest `.zip` from [**Releases**](https://github.com/projectsbyayush/pause-spring/releases) *(coming soon — or install temporarily below)*
2. Temporary install: open `about:debugging#/runtime/this-firefox` → **Load Temporary Add-on…** → pick `manifest.json`
3. Pin the 🌱 icon to your toolbar — done!

## How to use

Click the 🌱 toolbar icon. That's it — it works out of the box with sensible defaults:

| Setting | What it does |
|---|---|
| **Enable** | Master on/off switch |
| **Pause when: Tab + Window** | Pause when switching tabs *or* apps (recommended) |
| **Pause when: Tab only** | Pause only when switching tabs |
| **Pause when: Window only** | Pause only when leaving the browser window |
| **Auto-resume on return** | Replay when you come back (ON by default) |
| **Pause when I type** | Pause while you're typing in search boxes, comments, chat (OFF by default — turn it on if you want it) |

## FAQ

**Does it work on YouTube / Netflix / Twitch?**
Yes — any site that plays video or audio, including embedded players.

**It paused my video but didn't resume. Why?**
Two possibilities: (1) Auto-resume is turned off in settings, or (2) you had paused the video yourself before switching away — PauseSpring respects that and leaves it paused.

**It doesn't pause when I type in the address bar or another app.**
Correct — browsers don't let extensions see keystrokes outside web pages (that's a privacy protection). Typing inside pages (comments, search, docs, chat) works.

**Does it slow down my browser?**
No. It's dependency-free, caches your settings, and does zero work on pages you're actively watching.

**Is my data collected?**
No. No accounts, no analytics, no network requests. Your settings never leave your device.

## Having a problem or an idea?

[Open an issue](https://github.com/projectsbyayush/pause-spring/issues) — tell me the site, what you expected, and what happened.

---

<details>
<summary><strong>🛠 For developers</strong> (click to expand)</summary>

### Structure

```
pause-spring/
├── manifest.json   — MV2 manifest (gecko id: pausespring@projectsbyayush)
├── background.js   — tab / window / typing orchestration
├── content.js      — video pausing, resume, typing detection
├── popup.html / popup.css / popup.js — toolbar UI (shared with options page)
├── options.html    — settings page
└── icons/          — icon.png (master), icon-48/96.png (extension)
```

### How it works

```
tab switch ──► tabs.onActivated ──────► pause previous tab
window/app ──► windows.onFocusChanged ─► pause old window's active tab
typing ──────► content keydown ────────► pause here + notify background ─► pause other tabs
return ──────► focus / visible / tab ──► resume videos paused by us
```

`background.js` owns tab/window detection (so `Tab only` vs `Window only` never misfires). `content.js` pauses all `<video>`/`<audio>`, remembers which ones it paused, and resumes only those. Settings live in `browser.storage.local`.

### Permissions

| Permission | Why |
|---|---|
| `tabs` | Detect tab switches, find audible/active tabs |
| `storage` | Save settings locally |
| `<all_urls>` | Run the pauser on every site (incl. iframes) |

### Dev loop

```powershell
# temporary load, then hit Reload in about:debugging after edits
# pack for AMO:
Compress-Archive -Path manifest.json,background.js,content.js,popup.html,popup.css,popup.js,options.html,icons -DestinationPath pause-spring-1.0.zip
```

### Changelog

- **1.0** — Initial release: tab/window auto-pause with mode selector, auto-resume, pause-when-I-type, minimal forest+sage UI, in-extension privacy policy

PRs welcome — keep it dependency-free and privacy-respecting.

</details>

## 📄 License

[MIT](LICENSE) © projectsbyayush
