/* ============================================================================
   codedesk-host.js — the contract between CodeDesk and the app that hosts it.

   WHAT IT IS
   A host (the Ward's QR Studio; any app that prints cards) frames CodeDesk and
   tells it the ONE address a card must encode. CodeDesk encodes that address,
   verbatim, and nothing else; the person designs the card around it; CodeDesk
   hands the finished design back. It stores nothing and holds no town's data.
   The full contract, with an example host, is README.md § "Hosts".

   OWNS
   - host mode: on only when the page is framed, in `?mode=embed`, AND told its
     host's origin with `?host=<origin>`. Without `?host=`, embed mode is exactly
     what it was (the portfolio frames it that way) — none of this runs.
   - the messages, all to and from that one origin (and the parent frame only):
       CodeDesk → host  { type: 'codedesk:ready', version }
       host → CodeDesk  { type: 'codedesk:init', address, caption? }
       CodeDesk → host  { type: 'codedesk:locked', address }         (init taken)
       CodeDesk → host  { type: 'codedesk:design', address, design, png }   (on ✨)
       CodeDesk → host  { type: 'codedesk:error', reason }
     plus embed-height.js's { type: 'embed-height', height } (unchanged; not forked).

   MUST NEVER
   - compute an address — from its own origin, a field, or anything else. The
     host computes it from the town's domain; a card printed from staging must
     still encode the town's real address.
   - alter the address: no UTM, no normalising. qr_ui_toolkit.js's buildText()
     returns window.CODEDESK_HOST_ADDRESS verbatim when it is set.
   - accept a message from anyone but the declared host, or send to anyone else.
   - truncate what it is given: an address that is not absolute http(s), or a
     caption longer than the headline field holds, is refused with a reason.
   ========================================================================= */

(function () {
  'use strict';

  var VERSION = (document.querySelector('meta[name="codedesk-version"]') || {}).content || 'unversioned';
  var qs = new URLSearchParams(window.location.search || '');
  var hostParam = (qs.get('host') || '').trim();

  if (window.parent === window || window.CODEDESK_EMBED_MODE !== true || !hostParam) return;

  var hostOrigin;
  try { hostOrigin = new URL(hostParam).origin; } catch (e) { hostOrigin = ''; }
  if (!hostOrigin || hostOrigin === 'null') {
    console.error('[codedesk-host] ⛔ ?host= is not an origin: ' + hostParam + ' — host mode is off');
    return;
  }

  // Declared before qr_sync_pipeline.js runs (script order in index.html): the pipeline
  // reads it to skip the portfolio's landing design and to deliver ✨ instead of downloading.
  window.CODEDESK_HOST = { origin: hostOrigin, version: VERSION };

  function send(msg) { window.parent.postMessage(msg, hostOrigin); }
  function refuse(reason) {
    console.error('[codedesk-host] ⛔ ' + reason);
    send({ type: 'codedesk:error', reason: reason });
  }

  var CAPTION_MAX = 20;   // #campaign's maxlength — read from the field when it exists

  function setField(node, value) {
    node.value = value;
    // The app listens for input; assigning .value alone would leave its state stale.
    node.dispatchEvent(new Event('input', { bubbles: true }));
    node.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function take(msg) {
    var address = typeof msg.address === 'string' ? msg.address : '';
    var u = null;
    try { u = new URL(address); } catch (e) { /* refused below */ }
    if (!u || (u.protocol !== 'https:' && u.protocol !== 'http:')) {
      refuse('init: address must be an absolute http(s) URL, got ' + JSON.stringify(msg.address));
      return;
    }
    var headline = document.getElementById('campaign');
    var max = headline && headline.maxLength > 0 ? headline.maxLength : CAPTION_MAX;
    if (msg.caption != null && (typeof msg.caption !== 'string' || msg.caption.length > max)) {
      refuse('init: caption must be text of at most ' + max + ' characters, got ' + JSON.stringify(msg.caption));
      return;
    }

    // Verbatim. buildText() returns this and ignores the URL field and the UTM inputs.
    window.CODEDESK_HOST_ADDRESS = address;
    document.body.classList.add('codedesk-address-locked');

    var typeSel = document.getElementById('qrType');
    if (typeSel && typeSel.value !== 'URL') setField(typeSel, 'URL');
    if (headline && typeof msg.caption === 'string') setField(headline, msg.caption);

    // A type change rebuilds #detailsPanel, so the URL field is filled once the rebuilt one exists.
    // Its look (read-only, UTM hidden) is the stylesheet's, under body.codedesk-address-locked.
    var tries = 0;
    (function fill() {
      var urlField = document.getElementById('urlData');
      if (!urlField) {
        if (++tries > 120) { refuse('init: the URL field never appeared after choosing the URL type'); return; }
        requestAnimationFrame(fill); return;
      }
      setField(urlField, address);
      urlField.readOnly = true;
      urlField.setAttribute('aria-readonly', 'true');
      try { if (typeof window.render === 'function') window.render(); } catch (e) { /* render reports its own */ }
      send({ type: 'codedesk:locked', address: address });
    }());
  }

  window.addEventListener('message', function (ev) {
    if (ev.source !== window.parent || ev.origin !== hostOrigin) return;
    var msg = ev.data;
    if (!msg || typeof msg !== 'object' || typeof msg.type !== 'string' || msg.type.indexOf('codedesk:') !== 0) return;
    if (msg.type === 'codedesk:init') take(msg);
    else refuse('unknown message type ' + JSON.stringify(msg.type));
  });

  /** ✨ in host mode: the finished card goes back to the host. Called by qr_sync_pipeline.js. */
  window.codedeskHostDeliver = async function codedeskHostDeliver() {
    if (typeof window.CODEDESK_HOST_ADDRESS !== 'string') {
      refuse('✨ before init: no address has been given — nothing was encoded');
      return false;
    }
    var design = typeof window.codedeskExportState === 'function' ? window.codedeskExportState() : null;
    var png = typeof window.codedeskExportPngDataUrl === 'function' ? await window.codedeskExportPngDataUrl() : '';
    if (!design || !png) { refuse('✨: the design or the image could not be exported'); return false; }
    send({ type: 'codedesk:design', address: window.CODEDESK_HOST_ADDRESS, design: design, png: png });
    return true;
  };

  // Ready once the Code drawer's URL field exists — before that an init would have nowhere to land.
  var frames = 0;
  (function whenBuilt() {
    if (document.getElementById('urlData')) { send({ type: 'codedesk:ready', version: VERSION }); return; }
    if (++frames > 600) { refuse('the Code drawer never appeared — cannot take an address'); return; }
    requestAnimationFrame(whenBuilt);
  }());
}());
