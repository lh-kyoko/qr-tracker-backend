const { S3Client, GetObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const crypto = require('crypto');
const {
  handleOptions,
  successResponse,
  errorResponse,
} = require("../utils/cors");
const { verifyAdminToken } = require("../utils/auth");

// AWS設定
const s3Config = {};

if (process.env.AWS_ENDPOINT_URL) {
  s3Config.endpoint = process.env.AWS_ENDPOINT_URL;
}

const s3Client = new S3Client(s3Config);

const parseS3Url = (url) => {
  try {
    // S3 URLの形式: https://bucket-name.s3.region.amazonaws.com/key
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.substring(1).split('/');
    const bucket = urlObj.hostname.split('.')[0];
    
    // URLデコードを適用してキーを取得
    let key = pathParts.join('/');
    console.log('デコード前のキー:', key);
    key = decodeURIComponent(key);
    console.log('デコード後のキー:', key);
    
    // さらにデコードが必要な場合（二重エンコードの可能性）
    const doubleDecodedKey = decodeURIComponent(key);
    console.log('二重デコード後のキー:', doubleDecodedKey);
    
    console.log('URL解析結果:', {
      originalUrl: url,
      hostname: urlObj.hostname,
      pathname: urlObj.pathname,
      bucket: bucket,
      key: key,
      doubleDecodedKey: doubleDecodedKey,
      pathParts: pathParts
    });
    
    // 二重デコードされたキーが異なる場合は、そちらを使用
    const finalKey = (key !== doubleDecodedKey) ? doubleDecodedKey : key;
    console.log('最終的なキー:', finalKey);
    
    return { bucket, key: finalKey };
  } catch (error) {
    console.error('S3 URL解析エラー:', error);
    return null;
  }
};

// CloudFront署名付きURLを生成する関数
const generateCloudFrontSignedUrl = (resource, expiresIn = 3600) => {
  try {
    const keyPairId = process.env.CLOUDFRONT_KEY_PAIR_ID;
    const privateKey = process.env.CLOUDFRONT_PRIVATE_KEY;
    const domainName = process.env.CLOUDFRONT_DOMAIN || 'files.nest-tag.com';

    if (!keyPairId || !privateKey) {
      console.log('CloudFront設定が不完全です。S3 presigned URLを使用します。');
      return null;
    }

    const expires = Math.floor(Date.now() / 1000) + expiresIn;
    const dateLessThan = new Date(expires * 1000).toISOString();
    
    // 署名用のポリシーを作成
    const policy = {
      Statement: [
        {
          Resource: `https://${domainName}${resource}`,
          Condition: {
            DateLessThan: {
              'AWS:EpochTime': expires
            }
          }
        }
      ]
    };

    const policyString = JSON.stringify(policy);
    const policyBase64 = Buffer.from(policyString).toString('base64');
    
    // 署名を生成
    const sign = crypto.createSign('RSA-SHA1');
    sign.update(policyBase64);
    const signature = sign.sign(privateKey, 'base64');

    // URLを構築
    const signedUrl = `https://${domainName}${resource}?Policy=${encodeURIComponent(policyBase64)}&Signature=${encodeURIComponent(signature)}&Key-Pair-Id=${keyPairId}`;
    
    console.log('CloudFront署名付きURL生成完了:', signedUrl);
    return signedUrl;
  } catch (error) {
    console.error('CloudFront署名付きURL生成エラー:', error);
    return null;
  }
};

exports.handler = async (event) => {
  // OPTIONSリクエスト（プリフライトリクエスト）の処理
  if (event.httpMethod === "OPTIONS") {
    return handleOptions();
  }

  // Cognito認証チェック
  const decoded = await verifyAdminToken(event);
  if (!decoded) {
    return errorResponse('認証が必要です', 401);
  }

  try {
    const body = JSON.parse(event.body);
    const { fileUrl } = body;

    if (!fileUrl) {
      return errorResponse('ファイルURLが必要です', 400);
    }

    console.log('ファイルURL:', fileUrl);

    // S3 URLを解析
    const s3Info = parseS3Url(fileUrl);
    if (!s3Info) {
      return errorResponse('無効なS3 URLです', 400);
    }

    console.log('S3情報:', s3Info);

    // CloudFront署名付きURLを生成
    const cloudFrontUrl = generateCloudFrontSignedUrl(`/${s3Info.key}`);
    
    if (cloudFrontUrl) {
      console.log('CloudFront署名付きURL生成完了');
      console.log('CloudFront URL:', cloudFrontUrl);
      
      return successResponse({
        presignedUrl: cloudFrontUrl,
        originalUrl: fileUrl,
      });
    }

    // CloudFront設定が不完全な場合は、S3 presigned URLを使用
    console.log('CloudFront設定が不完全です。S3 presigned URLを使用します。');
    
    // Presigned URLを生成
    const command = new GetObjectCommand({
      Bucket: s3Info.bucket,
      Key: s3Info.key,
    });

    const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 }); // 1時間有効

    console.log('S3 Presigned URL生成完了');
    console.log('S3 URL:', presignedUrl);

    return successResponse({
      presignedUrl: presignedUrl,
      originalUrl: fileUrl,
    });
  } catch (error) {
    console.error('Error generating presigned URL:', error);
    return errorResponse('Internal server error', 500);
  }
}; 