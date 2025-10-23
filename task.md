# 22. Cloud‑Based File Sharing with Expiry — **Task Plan**

Tech: **React**, **Express.js**, **MySQL**, **MinIO** (S3‑compatible)

> Users upload files with a time‑based expiry. Files **auto‑delete** from storage and DB once expired.

---

## 1) Objectives & Scope
- Build a production‑ready, dockerized app with **client** (React) and **server** (Express) + **MySQL** + **MinIO**.
- Simple login (optional local only for demo) + upload file + choose expiry time.
- Share a public link with countdown; when expired, file becomes unavailable.
- **Auto‑deletion**: background job deletes both DB rows and MinIO objects after `expires_at`.
- Use **MVC** on the server and an **ORM** (Sequelize) with migrations + seeders.
- Use **JavaScript only** (no TypeScript).

---

## 2) Project Structure (Monorepo)
```
cloud-file-expiry/
├─ client/                      # React app
│  ├─ Dockerfile
│  ├─ nginx.conf                # For static serving in NGINX
│  └─ src/
│     ├─ api/
│     │  └─ http.js             # axios instance
│     ├─ components/
│     │  ├─ UploadForm.jsx
│     │  ├─ FileCard.jsx
│     │  ├─ Countdown.jsx
│     │  └─ CopyLinkButton.jsx
│     ├─ pages/
│     │  ├─ UploadPage.jsx
│     │  └─ ViewPage.jsx        # public download page
│     ├─ hooks/
│     │  └─ useCountdown.js
│     ├─ App.jsx
│     └─ main.jsx
│
├─ server/                      # Express MVC + Sequelize
│  ├─ Dockerfile
│  └─ src/
│     ├─ app.js                 # bootstraps express
│     ├─ server.js              # http server start
│     ├─ config/
│     │  ├─ env.js              # reads .env
│     │  ├─ database.js         # sequelize init
│     │  └─ minio.js            # minio client
│     ├─ models/                # Sequelize models (ORM)
│     │  ├─ index.js
│     │  ├─ user.js
│     │  └─ file.js
│     ├─ migrations/
│     │  ├─ 001-create-users.js
│     │  └─ 002-create-files.js
│     ├─ seeders/
│     │  └─ 000-demo-user.js
│     ├─ controllers/           # C in MVC
│     │  ├─ authController.js
│     │  └─ fileController.js
│     ├─ services/              # business logic + integrations
│     │  ├─ storageService.js   # MinIO wrapper
│     │  └─ fileService.js
│     ├─ repositories/          # (optional) DB access abstraction
│     │  └─ fileRepository.js
│     ├─ routes/                # V thin; maps to controllers
│     │  ├─ authRoutes.js
│     │  ├─ fileRoutes.js
│     │  └─ index.js
│     ├─ middlewares/
│     │  ├─ errorHandler.js
│     │  ├─ auth.js             # simple JWT/local cookie
│     │  └─ rateLimit.js
│     ├─ jobs/                  # background jobs (cron)
│     │  └─ cleanupExpired.js
│     ├─ utils/
│     │  ├─ crypto.js           # random ids, signed tokens (if any)
│     │  └─ validation.js
│     └─ tests/                 # (optional) supertest
│
├─ docker-compose.yml
├─ .env                         # root (optional) -> use server/.env & client/.env
└─ README.md
```

---

## 3) Environment Variables
Create `.env` files. **Do not commit** them.

**server/.env**
```
NODE_ENV=development
PORT=8080

# MySQL
DB_HOST=mysql
DB_PORT=3306
DB_NAME=filedb
DB_USER=fileuser
DB_PASSWORD=filepass

# MinIO
MINIO_ENDPOINT=minio
MINIO_PORT=9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_USE_SSL=false
MINIO_BUCKET=files

# Auth (demo)
JWT_SECRET=supersecret
PUBLIC_BASE_URL=http://localhost:5173        # client public url for links (or server if direct)
DOWNLOAD_BASE_URL=http://localhost:8080      # used for download links
MAX_UPLOAD_MB=50
```

**client/.env** (Vite style)
```
VITE_API_BASE_URL=http://localhost:8080/api
```

---

## 4) Database Schema (Sequelize Models)

