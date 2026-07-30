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

**The shape tokens are declared here now.** `--shape-corner-md`, `-sm` and
`-full` were referenced throughout but never defined — only `-lg` was — which is
why every control on the page rendered square despite carrying `rounded-md`.
`border-radius: var(--shape-corner-md)` with no fallback outranks `.rounded-md`
on specificity, and *then* the undefined var makes the declaration invalid at
computed-value time, resetting the radius to its initial `0`. The utility never
applies and the rule that beat it paints nothing. Worth remembering: an
undefined custom property does not fall through to the next rule, it wins and
then evaporates.

Related, same era: two element-level rules pin form controls to about 28px while
their padding and line-height need about 36, so fields clipped the bottom of
their own text. That height is a floor now, not a ceiling.

## Two modes

`?mode=embed` is a different product from the same code. Normal use is the
Drive-backed tool: name a working file, press Enter, the workspace unlocks, ✨
writes the file. Framed, none of that exists — sync is off and ✨ downloads a
PNG — so the embed drops the ceremony and opens on a finished code instead.

| | Normal | `?mode=embed` |
|---|---|---|
| Filename ceremony | names a working file, gates the drawers | none — the gate is pre-satisfied |
| Header | wordmark + type select | hidden; the select moves into **Code** |
| Drawers | Caption · Design · Mechanicals · Create working file | **Code** · Design · Download PNG |
| Opens on | everything closed, locked | **Code** open, URL and caption filled |

**The embed is not a stripped-down build.** Every type is still available and
nothing is deleted — the UTM parameters fold into an *Advanced* disclosure, and
the caption Body field is hidden rather than removed, because `render()` reads
`val('captionBody')`.

Two rules keep this maintainable:

**Presentation lives in the stylesheet**, under `body.codedesk-embed-mode`.
Setting `.style.display` from script is an inline style by another name and is
invisible to anyone reading the CSS. JavaScript does only what CSS cannot
express: moving nodes between parents, and seeding values.

**The gate is satisfied, not bypassed.** `qr_app-bootstrapper.js` sets the same
two flags a genuine return-visit sets, before `qr_sync_pipeline.js` wires the
gate, so the existing already-accepted path unlocks, renders and wires the
accordion. One unlock path in the codebase rather than a second to keep in step.

Traps, each of which was a real bug here:

- **`.topctl--chev` draws its chevron with `::after`, and a `<select>` renders
  pseudo-elements inconsistently.** It painted on top of the `background-image`
  chevron: two arrows and overlapping text. Selects get one chevron, from
  `background-image`.
- **The accordion ignores clicks while the stepper is locked**, and boot order
  does not guarantee the unlock has landed. Opening a drawer on load must
  confirm the panel actually opened rather than assume the click took.
- **`#detailsPanel` is emptied and rebuilt on every type change.** Anything
  parked inside it — the caption field, the Advanced box — disappears the first
  time someone picks WiFi. Both live outside it; Advanced is rebuilt per render.
- **`summary { display: flex }` breaks `<details>` in Safari** while looking
  correct in Chrome. The Advanced disclosure swaps its marker, never its
  display.

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
