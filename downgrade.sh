#!/usr/bin/env bash
set -euo pipefail

# Ensure this script runs from the repository root.
cd "$(dirname "${BASH_SOURCE[0]}")"

echo "Fetching latest refs..."
git fetch

echo "Rolling back one commit..."
git reset --hard HEAD~1

echo "Rebuilding Docker image for rollback..."
docker compose build --no-cache chiro-app

echo "Restarting Docker service..."
docker compose up -d chiro-app

echo "Rollback completed."