### `User`
- `id` (PK, UUID or INT auto)
- `email` (string, unique)
- `password_hash` (string) — demo only

### `File`
- `id` (PK, UUID)
- `user_id` (FK -> User.id, nullable if anonymous allowed)
- `original_name` (string)
- `storage_key` (string) — MinIO object key
- `mime_type` (string)
- `size_bytes` (BIGINT)
- `expires_at` (DATETIME)
- `download_token` (string) — random public token for URL
- `download_count` (INT, default 0)
- `max_downloads` (INT, nullable) — optional feature
- `created_at` / `updated_at`

> Indexes: `expires_at`, `download_token` unique, `user_id`.

---

## 5) REST API (Express)
Base path: `/api`

**Auth**
- `POST /api/auth/login` — demo login; returns cookie/JWT
- `POST /api/auth/logout`

**Files**
- `POST /api/files` — multipart upload fields: `file`, `expiresIn` (seconds/minutes/hours) or `expiresAt` (ISO), optional `maxDownloads`
- `GET /api/files/:token` — metadata for public file (no auth)
- `GET /api/files/:token/download` — stream download (no auth); increments `download_count`, enforces `max_downloads` and expiry
- `DELETE /api/files/:id` — owner delete
- `GET /api/files` — list user’s files (auth)

Error codes: `400` validation, `401` auth, `403` owner only, `404` not found/expired, `410` gone (expired).

---

## 6) Expiry & Auto‑Deletion

### Runtime enforcement
- On each `GET /:token` or `/download`, check `expires_at < now()` or `download_count >= max_downloads` → return `410 Gone` and schedule deletion.

### Background cleanup job
- `jobs/cleanupExpired.js` using **node-cron** (or setInterval) runs every **minute**:
  1. Find expired files: `expires_at <= NOW()` OR exceeded max downloads.
  2. Delete MinIO object by `storage_key` (ignore 404s).
  3. Delete DB row.
  4. Log metrics.

### (Optional) MinIO lifecycle policy
- You can also apply a **bucket lifecycle** to auto‑expire objects with a tag (e.g., `"expires_on=YYYY-MM-DD"`). The app still cleans DB rows for consistency. See sample policy at the end.

---

## 7) Server Implementation Notes (JS only)

### `src/config/database.js`
```js
const { Sequelize } = require('sequelize');
const { DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD, NODE_ENV } = require('./env');

const sequelize = new Sequelize(DB_NAME, DB_USER, DB_PASSWORD, {
  host: DB_HOST,
  port: DB_PORT,
  dialect: 'mysql',
  logging: NODE_ENV !== 'production' ? console.log : false,
});

module.exports = sequelize;
```

### `src/config/minio.js`
```js
const Minio = require('minio');
const { MINIO_ENDPOINT, MINIO_PORT, MINIO_ACCESS_KEY, MINIO_SECRET_KEY, MINIO_USE_SSL, MINIO_BUCKET } = require('./env');

const minioClient = new Minio.Client({
  endPoint: MINIO_ENDPOINT,
  port: parseInt(MINIO_PORT, 10),
  useSSL: MINIO_USE_SSL === 'true',
  accessKey: MINIO_ACCESS_KEY,
  secretKey: MINIO_SECRET_KEY,
});

async function ensureBucket() {
  const exists = await minioClient.bucketExists(MINIO_BUCKET).catch(() => false);
  if (!exists) await minioClient.makeBucket(MINIO_BUCKET, 'us-east-1');
}

module.exports = { minioClient, ensureBucket };
```

### `src/models/file.js`
```js
module.exports = (sequelize, DataTypes) => {
  const File = sequelize.define('File', {
    id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    user_id: { type: DataTypes.UUID, allowNull: true },
    original_name: DataTypes.STRING,
    storage_key: { type: DataTypes.STRING, unique: true },
    mime_type: DataTypes.STRING,
    size_bytes: DataTypes.BIGINT,
    expires_at: { type: DataTypes.DATE, allowNull: false },
    download_token: { type: DataTypes.STRING, unique: true },
    download_count: { type: DataTypes.INTEGER, defaultValue: 0 },
    max_downloads: { type: DataTypes.INTEGER, allowNull: true },
  }, { tableName: 'files', underscored: true });
  return File;
};
```

