# Chattrix Deployment Guide

This guide explains how to deploy Chattrix to a live server while maintaining local compatibility.

## 1. Backend Deployment

### Environment Variables
Create a `.env` file on your server with the following values:
```env
PORT=3001
NODE_ENV=production
DB_HOST=your-db-host
DB_PORT=3306
DB_NAME=your-db-name
DB_USER=your-db-user
DB_PASSWORD=your-db-password
SESSION_SECRET=a-long-random-string
CORS_ORIGIN=https://your-frontend-domain.com
WIDGET_CDN_URL=https://your-backend-domain.com
```

### Database
Run the `backend/src/db/schema.sql` on your production MySQL database to set up the tables.

### Deployment Commands
```bash
cd backend
npm install
npm start
```

---

## 2. Frontend Deployment

### Environment Variables
When building the frontend, set the `VITE_API_URL` environment variable:
```bash
cd frontend
VITE_API_URL=https://your-backend-domain.com npm run build
```
Upload the contents of `frontend/dist` to your web server or a CDN/Static host (like Vercel, Netlify, or AWS S3).

---

## 3. Landing Page
In `landingpage/index.html`, find the "CHATTRIX WIDGET" section and update the `backendUrl` for production:
```javascript
var backendUrl = isLocal ? 'http://localhost:3001' : 'https://your-production-backend.com';
```

---

## Automatic Environment Detection
The code has been enhanced to automatically detect if it's running on `localhost`:
- **Widget**: Automatically detects its own origin via `scriptTag.src`.
- **Admin Dashboard**: Dynamically generates the embed script using the request host if `WIDGET_CDN_URL` is not set.
- **Frontend API**: Fallbacks to `localhost:3001` only when the browser hostname is `localhost`.
- **CORS**: Backend allows `localhost` origins by default to simplify local development.
