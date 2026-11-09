import crypto from 'crypto';

const accountId = '85f5b4f1ae2b678fbec9d4c4ffcb470b';
const accessKeyId = '2d81718c4046726f6e54087b68ecf277';
const secretAccessKey = '8befb371500f1144f666e5bc805ec43167377441ce92a4bcdf87f14f2bb59dd8';
const bucketName = 'cham-chua-bai-ai';
const region = 'auto';
const service = 's3';

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

async function testUpload() {
  const testFileContent = Buffer.from('Hello Cloudflare R2 from Thanh Lan AI!');
  const objectKey = 'test-r2-connect.txt';
  const contentType = 'text/plain';

  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.substring(0, 8);

  const host = `${accountId}.r2.cloudflarestorage.com`;
  const endpoint = `https://${host}/${bucketName}/${objectKey}`;
  const payloadHash = hash(testFileContent);

  const canonicalUri = `/${bucketName}/${objectKey}`;
  const canonicalQuery = '';
  const canonicalHeaders = `content-length:${testFileContent.length}\ncontent-type:${contentType}\nhost:${host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`;
  const signedHeaders = 'content-length;content-type;host;x-amz-content-sha256;x-amz-date';

  const canonicalRequest = ['PUT', canonicalUri, canonicalQuery, canonicalHeaders, signedHeaders, payloadHash].join('\n');

  const algorithm = 'AWS4-HMAC-SHA256';
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = [algorithm, amzDate, credentialScope, hash(Buffer.from(canonicalRequest))].join('\n');

  const signingKey = getSignatureKey(secretAccessKey, dateStamp, region, service);
  const signature = crypto.createHmac('sha256', signingKey).update(stringToSign).digest('hex');

  const authorizationHeader = `${algorithm} Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const headers = {
    'content-length': testFileContent.length.toString(),
    'content-type': contentType,
    'host': host,
    'x-amz-content-sha256': payloadHash,
    'x-amz-date': amzDate,
    'Authorization': authorizationHeader,
  };

  console.log('Uploading to R2...');
  const res = await fetch(endpoint, {
    method: 'PUT',
    headers,
    body: testFileContent,
  });

  console.log('HTTP Status:', res.status, res.statusText);
  const text = await res.text();
  console.log('Body:', text);

  if (res.ok) {
    const pubUrl = `https://pub-2ed556299ae944038d0ad897c9ea8495.r2.dev/${objectKey}`;
    console.log('Testing public access at:', pubUrl);
    const pubRes = await fetch(pubUrl);
    console.log('Public fetch status:', pubRes.status);
    console.log('Public fetch text:', await pubRes.text());
  }
}

testUpload();

