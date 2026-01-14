#!/bin/bash

# Script to fix fetch paths in all TypeScript/TSX files
# Replaces fetch('/api/ with fetch('/app/api/ to work with basePath

cd "$(dirname "$0")/.."

# Find all .tsx and .ts files in apps/web that contain fetch('/api/
files=$(grep -r "fetch('/api/" apps/web --include="*.tsx" --include="*.ts" -l | grep -v node_modules)

for file in $files; do
  # Skip files that already use window.location.origin (they're already correct)
  if grep -q "window.location.origin.*'/app/api/" "$file"; then
    echo "Skipping $file (already uses correct path)"
    continue
  fi
  
  # Replace fetch('/api/ with fetch('/app/api/
  # But be careful not to replace fetch('/app/api/ (already correct)
  sed -i.bak "s|fetch('/api/|fetch('/app/api/|g" "$file"
  
  # Remove backup files
  rm -f "${file}.bak"
  
  echo "Fixed: $file"
done

echo "Done! Fixed fetch paths in all files."


