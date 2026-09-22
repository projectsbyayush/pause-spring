# Privacy Policy — PauseSpring

**Last updated:** September 22, 2026

## Short version

PauseSpring collects **nothing**. No accounts, no analytics, no tracking, no network requests. Everything happens inside your browser.

## What the extension does with data

- **Settings only.** Your 4 preferences (enabled, pause mode, auto-resume, pause-when-typing) are saved with `browser.storage.local` — on your device, never sent anywhere.
- **Video control only.** The extension pauses and resumes `<video>`/`<audio>` elements in your tabs. It never reads, records, or transmits page content, keystrokes, browsing history, or any personal information.
- **Typing detection is local.** When "Pause when I type" is on, keystrokes in text fields are observed only to trigger a pause, processed in memory, and immediately discarded.

## Permissions — why each is needed

| Permission | Use |
|---|---|
| `tabs` | Detect tab switches; find audible/active tabs |
| `storage` | Save your settings locally |
| `<all_urls>` | Run the pauser on whichever site you watch video on, including embeds |

## Third parties

There are none. PauseSpring talks to no servers and bundles no third-party code.

## Contact

Questions about privacy: [open an issue](https://github.com/projectsbyayush/pause-spring/issues).

## Changes

If this policy ever changes, the update will be noted here and in the release notes.
