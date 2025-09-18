const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const {
  handleOptions,
  successResponse,
  errorResponse,
} = require("../utils/cors");

const s3 = new S3Client();

exports.handler = async (event) => {
  // OPTIONSリクエスト（プリフライトリクエスト）の処理
  if (event.httpMethod === "OPTIONS") {
    return handleOptions();
  }

  // デバッグログを追加
  console.log("Event received:", JSON.stringify(event, null, 2));
  console.log("Event body:", event.body);
  console.log("Event body type:", typeof event.body);
  console.log("Event body length:", event.body ? event.body.length : 0);
  console.log("Event headers:", JSON.stringify(event.headers, null, 2));
  console.log("Is Base64 encoded:", event.isBase64Encoded);

  try {
    // event.bodyが空または無効な場合の処理
    if (!event.body) {
      console.error("Event body is empty or null");
      return errorResponse("Request body is required", 400);
    }

    // event.bodyが文字列でない場合の処理
    if (typeof event.body !== "string") {
      console.error("Event body is not a string:", typeof event.body);
      return errorResponse("Request body must be a string", 400);
    }

    // event.bodyが空文字列の場合の処理
    if (event.body.trim() === "") {
      console.error("Event body is empty string");
      return errorResponse("Request body cannot be empty", 400);
    }

    // Base64エンコードされている場合のデコード
    let decodedBody = event.body;
    if (event.isBase64Encoded) {
      console.log("Decoding Base64 encoded body");
      decodedBody = Buffer.from(event.body, "base64").toString("utf-8");
      console.log("Decoded body:", decodedBody);
    }

    console.log("Attempting to parse body:", decodedBody);
    const body = JSON.parse(decodedBody);
    console.log("Parsed body:", JSON.stringify(body, null, 2));

    const { fileName, fileType, boxId } = body;

    if (!fileName || !fileType || !boxId) {
      console.error("Missing required fields:", { fileName, fileType, boxId });
      return errorResponse("fileName, fileType, and boxId are required", 400);
    }

    // S3のキーを生成
    const key = `boxes/${boxId}/${Date.now()}-${fileName}`;

    console.log("Generating presigned URL with params:", {
      bucket: process.env.S3_BUCKET,
      key: key,
      contentType: fileType,
      metadata: {
        "box-id": boxId,
        "original-name": fileName,
      },
    });

    // Presigned URLを生成
    const command = new PutObjectCommand({
      Bucket: process.env.S3_BUCKET,
      Key: key,
      ContentType: fileType,
      Metadata: {
        "box-id": boxId,
        "original-name": fileName,
      },
    });

    const presignedUrl = await getSignedUrl(s3, command, { expiresIn: 3600 }); // 1時間有効

    console.log("Generated presigned URL:", presignedUrl);
    console.log("File key:", key);
    console.log("Bucket:", process.env.S3_BUCKET);

    return successResponse({
      uploadUrl: presignedUrl,
      fileKey: key,
      bucket: process.env.S3_BUCKET,
    });
  } catch (error) {
    console.error("Error details:", {
      message: error.message,
      stack: error.stack,
      name: error.name,
    });
    return errorResponse("Internal server error", 500);
  }
};
