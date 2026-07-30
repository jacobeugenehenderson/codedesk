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

**Two stylesheets are vendored.** `assets/ascend.css` and
`assets/ascend-apps.css` were the portal's, loaded over an absolute
`/ascend-portal/assets/` path — the one thing that made Codedesk unable to run
anywhere else. They are copied whole rather than subset, because a subset risks
silently dropping a rule and the pair is only 69 KB. `assets/qr-auth.png` came
with them; `ascend.css` references it relatively, so it has to sit alongside.

If the portal's stylesheets change, these do not. That is the intended
trade — this copy is now Codedesk's own.

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
