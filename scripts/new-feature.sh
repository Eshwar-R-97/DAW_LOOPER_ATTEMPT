#!/bin/bash
# Create a new feature branch from an up-to-date main.
# Usage: ./scripts/new-feature.sh <feature-name>
# Example: ./scripts/new-feature.sh overdub-fix

set -e

FEATURE_NAME=$1

if [ -z "$FEATURE_NAME" ]; then
  echo "Usage: ./scripts/new-feature.sh <feature-name>"
  echo "Example: ./scripts/new-feature.sh overdub-fix"
  exit 1
fi

BRANCH="feature/$FEATURE_NAME"

# Ensure no tracked file changes before switching branches (ignore untracked files)
if [ -n "$(git diff --name-only)" ] || [ -n "$(git diff --cached --name-only)" ]; then
  echo "Error: You have uncommitted changes. Commit or stash them first."
  exit 1
fi

git checkout main
git pull origin main
git checkout -b "$BRANCH"

echo ""
echo "Branch created: $BRANCH"
echo ""
echo "Next steps:"
echo "  1. Make your changes"
echo "  2. Run: npm test && npm run build"
echo "  3. Commit and push: git push -u origin $BRANCH"
echo "  4. Create PR: gh pr create"
