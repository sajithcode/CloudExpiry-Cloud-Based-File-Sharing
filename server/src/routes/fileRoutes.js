const express = require("express");
const router = express.Router();
const fileController = require("../controllers/fileController");
const authMiddleware = require("../middlewares/authMiddleware");

// POST /api/files - Upload file (authenticated optional)
router.post(
  "/",
  authMiddleware,
  fileController.uploadMiddleware,
  fileController.create
);

// GET /api/files/:token - Get file metadata (public)
router.get("/:token", fileController.getMeta);

// GET /api/files/:token/download - Download file (public)
router.get("/:token/download", fileController.download);

// DELETE /api/files/:id - Delete file (authenticated, owner only)
router.delete("/:id", authMiddleware, fileController.delete);

// GET /api/files - List user's files (authenticated)
router.get("/", authMiddleware, fileController.listUserFiles);

module.exports = router;
