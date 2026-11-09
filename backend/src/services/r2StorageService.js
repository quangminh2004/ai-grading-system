import crypto from 'crypto';
import path from 'path';

function getR2Config() {
  return {
    accountId: (process.env.R2_ACCOUNT_ID || '').trim(),
    accessKeyId: (process.env.R2_ACCESS_KEY_ID || '').trim(),
    secretAccessKey: (process.env.R2_SECRET_ACCESS_KEY || '').trim(),
    bucketName: (process.env.R2_BUCKET_NAME || 'cham-chua-bai-ai').trim(),
    publicUrl: (process.env.R2_PUBLIC_URL || '').trim().replace(/\/+$/, ''),
  };
}

export function isR2Configured() {
  const { accountId, accessKeyId, secretAccessKey, publicUrl } = getR2Config();
  return Boolean(accountId && accessKeyId && secretAccessKey && publicUrl);
}

function hmac(key, str) {
  return crypto.createHmac('sha256', key).update(str).digest();
}

function hash(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

function getSignatureKey(key, dateStamp, regionName, serviceName) {
  const kDate = hmac('AWS4' + key, dateStamp);
  const kRegion = hmac(kDate, regionName);
  const kService = hmac(kRegion, serviceName);
  return hmac(kService, 'aws4_request');
}

/**
 * Tải một Buffer ảnh lên Cloudflare R2 qua chuẩn AWS SigV4
 * @param {Buffer} buffer - Dữ liệu tệp
 * @param {string} filename - Tên tệp (unique)
 * @param {string} contentType - Loại mime (ví dụ image/jpeg)
 * @returns {Promise<string>} Đường link HTTPS công khai vĩnh viễn trên R2
 */
export async function uploadBufferToR2(buffer, filename, contentType = 'image/jpeg') {
  const { accountId, accessKeyId, secretAccessKey, bucketName, publicUrl } = getR2Config();
  if (!isR2Configured()) {
    throw new Error('Chưa cấu hình đầy đủ biến môi trường Cloudflare R2.');
  }

  const region = 'auto';
  const service = 's3';
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.substring(0, 8);

  const host = `${accountId}.r2.cloudflarestorage.com`;
  const endpoint = `https://${host}/${bucketName}/${encodeURIComponent(filename)}`;
  const payloadHash = hash(buffer);

  const canonicalUri = `/${bucketName}/${encodeURIComponent(filename)}`;
  const canonicalQuery = '';
  const canonicalHeaders = `content-length:${buffer.length}\ncontent-type:${contentType}\nhost:${host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`;
  const signedHeaders = 'content-length;content-type;host;x-amz-content-sha256;x-amz-date';

  const canonicalRequest = ['PUT', canonicalUri, canonicalQuery, canonicalHeaders, signedHeaders, payloadHash].join('\n');
  const algorithm = 'AWS4-HMAC-SHA256';
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = [algorithm, amzDate, credentialScope, hash(Buffer.from(canonicalRequest))].join('\n');

  const signingKey = getSignatureKey(secretAccessKey, dateStamp, region, service);
  const signature = crypto.createHmac('sha256', signingKey).update(stringToSign).digest('hex');

  const authorizationHeader = `${algorithm} Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const headers = {
    'content-length': buffer.length.toString(),
    'content-type': contentType,
    'host': host,
    'x-amz-content-sha256': payloadHash,
    'x-amz-date': amzDate,
    'Authorization': authorizationHeader,
  };

  const res = await fetch(endpoint, {
    method: 'PUT',
    headers,
    body: buffer,
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Cloudflare R2 upload thất bại (${res.status} ${res.statusText}): ${errorText}`);
  }

  const fileUrl = `${publicUrl}/${filename}`;
  console.log(`☁️ [Cloudflare R2] Đã tải lên thành công: ${fileUrl}`);
  return fileUrl;
}

/**
 * Xóa một tệp trên Cloudflare R2
 * @param {string} fileUrlOrKey - Đường dẫn file hoặc URL
 */
export async function deleteFromR2(fileUrlOrKey) {
  if (!isR2Configured() || !fileUrlOrKey) return false;
  const { accountId, accessKeyId, secretAccessKey, bucketName, publicUrl } = getR2Config();

  try {
    let key = fileUrlOrKey;
    if (key.startsWith('http')) {
      key = key.replace(`${publicUrl}/`, '').replace(/^\/+/, '');
    }

    const region = 'auto';
    const service = 's3';
    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
    const dateStamp = amzDate.substring(0, 8);

    const host = `${accountId}.r2.cloudflarestorage.com`;
    const endpoint = `https://${host}/${bucketName}/${encodeURIComponent(key)}`;
    const payloadHash = hash(Buffer.from(''));

    const canonicalUri = `/${bucketName}/${encodeURIComponent(key)}`;
    const canonicalQuery = '';
    const canonicalHeaders = `host:${host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`;
    const signedHeaders = 'host;x-amz-content-sha256;x-amz-date';

    const canonicalRequest = ['DELETE', canonicalUri, canonicalQuery, canonicalHeaders, signedHeaders, payloadHash].join('\n');
    const algorithm = 'AWS4-HMAC-SHA256';
    const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
    const stringToSign = [algorithm, amzDate, credentialScope, hash(Buffer.from(canonicalRequest))].join('\n');

    const signingKey = getSignatureKey(secretAccessKey, dateStamp, region, service);
    const signature = crypto.createHmac('sha256', signingKey).update(stringToSign).digest('hex');

    const authorizationHeader = `${algorithm} Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

    const headers = {
      'host': host,
      'x-amz-content-sha256': payloadHash,
      'x-amz-date': amzDate,
      'Authorization': authorizationHeader,
    };

    const res = await fetch(endpoint, {
      method: 'DELETE',
      headers,
    });

    if (res.ok) {
      console.log(`🗑️ [Cloudflare R2] Đã xóa tệp: ${key}`);
      return true;
    }
  } catch (err) {
    console.warn('Lỗi khi xóa file trên Cloudflare R2:', err.message);
  }
  return false;
}