### `src/services/storageService.js`
```js
const { minioClient } = require('../config/minio');
const { MINIO_BUCKET } = require('../config/env');

async function putObject(storageKey, buffer, meta) {
  await minioClient.putObject(MINIO_BUCKET, storageKey, buffer, meta);
}

async function removeObject(storageKey) {
  try { await minioClient.removeObject(MINIO_BUCKET, storageKey); } catch (e) { if (e.code !== 'NoSuchKey') throw e; }
}

async function getObjectStream(storageKey) {
  return minioClient.getObject(MINIO_BUCKET, storageKey);
}

module.exports = { putObject, removeObject, getObjectStream };
```

### `src/jobs/cleanupExpired.js`
```js
const cron = require('node-cron');
const { Op } = require('sequelize');
const { File } = require('../models');
const { removeObject } = require('../services/storageService');

function startCleanup() {
  cron.schedule('* * * * *', async () => {
    const now = new Date();
    const candidates = await File.findAll({
      where: {
        [Op.or]: [
          { expires_at: { [Op.lte]: now } },
          { max_downloads: { [Op.not]: null }, download_count: { [Op.gte]: sequelize.col('max_downloads') } }
        ]
      },
      limit: 200
    });

    for (const f of candidates) {
      try { await removeObject(f.storage_key); } catch (e) { /* log */ }
      await f.destroy();
    }
  });
}

module.exports = { startCleanup };
```

### `src/controllers/fileController.js` (core flows)
```js
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: (parseInt(process.env.MAX_UPLOAD_MB||'50')*1024*1024) } });
const { v4: uuid } = require('uuid');
const { File } = require('../models');
const { putObject, getObjectStream, removeObject } = require('../services/storageService');

function parseExpiry(req) {
  if (req.body.expiresAt) return new Date(req.body.expiresAt);
  const seconds = parseInt(req.body.expiresIn || '0', 10);
  if (!seconds) throw new Error('Invalid expiry');
  return new Date(Date.now() + seconds*1000);
}

exports.uploadMiddleware = upload.single('file');

exports.create = async (req, res, next) => {
  try {
    const f = req.file; if (!f) return res.status(400).json({ error: 'file required' });
    const expiresAt = parseExpiry(req);
    const id = uuid();
    const token = uuid().replace(/-/g, '');
    const storageKey = `${id}-${f.originalname}`;

    await putObject(storageKey, f.buffer, { 'Content-Type': f.mimetype });

    const record = await File.create({
      id, user_id: req.user?.id || null,
      original_name: f.originalname,
      storage_key: storageKey,
      mime_type: f.mimetype,
      size_bytes: f.size,
      expires_at: expiresAt,
      download_token: token,
      max_downloads: req.body.maxDownloads || null
    });

    res.status(201).json({
      token, id: record.id,
      downloadUrl: `${process.env.DOWNLOAD_BASE_URL}/api/files/${token}/download`,
      viewUrl: `${process.env.DOWNLOAD_BASE_URL}/api/files/${token}`
    });
  } catch (e) { next(e); }
};

exports.meta = async (req, res) => {
  const file = await File.findOne({ where: { download_token: req.params.token } });
  if (!file) return res.status(404).json({ error: 'not found' });
  if (file.expires_at <= new Date()) return res.status(410).json({ error: 'expired' });
  res.json({
    name: file.original_name,
    size: file.size_bytes,
    mime: file.mime_type,
    expiresAt: file.expires_at,
    remainingDownloads: file.max_downloads ? Math.max(0, file.max_downloads - file.download_count) : null
  });
};

exports.download = async (req, res) => {
  const file = await File.findOne({ where: { download_token: req.params.token } });
  if (!file) return res.status(404).json({ error: 'not found' });
  if (file.expires_at <= new Date()) return res.status(410).json({ error: 'expired' });
  if (file.max_downloads && file.download_count >= file.max_downloads) return res.status(410).json({ error: 'download limit reached' });

  const stream = await getObjectStream(file.storage_key);
  res.setHeader('Content-Type', file.mime_type);
  res.setHeader('Content-Disposition', `attachment; filename="${file.original_name}"`);
  stream.on('error', () => res.status(404).end());
  stream.on('end', async () => { file.download_count += 1; await file.save(); });
  stream.pipe(res);
};

exports.remove = async (req, res) => {
  const file = await File.findByPk(req.params.id);
  if (!file) return res.status(404).json({ error: 'not found' });
  // check ownership if using auth
  await removeObject(file.storage_key);
  await file.destroy();
  res.status(204).end();
};
```

