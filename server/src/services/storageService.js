const Minio = require("minio");
const {
  MINIO_ENDPOINT,
  MINIO_PORT,
  MINIO_ACCESS_KEY,
  MINIO_SECRET_KEY,
  MINIO_USE_SSL,
  MINIO_BUCKET,
} = process.env;

const minioClient = new Minio.Client({
  endPoint: MINIO_ENDPOINT,
  port: parseInt(MINIO_PORT, 10),
  useSSL: MINIO_USE_SSL === "true",
  accessKey: MINIO_ACCESS_KEY,
  secretKey: MINIO_SECRET_KEY,
});

async function ensureBucket() {
  const exists = await minioClient
    .bucketExists(MINIO_BUCKET)
    .catch(() => false);
  if (!exists) {
    await minioClient.makeBucket(MINIO_BUCKET, "us-east-1");
  }
}

async function putObject(storageKey, buffer, meta) {
  await minioClient.putObject(MINIO_BUCKET, storageKey, buffer, meta);
}

async function removeObject(storageKey) {
  try {
    await minioClient.removeObject(MINIO_BUCKET, storageKey);
  } catch (e) {
    if (e.code !== "NoSuchKey") throw e;
  }
}

async function getObjectStream(storageKey) {
  return minioClient.getObject(MINIO_BUCKET, storageKey);
}

module.exports = {
  minioClient,
  ensureBucket,
  putObject,
  removeObject,
  getObjectStream,
};
