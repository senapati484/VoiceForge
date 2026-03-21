#!/bin/bash
# Quick smoke test for VoiceForge backend

echo "=== VoiceForge Backend Smoke Test ==="
echo ""

# Check if dist folder exists
if [ ! -d "dist" ]; then
  echo "✗ dist folder not found. Run 'npm run build' first."
  exit 1
fi
echo "✓ dist folder exists"

# Check key compiled files exist
files=(
  "dist/index.js"
  "dist/config.js"
  "dist/db/mongoose.js"
  "dist/db/index.js"
  "dist/routes/auth.js"
  "dist/routes/agents.js"
  "dist/services/vapi.service.js"
  "dist/rag/ingest.js"
  "dist/worker/index.js"
)

all_exist=true
for file in "${files[@]}"; do
  if [ -f "$file" ]; then
    echo "✓ $file"
  else
    echo "✗ $file missing"
    all_exist=false
  fi
done

echo ""
if [ "$all_exist" = true ]; then
  echo "=== All smoke tests passed ==="
  exit 0
else
  echo "=== Some files are missing ==="
  exit 1
fi
