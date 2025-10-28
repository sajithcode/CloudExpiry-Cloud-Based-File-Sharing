# Cloud File Expiry API

A REST API for uploading files with automatic expiry and deletion. Built with Express.js, Sequelize, MySQL, and MinIO.

## Features

- User authentication (register/login)
- File upload with expiry times
- Public download links with download limits
- Automatic cleanup of expired files
- MinIO S3-compatible storage

## Base URL

```
http://localhost:8080/api
```

## Authentication

All file operations require authentication. Use JWT tokens via cookies or Authorization header.

### Register User

**POST** `/auth/register`

Create a new user account.

**Request Body:**

```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response (201):**

```json
{
  "message": "Registration successful",
  "user": {
    "id": "uuid",
    "email": "user@example.com"
  }
}
```

### Login

**POST** `/auth/login`

Authenticate and receive JWT token.

**Request Body:**

```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response (200):**

```json
{
  "message": "Login successful",
  "user": {
    "id": "uuid",
    "email": "user@example.com"
  }
}
```

**Note:** JWT is set in httpOnly cookie. For API testing, Postman handles cookies automatically.

### Logout

**POST** `/auth/logout`

Clear JWT token.

**Response (200):**

```json
{
  "message": "Logged out successfully"
}
```

## File Endpoints

### Upload File

**POST** `/files`

Upload a file with expiry settings.

**Auth:** Required (JWT)

**Content-Type:** `multipart/form-data`

**Form Fields:**

- `file` (required): File to upload
- `expiresIn` (required): Expiry time in seconds (e.g., 3600 for 1 hour)
- `maxDownloads` (optional): Maximum download count

**Example (curl):**

```bash
curl -X POST http://localhost:8080/api/files \
  -H "Cookie: token=YOUR_JWT_TOKEN" \
  -F "file=@example.txt" \
  -F "expiresIn=3600" \
  -F "maxDownloads=5"
```

**Response (201):**

```json
{
  "id": "file-uuid",
  "token": "download-token",
  "downloadUrl": "http://localhost:8080/api/files/download-token/download",
  "viewUrl": "http://localhost:5173/view/download-token",
  "expiresAt": "2025-10-28T10:00:00.000Z",
  "maxDownloads": 5
}
```

### List User Files

**GET** `/files`

Get all files uploaded by the authenticated user.

**Auth:** Required

**Response (200):**

```json
{
  "files": [
    {
      "id": "file-uuid",
      "name": "example.txt",
      "size": 1024,
      "mimeType": "text/plain",
      "expiresAt": "2025-10-28T10:00:00.000Z",
      "downloadCount": 0,
      "maxDownloads": 5,
      "downloadUrl": "http://localhost:8080/api/files/token/download",
      "viewUrl": "http://localhost:5173/view/token"
    }
  ]
}
```

### Get File Metadata

**GET** `/files/{token}`

Get public metadata for a file.

**Auth:** Not required

**Response (200):**

```json
{
  "name": "example.txt",
  "size": 1024,
  "mimeType": "text/plain",
  "expiresAt": "2025-10-28T10:00:00.000Z",
  "downloadCount": 0,
  "remainingDownloads": 5,
  "maxDownloads": 5
}
```

### Download File

**GET** `/files/{token}/download`

Download the file.

**Auth:** Not required

**Response:** File binary data with appropriate headers.

### Delete File

**DELETE** `/files/{id}`

Delete a file (owner only).

**Auth:** Required

**Response (204):** No content

## Error Codes

- `400` - Bad Request (validation error)
- `401` - Unauthorized (auth required or invalid)
- `403` - Forbidden (not owner)
- `404` - Not Found (file doesn't exist)
- `410` - Gone (file expired or download limit reached)
- `500` - Internal Server Error

## Testing with Postman

1. **Register/Login** to get authenticated.
2. **Upload** a file using form-data.
3. **List files** to see your uploads.
4. **Use download URL** to test public access.
5. **Wait for expiry** and test 410 responses.

## Environment Variables

See `.env` file for configuration:

- Database: MySQL connection
- MinIO: S3-compatible storage
- JWT: Authentication secret
- Upload limits: Max file size

## Running the Server

```bash
# Install dependencies
npm install

# Run migrations
npx sequelize-cli db:migrate

# Start server
npm run dev
```

For Docker setup, see root `docker-compose.yml`.

## Background Jobs

- **Cleanup Job**: Runs every minute to delete expired files from database and MinIO storage.
- Uses `node-cron` for scheduling.

## Security Notes

- JWT tokens are httpOnly cookies
- File access is public via tokens (no auth required for downloads)
- Automatic cleanup prevents storage bloat
- Passwords are hashed with bcrypt</content>
  <parameter name="filePath">d:\leo\individual-project\cloud-file-expiry\server\README.md
