const multer = require("multer");
const fileService = require("../services/fileService");
const { getObjectStream } = require("../services/storageService");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: parseInt(process.env.MAX_UPLOAD_MB || "50") * 1024 * 1024,
  },
});

class FileController {
  // Middleware for file upload
  uploadMiddleware = upload.single("file");

  // POST /api/files - Upload file
  async create(req, res) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const file = req.file;
      if (!file) {
        return res.status(400).json({ error: "File is required" });
      }

      // Parse expiry
      let expiresAt;
      if (req.body.expiresAt) {
        expiresAt = new Date(req.body.expiresAt);
      } else if (req.body.expiresIn) {
        const seconds = parseInt(req.body.expiresIn, 10);
        if (!seconds || seconds <= 0) {
          return res.status(400).json({ error: "Invalid expiresIn value" });
        }
        expiresAt = new Date(Date.now() + seconds * 1000);
      } else {
        return res
          .status(400)
          .json({ error: "expiresAt or expiresIn is required" });
      }

      // Validate expiry is in future
      if (expiresAt <= new Date()) {
        return res
          .status(400)
          .json({ error: "Expiry time must be in the future" });
      }

      const maxDownloads = req.body.maxDownloads
        ? parseInt(req.body.maxDownloads, 10)
        : null;

      const fileRecord = await fileService.createFile(
        file.buffer,
        file.originalname,
        file.mimetype,
        file.size,
        expiresAt,
        req.user.userId,
        maxDownloads
      );

      res.status(201).json({
        id: fileRecord.id,
        token: fileRecord.download_token,
        downloadUrl: `${process.env.DOWNLOAD_BASE_URL}/api/files/${fileRecord.download_token}/download`,
        viewUrl: `${process.env.DOWNLOAD_BASE_URL}/api/files/${fileRecord.download_token}`,
        expiresAt: fileRecord.expires_at,
        maxDownloads: fileRecord.max_downloads,
      });
    } catch (error) {
      console.error("File upload error:", error);
      res.status(500).json({ error: "Upload failed" });
    }
  }

  // GET /api/files/:token - Get file metadata
  async getMeta(req, res) {
    try {
      const file = await fileService.getFileByToken(req.params.token);
      if (!file) {
        return res.status(404).json({ error: "File not found" });
      }

      // Check if expired
      if (file.expires_at <= new Date()) {
        return res.status(410).json({ error: "File has expired" });
      }

      // Check download limit
      const remainingDownloads = file.max_downloads
        ? Math.max(0, file.max_downloads - file.download_count)
        : null;

      if (file.max_downloads && remainingDownloads === 0) {
        return res.status(410).json({ error: "Download limit exceeded" });
      }

      res.json({
        name: file.original_name,
        size: file.size_bytes,
        mimeType: file.mime_type,
        expiresAt: file.expires_at,
        downloadCount: file.download_count,
        remainingDownloads: remainingDownloads,
        maxDownloads: file.max_downloads,
      });
    } catch (error) {
      console.error("Get file meta error:", error);
      res.status(500).json({ error: "Failed to get file metadata" });
    }
  }

  // GET /api/files/:token/download - Download file
  async download(req, res) {
    try {
      const file = await fileService.getFileByToken(req.params.token);
      if (!file) {
        return res.status(404).json({ error: "File not found" });
      }

      // Check if expired
      if (file.expires_at <= new Date()) {
        return res.status(410).json({ error: "File has expired" });
      }

      // Check download limit
      if (file.max_downloads && file.download_count >= file.max_downloads) {
        return res.status(410).json({ error: "Download limit exceeded" });
      }

      // Increment download count
      await fileService.incrementDownloadCount(file);

      // Stream file from MinIO
      const stream = await getObjectStream(file.storage_key);

      res.setHeader("Content-Type", file.mime_type);
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${file.original_name}"`
      );
      res.setHeader("Content-Length", file.size_bytes);

      stream.on("error", (error) => {
        console.error("Stream error:", error);
        if (!res.headersSent) {
          res.status(500).json({ error: "Download failed" });
        }
      });

      stream.pipe(res);
    } catch (error) {
      console.error("Download error:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: "Download failed" });
      }
    }
  }

  // DELETE /api/files/:id - Delete file (owner only)
  async delete(req, res) {
    try {
      const file = await fileService.getFileById(req.params.id, req.user?.id);
      if (!file) {
        return res.status(404).json({ error: "File not found" });
      }

      // Check ownership if user is authenticated
      if (req.user && file.user_id !== req.user.userId) {
        return res.status(403).json({ error: "Access denied" });
      }

      await fileService.deleteFile(file);
      res.status(204).end();
    } catch (error) {
      console.error("Delete file error:", error);
      res.status(500).json({ error: "Delete failed" });
    }
  }

  // GET /api/files - List user's files (authenticated)
  async listUserFiles(req, res) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const files = await fileService.getUserFiles(req.user.userId);

      res.json({
        files: files.map((file) => ({
          id: file.id,
          name: file.original_name,
          size: file.size_bytes,
          mimeType: file.mime_type,
          expiresAt: file.expires_at,
          downloadCount: file.download_count,
          maxDownloads: file.max_downloads,
          downloadUrl: `${process.env.DOWNLOAD_BASE_URL}/api/files/${file.download_token}/download`,
          viewUrl: `${process.env.DOWNLOAD_BASE_URL}/api/files/${file.download_token}`,
        })),
      });
    } catch (error) {
      console.error("List files error:", error);
      res.status(500).json({ error: "Failed to list files" });
    }
  }
}

module.exports = new FileController();
