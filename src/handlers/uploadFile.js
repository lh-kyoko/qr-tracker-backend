const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
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

  try {
    // event.bodyが空または無効な場合の処理
    if (!event.body) {
      console.error("Event body is empty or null");
      return errorResponse("Request body is required", 400);
    }

    const body = JSON.parse(event.body);
    console.log("Parsed body:", JSON.stringify(body, null, 2));

    const { fileName, fileType, fileData, boxId } = body;

    if (!fileName || !fileType || !fileData || !boxId) {
      console.error("Missing required fields:", {
        fileName,
        fileType,
        fileData: !!fileData,
        boxId,
      });
      return errorResponse(
        "fileName, fileType, fileData, and boxId are required",
        400
      );
    }

    // Base64データをデコード
    const buffer = Buffer.from(fileData, "base64");

    // S3にアップロード
    const key = `boxes/${boxId}/${Date.now()}-${fileName}`;
    const uploadParams = {
      Bucket: process.env.S3_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: fileType,
      Metadata: {
        "box-id": boxId,
        "original-name": fileName,
      },
    };

    console.log("S3 upload params:", JSON.stringify(uploadParams, null, 2));

    const uploadResult = await s3.send(new PutObjectCommand(uploadParams));

    return successResponse({
      message: "File uploaded successfully",
      fileUrl: uploadResult.Location,
      fileKey: key,
    });
  } catch (error) {
    console.error("Error:", error);
    return errorResponse("Internal server error", 500);
  }
};
