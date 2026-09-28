#!/usr/bin/env node
// host-contract.mjs — CodeDesk encodes the address its host gives it, and nothing else.
//
// The claims of README § "Hosts", read from the source — nothing is restated here:
//   (1) location.origin builds no payload. Its only legal use is locating CodeDesk's OWN files
//       (the __CODEDESK_BASE_URL__ helper). Any other read fails: a card printed from staging
//       would encode staging, and a printed card cannot be updated.
//   (2) Both buildText() definitions return the host's address verbatim, first thing, when one
//       is set (window.CODEDESK_HOST_ADDRESS) — before any field or UTM is read.
//   (3) codedesk-host.js loads after the bootstrapper (it reads embed mode) and before the sync
//       pipeline (which reads window.CODEDESK_HOST), in index.html's script order.
//   (4) CodeDesk holds no town's data: no landmarks/businesses file, no town backend URL.
//
//   node checks/host-contract.mjs        exit 0 = holds · 1 = a claim is false
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SKIP = new Set(['.git', 'node_modules', 'vendor', 'dist', 'checks'])
const files = []
;(function walk(d) {
  for (const n of readdirSync(d)) {
    if (SKIP.has(n)) continue
    const p = join(d, n)
    if (statSync(p).isDirectory()) walk(p)
    else files.push(p)
  }
})(ROOT)
const src = files.filter((f) => /\.(js|html)$/.test(f))
const read = (f) => readFileSync(f, 'utf8')
let fails = 0
const fail = (m) => { fails++; console.log(`  ✗ ${m}`) }
const pass = (m) => console.log(`  ✓ ${m}`)

// (1)
const bad = []
for (const f of src) {
  const lines = read(f).split('\n')
  lines.forEach((l, i) => {
    if (!/location\.origin/.test(l) || /^\s*(\/\/|\*)/.test(l)) return
    const before = lines.slice(Math.max(0, i - 20), i).join('\n')
    if (!/__CODEDESK_BASE_URL__\s*=/.test(before)) bad.push(`${relative(ROOT, f)}:${i + 1}  ${l.trim()}`)
  })
}
if (bad.length) fail(`location.origin read outside the asset-base helper:\n      ${bad.join('\n      ')}`)
else pass('location.origin is read only to locate CodeDesk\'s own files')

// (2)
const tk = read(join(ROOT, 'qr_ui_toolkit.js'))
const defs = [...tk.matchAll(/(?:window\.buildText\s*=\s*function\s+buildText|^function buildText)\s*\(\s*\)\s*\{([\s\S]{0,400})/gm)]
const guarded = defs.filter((m) => {
  const body = m[1].split('\n').filter((l) => l.trim() && !/^\s*\/\//.test(l))
  return /typeof window\.CODEDESK_HOST_ADDRESS === 'string'\) return window\.CODEDESK_HOST_ADDRESS/.test(body[0] || '')
})
if (defs.length < 2) fail(`found ${defs.length} buildText definition(s), expected 2 — the parse is blind; fix it before trusting a pass`)
else if (guarded.length !== defs.length) fail(`${defs.length - guarded.length} of ${defs.length} buildText definition(s) do not return the host's address first`)
else pass(`both buildText definitions return the host's address verbatim, first`)

// (3)
const html = read(join(ROOT, 'index.html'))
const at = (name) => html.search(new RegExp(`<script[^>]+src="\\./${name.replace('.', '\\.')}`))
const [boot, host, sync] = ['qr_app-bootstrapper.js', 'codedesk-host.js', 'qr_sync_pipeline.js'].map(at)
if (host < 0) fail('index.html does not load codedesk-host.js')
else if (!(boot < host && host < sync)) fail('codedesk-host.js must load after qr_app-bootstrapper.js and before qr_sync_pipeline.js')
else pass('codedesk-host.js loads between the bootstrapper and the sync pipeline')

// (4)
const townFiles = files.filter((f) => /(^|\/)(landmarks|businesses)\.json$/.test(f)).map((f) => relative(ROOT, f))
const townApi = src.filter((f) => /LSQ_API_URL|getLsqBaseUrl|action=listings/.test(read(f))).map((f) => relative(ROOT, f))
if (townFiles.length || townApi.length) fail(`town data in CodeDesk: ${[...townFiles, ...townApi].join(', ')}`)
else pass('no town\'s data and no town backend')

console.log(fails ? `\n❌ ${fails} claim(s) false` : '\n✅ the host contract holds')
process.exit(fails ? 1 : 0)