---

## 8) Client Implementation Notes (React, Vite)

**Pages**
- `UploadPage` — form: file input, expiry select (e.g., 1h, 24h, 7d, custom), optional max downloads; POST to `/api/files`; shows share links.
- `ViewPage` — fetch `/api/files/:token` for metadata; show **Countdown**; `Download` button triggers download; handle 410/404 states.

**Countdown Hook (`useCountdown.js`)**
```js
import { useEffect, useState } from 'react';
export default function useCountdown(targetISO) {
  const [left, setLeft] = useState(() => Math.max(0, new Date(targetISO) - new Date()));
  useEffect(() => {
    const id = setInterval(() => setLeft(Math.max(0, new Date(targetISO) - new Date())), 1000);
    return () => clearInterval(id);
  }, [targetISO]);
  const sec = Math.floor(left/1000);
  return { leftMs: left, d: Math.floor(sec/86400), h: Math.floor(sec%86400/3600), m: Math.floor(sec%3600/60), s: sec%60 };
}
```

---

## 9) Docker & Compose

### `client/Dockerfile`
```dockerfile
# Build stage
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Serve stage
FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

### `client/nginx.conf`
```nginx
server {
  listen 80;
  server_name _;
  root /usr/share/nginx/html;
  index index.html;

  location / {
    try_files $uri /index.html; # SPA fallback
  }
}
```

### `server/Dockerfile`
```dockerfile
FROM node:20-alpine
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm ci
COPY . .
ENV NODE_ENV=production
EXPOSE 8080
CMD ["node", "src/server.js"]
```

### `docker-compose.yml`
```yaml
version: "3.9"
services:
  mysql:
    image: mysql:8.0
    environment:
      MYSQL_DATABASE: filedb
      MYSQL_USER: fileuser
      MYSQL_PASSWORD: filepass
      MYSQL_ROOT_PASSWORD: rootpass
    ports: ["3306:3306"]
    volumes:
      - db_data:/var/lib/mysql
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost"]
      interval: 10s
      timeout: 5s
      retries: 10

  minio:
    image: minio/minio:latest
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin
    ports: ["9000:9000", "9001:9001"]
    volumes:
      - minio_data:/data

  server:
    build: ./server
    environment:
      - NODE_ENV=production
      - PORT=8080
      - DB_HOST=mysql
      - DB_PORT=3306
      - DB_NAME=filedb
      - DB_USER=fileuser
      - DB_PASSWORD=filepass
      - MINIO_ENDPOINT=minio
      - MINIO_PORT=9000
      - MINIO_ACCESS_KEY=minioadmin
      - MINIO_SECRET_KEY=minioadmin
      - MINIO_USE_SSL=false
      - MINIO_BUCKET=files
      - JWT_SECRET=supersecret
      - DOWNLOAD_BASE_URL=http://localhost:8080
      - MAX_UPLOAD_MB=50
    depends_on:
      mysql:
        condition: service_healthy
      minio:
        condition: service_started
    ports: ["8080:8080"]

  client:
    build: ./client
    environment:
      - VITE_API_BASE_URL=http://localhost:8080/api
    depends_on:
      - server
    ports: ["5173:80"]

volumes:
  db_data:
  minio_data:
```

---

## 10) Server Entrypoints

### `src/app.js`
```js
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const routes = require('./routes');
const { errorHandler } = require('./middlewares/errorHandler');

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(morgan('dev'));
app.use('/api', routes);
app.use(errorHandler);
module.exports = app;
```

### `src/server.js`
```js
const app = require('./app');
const sequelize = require('./config/database');
const { ensureBucket } = require('./config/minio');
const { startCleanup } = require('./jobs/cleanupExpired');

