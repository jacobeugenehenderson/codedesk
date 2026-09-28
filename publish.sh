#!/usr/bin/env bash
# publish.sh — release CodeDesk to the asset host as an immutable, versioned build.
#
# Owns: README § "Releasing". A release is the commit a git TAG names, copied to
#   <bucket>/codedesk/<tag>/  and served at  <asset base>/codedesk/<tag>/index.html
# A host pins that URL (README § "Hosts"); nothing ever changes under a published tag.
# Must never: publish an untagged or dirty tree, overwrite a published version, or
# ship the checks, the README, or anything under .git.
#
#   git tag v1.0.0 && ./publish.sh --dry     # the plan: files, sizes, the URL a host pins
#   ./publish.sh                             # upload (npx wrangler, logged in to the account)
#
# Env: R2_BUCKET (default theward-assets) · ASSET_BASE (default https://assets.theward.online/)
set -euo pipefail
cd "$(dirname "$0")"

DRY=0; [[ "${1:-}" == "--dry" ]] && DRY=1
BUCKET="${R2_BUCKET:-theward-assets}"
BASE="${ASSET_BASE:-https://assets.theward.online/}"; BASE="${BASE%/}/"

[[ -z "$(git status --porcelain)" ]] || { echo "⛔ the tree is dirty — commit first; a release is a commit" >&2; exit 2; }
TAG="$(git describe --exact-match --tags HEAD 2>/dev/null)" || { echo "⛔ HEAD has no tag — tag the release (git tag vX.Y.Z)" >&2; exit 2; }
[[ "$TAG" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]] || { echo "⛔ tag '$TAG' is not vX.Y.Z" >&2; exit 2; }

node checks/host-contract.mjs >/dev/null || { echo "⛔ checks/host-contract.mjs is red — not releasing" >&2; node checks/host-contract.mjs; exit 1; }

URL="${BASE}codedesk/${TAG}/index.html"
if [[ "$(curl -s -o /dev/null -w '%{http_code}' -I "$URL")" == "200" ]]; then
  echo "⛔ ${TAG} is already published at ${URL} — a release is immutable; tag a new version" >&2; exit 2
fi

OUT="$(mktemp -d)/codedesk/${TAG}"
mkdir -p "$OUT"
git ls-files -z | while IFS= read -r -d '' f; do
  case "$f" in checks/*|README.md|publish.sh|.git*|*.md) continue ;; esac
  mkdir -p "$OUT/$(dirname "$f")"; cp "$f" "$OUT/$f"
done
# Stamp the version codedesk-host.js reports in codedesk:ready.
sed -i.bak "s|<meta name=\"codedesk-version\" content=\"[^\"]*\">|<meta name=\"codedesk-version\" content=\"${TAG}\">|" "$OUT/index.html" && rm "$OUT/index.html.bak"
grep -q "content=\"${TAG}\"" "$OUT/index.html" || { echo "⛔ could not stamp the version into index.html" >&2; exit 1; }

mime() { case "$1" in *.html) echo text/html;; *.js) echo text/javascript;; *.css) echo text/css;; *.json) echo application/json;;
  *.png) echo image/png;; *.svg) echo image/svg+xml;; *.webp) echo image/webp;; *.woff2) echo font/woff2;; *) echo application/octet-stream;; esac; }

N=0; BYTES=0
while IFS= read -r -d '' f; do
  rel="${f#"$OUT/"}"; key="codedesk/${TAG}/${rel}"; size=$(wc -c < "$f"); N=$((N+1)); BYTES=$((BYTES+size))
  if (( DRY )); then printf '  %-60s %8d  %s\n' "$key" "$size" "$(mime "$rel")"; continue; fi
  npx wrangler r2 object put "${BUCKET}/${key}" --file "$f" --remote \
    --content-type "$(mime "$rel")" --cache-control "public, max-age=31536000, immutable" >/dev/null
done < <(find "$OUT" -type f -print0 | sort -z)

echo "${N} files, ${BYTES} bytes → ${BUCKET}/codedesk/${TAG}/"
echo "A host pins:  ${URL}?mode=embed&host=<the host's origin>"
(( DRY )) && echo "(dry run — nothing uploaded)"
exit 0
