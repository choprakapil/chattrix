#!/bin/bash

# 1. Build Frontend
echo "Building Frontend for /chat/ subdirectory..."
cd frontend
VITE_API_URL=/chat npm run build
cd ..

# 2. Prepare Zip
echo "Preparing deployment zip..."
zip -r chattrix_deploy.zip backend frontend/dist landingpage package.json -x "**/node_modules/*" "**/.git/*" "**/.env"

echo "Done! Upload chattrix_deploy.zip to your server at /home/kapil/apps/knyxjs/chat"
echo "Then follow the instructions in DEPLOYMENT_FINAL.md"
