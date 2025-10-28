const cron = require("node-cron");
const fileService = require("../services/fileService");

function startCleanup() {
  // Run every minute
  cron.schedule("* * * * *", async () => {
    try {
      console.log("Running cleanup job...");

      // Get expired files
      const expiredFiles = await fileService.getExpiredFiles();
      console.log(`Found ${expiredFiles.length} expired files`);

      // Get files that exceeded download limit
      const limitExceededFiles =
        await fileService.getFilesExceedingDownloadLimit();
      console.log(
        `Found ${limitExceededFiles.length} files exceeding download limit`
      );

      const allFilesToDelete = [...expiredFiles, ...limitExceededFiles];

      // Delete each file
      for (const file of allFilesToDelete) {
        try {
          await fileService.deleteFile(file);
          console.log(`Deleted file: ${file.id} (${file.original_name})`);
        } catch (error) {
          console.error(`Failed to delete file ${file.id}:`, error);
        }
      }

      if (allFilesToDelete.length > 0) {
        console.log(
          `Cleanup completed. Deleted ${allFilesToDelete.length} files.`
        );
      }
    } catch (error) {
      console.error("Cleanup job error:", error);
    }
  });

  console.log("Cleanup job scheduled to run every minute");
}

module.exports = { startCleanup };
