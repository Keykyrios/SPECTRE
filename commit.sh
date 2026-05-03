#!/bin/bash
rm -rf .git
git init

git add README.md
git commit -m "docs: deeply comprehensive and professional README architecture"

git add client/src/app/globals.css
git commit -m "feat(ui): implement CRT scanlines and cyberpunk aesthetics"

git add client/src/components/Dashboard.tsx
git commit -m "feat(ui): add system kernel boot sequence overlay"

git add client/src/components/Header.tsx
git commit -m "feat(ui): add animated memory dump readout to header"

git add client/src/components/SpectreGraph.tsx
git commit -m "refactor(ui): optimize WebGL post-processing for visibility"

git add client/src/app/engine/page.tsx client/src/components/EngineDiagnostics.tsx
git commit -m "feat(engine): introduce low-level telemetry and memory diagnostics view"

git add .
git commit -m "chore: initial project baseline"

git remote add origin https://github.com/Keykyrios/SPECTRE.git
git branch -M main
