# Codedesk

A QR code design tool. Static HTML, CSS and JavaScript — no build step. Open
`index.html`, or serve the directory:

```
python3 -m http.server 8788 --bind 127.0.0.1
```

It is embedded live on **jacobhenderson.studio** as the QR engine piece, which
is the reason it reports its own height (see below).

---

## Where this came from

Codedesk was extracted from `ascend-portal` in July 2026, with history:
`git filter-repo --path codedesk/ --path-rename codedesk/:`. The 304 commits
that touch Codedesk are all here and the paths are rewritten, so the lineage
reads correctly from the root.

The original repo is unchanged at
`git@github.com:jacobeugenehenderson/ascend-portal.git`, and still serves the
portal. Nothing here pushes back to it.

**There is one stylesheet.** `styles/theme.css` — everything, in cascade order:
the portal's `ascend.css`, then its `ascend-apps.css`, then Codedesk's own
theme, which is where it always sat. The first two were loaded over an absolute
`/ascend-portal/assets/` path, and were the one thing stopping Codedesk running
anywhere else. They are folded in whole rather than subset, because a subset
risks silently dropping a rule that only applies in a state nobody thought to
test. `assets/qr-auth.png` came with them, and the `url()` reaching for it was
rewritten to `../assets/` when those rules moved from `assets/` into `styles/`.

Verified by rendering the pre-merge commit and the merged one side by side
under a single origin and diffing computed styles: **851 shared elements, zero
differences**, and 499 rules parsed against 175 + 99 + 225 before. The only DOM
difference is the two `<link>` tags that no longer exist.

If the portal's stylesheets change, this does not. That is the intended trade —
this is Codedesk's own CSS now.

## Embedding

`embed-height.js` is loaded last and reports
`document.documentElement.scrollHeight` to the parent frame on a
`ResizeObserver`. It does nothing when the page is not framed, so it is safe to
ship unconditionally. The embedding page decides whether to trust the message.

It is the same file in every embedded product — **do not fork it.** The
canonical copy is `docs/embed-height.js` in the jacobhenderson.studio repo.

## Still tethered

Portability here means *independent of ascend-portal*, which is done. Codedesk
still reaches the network at runtime for things that were never part of the
portal:

| Dependency | Used for |
|---|---|
| `cdn.tailwindcss.com` | The whole layout. This is the JIT build, compiled in the browser. |
| `fonts.googleapis.com` | Display faces. |
| `cdn.jsdelivr.net` — `emoji-picker-element` | The emoji picker. |
| `cdnjs.cloudflare.com` — `qrcodejs` | Fallback; `vendor/qrcode.min.js` is local. |
| `script.google.com/macros/…` | An Apps Script endpoint. A real backend. |

None of these block extraction and none were touched. Worth knowing before
anyone calls this offline-capable, and worth revisiting if it should be.
