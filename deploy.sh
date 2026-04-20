#!/bin/bash
# =========================================================
#  CHATTRIX — Deployment Script
#  Usage: ./deploy.sh
#  Target: knyx-vps → /home/kapil/apps/knyxjs/chat
# =========================================================

set -e  # Stop on any error

REMOTE_HOST="knyx-vps"
REMOTE_DIR="/home/kapil/apps/knyxjs/chat"
BOLD="\033[1m"
GREEN="\033[0;32m"
RED="\033[0;31m"
YELLOW="\033[0;33m"
RESET="\033[0m"

echo ""
echo -e "${BOLD}🚀 Chattrix Deployment Starting...${RESET}"
echo "==========================================="

# ── Step 1: Build Frontend ──────────────────────────────────
echo ""
echo -e "${YELLOW}📦 Step 1/4: Building Frontend...${RESET}"
cd frontend
VITE_API_URL=/chat npm run build
cd ..
echo -e "${GREEN}✅ Frontend built successfully.${RESET}"

# ── Step 2: Sync Backend Source Files ──────────────────────
echo ""
echo -e "${YELLOW}📂 Step 2/4: Syncing backend source files to server...${RESET}"
rsync -av --progress \
  --exclude "node_modules" \
  --exclude ".env" \
  --exclude "public" \
  --exclude "*.log" \
  backend/ ${REMOTE_HOST}:${REMOTE_DIR}/backend/

echo ">>> Syncing widget script..."
rsync -av --progress \
  backend/public/widget.js ${REMOTE_HOST}:${REMOTE_DIR}/backend/public/widget.js

echo -e "${GREEN}✅ Backend source files synced.${RESET}"

# ── Step 3: Sync Frontend Build & Landing Page ─────────────
echo ""
echo -e "${YELLOW}🌐 Step 3/4: Syncing frontend build and landing page...${RESET}"
rsync -av --progress \
  frontend/dist/ ${REMOTE_HOST}:${REMOTE_DIR}/frontend/dist/

rsync -av --progress \
  landingpage/ ${REMOTE_HOST}:${REMOTE_DIR}/landingpage/
echo -e "${GREEN}✅ Frontend assets synced.${RESET}"

# ── Step 4: Apply Database Schema ──────────────────────────
echo ""
echo -e "${YELLOW}🗄️  Step 4/5: Applying database schema (safe — no data loss)...${RESET}"
ssh ${REMOTE_HOST} bash << 'ENDSSH'
  set -a
  source /home/kapil/apps/knyxjs/chat/backend/.env
  set +a
  mysql -u"${DB_USER}" -p"${DB_PASSWORD}" -h"${DB_HOST}" "${DB_NAME}" < /home/kapil/apps/knyxjs/chat/backend/src/db/schema.sql
  echo "✅ Schema applied."
ENDSSH
echo -e "${GREEN}✅ Database schema is up to date.${RESET}"

# ── Step 5: Run Post-Deploy on Server ──────────────────────
echo ""
echo -e "${YELLOW}⚙️  Step 5/5: Running post-deploy commands on server...${RESET}"
ssh ${REMOTE_HOST} bash << 'ENDSSH'
  set -e
  cd /home/kapil/apps/knyxjs/chat

  echo ">>> Updating dashboard public assets..."
  mkdir -p backend/public/dashboard
  cp -rf frontend/dist/* backend/public/dashboard/

  echo ">>> Updating landing page..."
  cp -rf landingpage/* backend/public/

  echo ">>> Installing backend dependencies..."
  cd backend
  npm install --production --quiet

  echo ">>> Restarting Chattrix backend via PM2..."
  pm2 restart chattrix-backend

  echo ">>> PM2 Status:"
  pm2 status chattrix-backend
ENDSSH

# ── Done ───────────────────────────────────────────────────
echo ""
echo "==========================================="
echo -e "${GREEN}${BOLD}🎉 Deployment Complete!${RESET}"
echo -e "   Live at: ${BOLD}https://knyxsports.com/chat/dashboard/${RESET}"
echo "==========================================="
echo ""
