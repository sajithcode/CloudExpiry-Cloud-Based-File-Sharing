const { v4: uuid } = require("uuid");
const { File } = require("../models");
const { putObject, removeObject } = require("./storageService");

class FileService {
  async createFile(
    fileBuffer,
    originalName,
    mimeType,
    size,
    expiresAt,
    userId = null,
    maxDownloads = null
  ) {
    const id = uuid();
    const downloadToken = uuid().replace(/-/g, "");
    const storageKey = `${id}-${originalName}`;

    // Upload to MinIO
    await putObject(storageKey, fileBuffer, {
      "Content-Type": mimeType,
      "Content-Length": size,
    });

    // Create database record
    const file = await File.create({
      id,
      user_id: userId,
      original_name: originalName,
      storage_key: storageKey,
      mime_type: mimeType,
      size_bytes: size,
      expires_at: expiresAt,
      download_token: downloadToken,
      max_downloads: maxDownloads,
    });

    return file;
  }

  async getFileByToken(token) {
    return await File.findOne({
      where: { download_token: token },
    });
  }

  async getFileById(id, userId = null) {
    const where = { id };
    if (userId) {
      where.user_id = userId;
    }
    return await File.findOne({ where });
  }

  async getUserFiles(userId) {
    return await File.findAll({
      where: { user_id: userId },
      order: [["created_at", "DESC"]],
    });
  }

  async incrementDownloadCount(file) {
    file.download_count += 1;
    await file.save();
  }

  async deleteFile(file) {
    // Delete from MinIO
    await removeObject(file.storage_key);
    // Delete from database
    await file.destroy();
  }

  async getExpiredFiles() {
    const now = new Date();
    return await File.findAll({
      where: {
        expires_at: {
          [require("sequelize").Op.lte]: now,
        },
      },
      limit: 200,
    });
  }

  async getFilesExceedingDownloadLimit() {
    return await File.findAll({
      where: {
        max_downloads: {
          [require("sequelize").Op.not]: null,
        },
        download_count: {
          [require("sequelize").Op.gte]:
            require("sequelize").col("max_downloads"),
        },
      },
      limit: 200,
    });
  }
}

module.exports = new FileService();
