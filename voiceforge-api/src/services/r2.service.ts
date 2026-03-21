import AWS from 'aws-sdk';
import { config } from '../config';

// R2 is S3-compatible - using AWS SDK v2 (working model)
const s3 = new AWS.S3({
  endpoint: config.r2.endpoint,
  accessKeyId: config.r2.accessKey,
  secretAccessKey: config.r2.secretKey,
  region: 'auto',
  signatureVersion: 'v4',
});

const BUCKET_NAME = config.r2.bucket;

function wrapR2Error(operation: string, key: string, err: any): Error {
  const details = {
    operation,
    bucket: BUCKET_NAME,
    key,
    code: err?.code,
    statusCode: err?.statusCode,
    message: err?.message
  };
  console.error('[R2]', details);
  const error = new Error(`R2 ${operation} failed: ${err?.message || 'Unknown error'}`);
  (error as any).cause = err;
  (error as any).r2 = details;
  return error;
}

export async function uploadToR2(
  key: string,
  buffer: Buffer,
  contentType: string
): Promise<void> {
  const params = {
    Bucket: BUCKET_NAME,
    Key: key,
    Body: buffer,
    ContentType: contentType || 'application/octet-stream',
  };
  try {
    await s3.putObject(params).promise();
  } catch (err: any) {
    throw wrapR2Error('putObject', key, err);
  }
}

export async function getFileFromR2(key: string): Promise<AWS.S3.GetObjectOutput> {
  const params = {
    Bucket: BUCKET_NAME,
    Key: key,
  };
  try {
    return await s3.getObject(params).promise();
  } catch (err: any) {
    throw wrapR2Error('getObject', key, err);
  }
}

export async function getPresignedUrl(key: string, expiresIn = 3600): Promise<string> {
  try {
    return await s3.getSignedUrlPromise('getObject', {
      Bucket: BUCKET_NAME,
      Key: key,
      Expires: expiresIn
    });
  } catch (err: any) {
    throw wrapR2Error('getSignedUrl', key, err);
  }
}

export async function deleteFromR2(key: string): Promise<void> {
  const params = {
    Bucket: BUCKET_NAME,
    Key: key,
  };
  try {
    await s3.deleteObject(params).promise();
  } catch (err: any) {
    throw wrapR2Error('deleteObject', key, err);
  }
}

export async function listFilesFromR2(prefix?: string): Promise<AWS.S3.ObjectList> {
  const params: AWS.S3.ListObjectsV2Request = {
    Bucket: BUCKET_NAME,
    Prefix: prefix,
  };
  try {
    const data = await s3.listObjectsV2(params).promise();
    return data.Contents || [];
  } catch (err: any) {
    throw wrapR2Error('listObjectsV2', prefix || '', err);
  }
}

// Key generators - all files go under voiceforge/ directory
export function r2DocKey(userId: string, docId: string, filename: string): string {
  // Sanitize filename to avoid invalid characters
  const safeFilename = filename
    .replace(/[/\\?%*:|"<>]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 120);
  return `voiceforge/users/${userId}/docs/${docId}-${safeFilename}`;
}

export function r2ScrapeKey(userId: string, docId: string): string {
  return `voiceforge/users/${userId}/scrapes/${docId}.txt`;
}

export function r2CsvKey(userId: string, campaignId: string): string {
  return `voiceforge/campaigns/${userId}/${campaignId}.csv`;
}

export function r2AgentKey(userId: string, agentId: string, filename: string): string {
  const safeFilename = filename
    .replace(/[/\\?%*:|"<>]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 120);
  return `voiceforge/users/${userId}/agents/${agentId}/${safeFilename}`;
}
