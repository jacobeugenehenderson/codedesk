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

## Payloads — two builders, and the SMS rules

⛔ **There are TWO functions that answer "what string does this QR encode?", and they
do not agree.** `buildText()` in `qr_ui_toolkit.js` uses cases keyed `URL` `EMAIL`
`PHONE` `SMS` `WIFI` `VCARD` `MAP`; the builder in `qr_sync_pipeline.js` uses `URL`
`Payment` `WiFi` `Contact` `Message` `Event` `Map`. **`qr_type_manifest.json` declares
the second set**, so the pipeline's cases are live and several of `buildText`'s are
**dead twins** — code that reads correctly and is never called.

⭐ **That is not academic; it is how the 2026-08-29 bug survived.** The dead `SMS`
twin built a correct `sms:` URI while the live `Message` case built a broken one, so
anyone grepping `sms:` found the good code first and concluded the tool was fine.
**Change one, change both, or delete the twin.**

### The SMS rules, each learned from a shipped defect

1. ⛔ **`?body=`, never `?&body=`.** RFC 5724 is `sms:<number>?body=<text>`. The stray
   ampersand made the query malformed, and a URI pasted into the number field came out
   as `sms:N?body=A?&body=B` — two bodies, and the phone takes the last one.
2. ⛔ **No placeholder fallbacks.** `val("smsNumber") || "5551234567"` and
   `val("smsText") || "Hello"` meant an **empty form produced a working QR** — one that
   scans, addresses a stranger's number and says Hello. A blank field must yield a
   blank payload so the preview is visibly empty rather than plausibly wrong.
3. ⛔ **UTM is for http(s) only.** `new URL()` parses `sms:`/`mailto:`/`tel:` perfectly
   well, so the UTM branch did **not** throw on them — it re-encoded the query and
   appended the param, putting `+` where the body's spaces were and `&utm_source=…`
   inside the message. Non-web schemes now drop the tag and say so.

⚠️ **`msgMode` (Personal / Resistbot) is read by NOTHING.** Grep it: neither builder
looks at it, so the choice changes no output. It is disabled and labelled "coming
soon" rather than removed, because the intent is wanted. Wire the builder and delete
the disabling block in `codedeskGroupAdvancedFields`.

⚠️ **`?body=` is the RFC and what Android needs; iOS historically accepted `&body=`.**
Re-test on a real handset of each kind after any change here — getting it wrong works
perfectly on the phone in your hand and fails on everyone else's.

## Verifying a code before it ships

⛔ **Do not judge a QR by looking at it. Decode it, and count how hard it was.**

Chrome has `BarcodeDetector` built in — load the PNG and run
`new BarcodeDetector({formats:['qr_code']}).detect(canvas)` across a sweep of scales
and binarisation thresholds. **The count is the scanning margin**, and it is the
property a QR loses silently:

| | payload | decoded |
|---|---|---|
| 2026-08-29, first attempt | 151 chars, default ECC | 1 of 24 variants, first success on the 6th |
| after shortening + higher ECC | 76 chars | **8 of 18, first success on the 1st (raw)** |

⭐ **Payload length is the budget.** Every character adds modules to the same square,
so each gets smaller, while a centre logo keeps occluding the same *area* and eats a
larger share of the error correction. A long friendly message can make a code a phone
reads at six inches and a laptop screen does not read at all.

⚠️ **Do not try to measure module pitch by run-lengths here.** The finders are
stylised — rounded rings with a dot — so the 1:1:3:1:1 ratio that method needs is
distorted, and an autocorrelation fallback returns its minimum lag. Both were tried
and both gave nonsense. The decode-variant count is the measurement that holds.

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
