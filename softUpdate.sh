#!/usr/bin/env bash
set -euo pipefail

# Ensure this script always runs from the repository root.
cd "$(dirname "${BASH_SOURCE[0]}")"

echo "Pulling latest code..."
git pull

echo "Building Docker image..."
docker compose build chiro-app

echo "Restarting Docker service..."
docker compose up -d chiro-app

echo "Update completed."