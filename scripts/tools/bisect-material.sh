#!/usr/bin/env bash
# BISECT THE MATERIAL. Render the same frame at every historical version of the
# shader and report the measured body/shadow/spread for each, so "which one was
# the good look" is a thing you PICK rather than a thing anyone reconstructs
# from memory. The working shader is saved first and restored on any exit path.
set -u
cd "$(dirname "$0")/.."
SAVE=".melt-sim-cache/shader-working.mjs"
mkdir -p .melt-sim-cache
cp lib/webgl/sdf-glass-shader.mjs "$SAVE"
restore() { cp "$SAVE" lib/webgl/sdf-glass-shader.mjs; echo "  (working shader restored)"; }
trap restore EXIT INT TERM

COMMITS="${COMMITS:-eedb313 1d53c08 d5606d9 c7740e6 ac7bc1d 1d709a6 402f5ee 08c660e}"
for c in $COMMITS; do
  subject=$(git log -1 --format=%s "$c" | cut -c1-52)
  if ! git show "$c:lib/webgl/sdf-glass-shader.mjs" > lib/webgl/sdf-glass-shader.mjs 2>/dev/null; then
    echo "### $c  — shader not present at this commit, skipped"; continue
  fi
  sleep 6   # let the dev server rebuild the chunk
  echo "### $c  $subject"
  AT=0.55 TAG="bisect-$c" timeout 240 node scripts/probe/material.mjs 2>&1 \
    | grep -E "ran as|body|shadow|spread|ONLY" | sed 's/^/    /'
done
