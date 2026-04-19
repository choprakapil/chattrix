# Live Chat SaaS (Tawk-style)

Production-ready live chat SaaS with:
- `backend` (Node.js, Express, Socket.io, MySQL, session auth)
- `frontend` (React + Tailwind admin and agent dashboards)
- embeddable lightweight `widget.js` (vanilla JavaScript)

## 1) Prerequisites

- Node.js 18+
- MySQL 8+
- Apache 2.4+ (for production reverse proxy)
- PM2 (`npm i -g pm2`) for backend process management

## 2) Install

```bash
git clone <your-repo-url>
cd Chatrix
cd backend && npm install
cd ../frontend && npm install
```

## 3) Environment setup

Copy `.env.example` values into `backend/.env`:

```env
PORT=3001
NODE_ENV=development
DB_HOST=localhost
DB_PORT=3306
DB_NAME=livechat
DB_USER=root
DB_PASSWORD=yourpassword
SESSION_SECRET=your_secret_key
CORS_ORIGIN=http://localhost:3000
WIDGET_CDN_URL=http://localhost:3001
```

Production mode: set `NODE_ENV=production`, real DB host/user/password, `CORS_ORIGIN` to frontend domain, and `WIDGET_CDN_URL` to backend public URL.

## 4) Database schema setup

Create DB and run schema:

```sql
CREATE DATABASE livechat;
USE livechat;
SOURCE /absolute/path/to/backend/src/db/schema.sql;
```

## 5) Create first admin (CLI)

```bash
cd backend
node cli/create-admin.js
```

You will be prompted for name, email, and password.

## 6) Run backend

Development:

```bash
cd backend
node server.js
```

Production (PM2):

```bash
cd backend
pm2 start server.js --name livechat
pm2 save
```

## 7) Run/build frontend

Development:

```bash
cd frontend
npm run dev
```

Build for production:

```bash
cd frontend
npm run build
```

Serve `frontend/dist` via Apache `DocumentRoot`.

## 8) Embed widget on any website

Admin dashboard provides script per property:

```html
<script async src="https://yourdomain.com/widget.js" data-property-id="PROPERTY_UUID"></script>
```

Widget file is served from `backend/public/widget.js`.

## 9) Apache reverse proxy example

```apache
<VirtualHost *:80>
    ServerName yourdomain.com

    # Frontend static build
    DocumentRoot /var/www/livechat/frontend/dist
    <Directory /var/www/livechat/frontend/dist>
        AllowOverride All
        Require all granted
    </Directory>

    # Backend API + Socket + Widget proxy
    ProxyPreserveHost On
    ProxyPass /api http://127.0.0.1:3001/api
    ProxyPassReverse /api http://127.0.0.1:3001/api
    ProxyPass /socket.io http://127.0.0.1:3001/socket.io
    ProxyPassReverse /socket.io http://127.0.0.1:3001/socket.io
    ProxyPass /widget.js http://127.0.0.1:3001/widget.js
    ProxyPassReverse /widget.js http://127.0.0.1:3001/widget.js
</VirtualHost>
```

Enable Apache modules:

```bash
a2enmod proxy proxy_http headers rewrite
systemctl reload apache2
```

## 10) Troubleshooting

- `ER_ACCESS_DENIED_ERROR`: Verify `DB_USER/DB_PASSWORD` in `backend/.env`.
- `Property not found`: Ensure embed script `data-property-id` matches property UUID from admin dashboard.
- Session not persisting in production: run HTTPS and set correct `CORS_ORIGIN`, `NODE_ENV=production`.
- Socket disconnects behind Apache: make sure `/socket.io` reverse proxy is configured.
- Widget unavailable: verify backend is reachable and `WIDGET_CDN_URL` is correct.

## Final flow

1. Run CLI and create first admin.
2. Admin logs in, creates property, and copies embed script.
3. Admin creates and assigns agents.
4. Agent accepts assignment and can set status/greeting.
5. Visitor opens embedded widget and starts chat.
6. Agent joins chat in real-time and can end chat.
7. Full chat history and notifications are stored in MySQL.