(async () => {
  await sequelize.authenticate();
  await ensureBucket();
  // If using migrations via sequelize-cli, run them here or in Docker entrypoint
  startCleanup();
  const port = process.env.PORT || 8080;
  app.listen(port, () => console.log(`API running on :${port}`));
})();
```

### `src/routes/index.js`
```js
const router = require('express').Router();
router.use('/files', require('./fileRoutes'));
router.use('/auth', require('./authRoutes'));
module.exports = router;
```

### `src/routes/fileRoutes.js`
```js
const router = require('express').Router();
const ctrl = require('../controllers/fileController');

router.post('/', ctrl.uploadMiddleware, ctrl.create);
router.get('/:token', ctrl.meta);
router.get('/:token/download', ctrl.download);
router.delete('/:id', ctrl.remove);

module.exports = router;
```

---

## 11) Migrations (Sequelize‑CLI style)

**`002-create-files.js` sketch**
```js
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('files', {
      id: { type: Sequelize.UUID, primaryKey: true, defaultValue: Sequelize.literal('(uuid())') },
      user_id: { type: Sequelize.UUID, allowNull: true },
      original_name: Sequelize.STRING,
      storage_key: { type: Sequelize.STRING, unique: true },
      mime_type: Sequelize.STRING,
      size_bytes: Sequelize.BIGINT,
      expires_at: { type: Sequelize.DATE, allowNull: false },
      download_token: { type: Sequelize.STRING, unique: true },
      download_count: { type: Sequelize.INTEGER, defaultValue: 0 },
      max_downloads: { type: Sequelize.INTEGER, allowNull: true },
      created_at: Sequelize.DATE,
      updated_at: Sequelize.DATE,
    });
    await queryInterface.addIndex('files', ['expires_at']);
    await queryInterface.addIndex('files', ['download_token'], { unique: true });
  },
  down: async (qi) => qi.dropTable('files')
};
```

---

## 12) Security & Hardening
- Validate `expiresIn` bounds (e.g., 5 minutes — 14 days).
- Virus scanning (optional) or restrict file types.
- Rate limit upload & download (IP + token).
- Signed URLs: you can proxy downloads (as above) or pre‑signed S3 URLs (MinIO supports S3 API).
- Hide internal object keys; expose random `download_token` only.

---

## 13) Local Dev & Commands

**client**
```bash
npm create vite@latest client -- --template react
npm i axios
npm run dev
```

**server**
```bash
npm init -y
npm i express sequelize mysql2 multer uuid node-cron morgan cors dotenv minio
# (optional) sequelize-cli for migrations
npm i -D sequelize-cli nodemon
```

**Compose up**
```bash
docker compose up --build
# Client: http://localhost:5173  API: http://localhost:8080
# MinIO Console: http://localhost:9001 (user/pass: minioadmin/minioadmin)
```

---

## 14) Acceptance Criteria
- [ ] Upload a file with expiry (e.g., 15 minutes) → receive shareable link(s).
- [ ] Visiting metadata endpoint shows countdown & name.
- [ ] Download works before expiry; returns `410 Gone` after expiry.
- [ ] Cron job removes expired file **from MinIO** and **deletes DB row** within ~1 minute.
- [ ] Docker Compose brings up all services; MinIO bucket auto‑created.
- [ ] Server follows MVC with Sequelize ORM; migrations apply cleanly.
- [ ] Client SPA offers upload form, shows links, and public view with countdown.

---

## 15) Optional: MinIO Lifecycle Policy (server‑side tagging approach)
1) Tag objects on upload: `x-amz-tagging: expires_on=2025-10-23` (MinIO/S3 tagging header).
2) Apply bucket lifecycle (via mc or console):

**Example policy (JSON)**
```json
{
  "Rules": [
    {
      "ID": "ExpireOnTag",
      "Status": "Enabled",
      "Expiration": { "Date": "${expires_on}" },
      "Filter": { "Tag": { "Key": "expires_on", "Value": "*" } }
    }
  ]
}
```
> You may prefer a simpler app‑driven cron delete (already implemented above) to keep DB + storage in sync.

---

## 16) Next Steps
- Implement the client components (UploadForm, ViewPage) with the provided endpoints.
- Add tests for `fileController` (happy path, expired, limit exceeded).
- Add auth (if needed) and per‑user listing.
- Add email notifications prior to expiry (optional).

---

**You now have:** folder structures, ORM models, MVC wiring, cron cleanup, and full Dockerfiles/Compose to ship the MVP.

