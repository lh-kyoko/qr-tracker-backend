const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  UpdateCommand,
} = require("@aws-sdk/lib-dynamodb");
const {
  handleOptions,
  successResponse,
  errorResponse,
} = require("../utils/cors");

exports.handler = async (event) => {
  // OPTIONSリクエスト（プリフライトリクエスト）の処理
  if (event.httpMethod === "OPTIONS") {
    return handleOptions();
  }

  // AWS設定
  const dynamodbConfig = {};
  if (process.env.AWS_ENDPOINT_URL) {
    dynamodbConfig.endpoint = process.env.AWS_ENDPOINT_URL;
  }
  const dynamodbClient = new DynamoDBClient(dynamodbConfig);
  const dynamodb = DynamoDBDocumentClient.from(dynamodbClient);

  try {
    console.log("Event received:", JSON.stringify(event, null, 2));

    const boxId = event.pathParameters.id;

    if (!boxId) {
      return errorResponse("Box ID is required", 400);
    }

    console.log("Event body:", event.body);
    console.log("Event body type:", typeof event.body);
    console.log("Is Base64 encoded:", event.isBase64Encoded);

    // Base64エンコードされている場合のデコード
    let decodedBody = event.body;
    if (event.isBase64Encoded) {
      console.log("Decoding Base64 encoded body");
      decodedBody = Buffer.from(event.body, "base64").toString("utf-8");
      console.log("Decoded body:", decodedBody);
    }

    const body = JSON.parse(decodedBody);
    console.log("Parsed body:", body);
    console.log("Image URLs:", body.imageUrls);
    console.log("Voice memo URLs:", body.voiceMemoUrls);
    const {
      title,
      memo,
      imageUrls,
      voiceMemoUrls,
      isFavorite,
      password,
      expiresAt,
      labels,
    } = body;

    console.log("Extracted data:", {
      title,
      memo,
      imageUrls,
      voiceMemoUrls,
      isFavorite,
      password,
      expiresAt,
      labels,
    });

    // 認証情報からユーザーIDを取得
    // 開発環境ではリクエストヘッダーから取得
    let userId;
    // リクエストヘッダーからユーザーIDを取得（開発・本番共通）
    userId = event.headers["x-user-id"] || event.headers["X-User-Id"];
    if (!userId) {
      return errorResponse("User ID is required", 401);
    }

    if (!title) {
      return errorResponse("title is required", 400);
    }

    // --- BOXIDバリデーション（将来有効化する場合はコメント解除） ---
    // console.log("Validating BOXID:", boxId);
    // const boxIdValidation = await validateBoxId(boxId);
    // if (!boxIdValidation.valid) {
    //   console.log("BOXID validation failed:", boxIdValidation.message);
    //   return errorResponse(boxIdValidation.message, 400);
    // }
    // console.log("BOXID validation passed");
    // --- ここまで ---

    // 既存のBOXをチェック
    const getCommand = new GetCommand({
      TableName: process.env.BOXES_TABLE,
      Key: { id: boxId },
    });

    console.log("Checking existing box...");
    const existingBox = await dynamodb.send(getCommand);

    console.log("Existing box result:", existingBox);

    if (existingBox.Item) {
      console.log("Box already exists, updating...");
      // 既存のBOXを更新
      const updateCommand = new UpdateCommand({
        TableName: process.env.BOXES_TABLE,
        Key: { id: boxId },
        UpdateExpression:
          "SET title = :title, memo = :memo, imageUrls = :imageUrls, voiceMemoUrls = :voiceMemoUrls, isFavorite = :isFavorite, password = :password, expiresAt = :expiresAt, labels = :labels, updatedAt = :updatedAt",
        ExpressionAttributeValues: {
          ":title": title || "",
          ":memo": memo || "",
          ":imageUrls": imageUrls || [],
          ":voiceMemoUrls": voiceMemoUrls || [],
          ":isFavorite": isFavorite || false,
          ":password": password || null,
          ":expiresAt": expiresAt || null,
          ":labels": labels || [],
          ":updatedAt": new Date().toISOString(),
        },
        ReturnValues: "ALL_NEW",
      });

      console.log("Update command:", updateCommand);
      const result = await dynamodb.send(updateCommand);
      console.log("Update result:", result);

      return successResponse({ box: result.Attributes }, 200);
    } else {
      console.log("Creating new box...");
      // 新しいBOXを作成
      const boxData = {
        id: boxId,
        userId: userId,
        title: title || "",
        memo: memo || "",
        imageUrls: imageUrls || [],
        voiceMemoUrls: voiceMemoUrls || [],
        isFavorite: isFavorite || false,
        password: password || null,
        expiresAt: expiresAt || null,
        labels: labels || [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      console.log("Saving box data:", boxData);
      console.log("Image URLs to save:", boxData.imageUrls);
      console.log("Voice memo URLs to save:", boxData.voiceMemoUrls);

      const putCommand = new PutCommand({
        TableName: process.env.BOXES_TABLE,
        Item: boxData,
      });

      console.log("Put command:", putCommand);
      await dynamodb.send(putCommand);
      console.log("Box saved successfully");

      return successResponse({ box: boxData }, 201);
    }
  } catch (error) {
    console.error("Error:", error);
    return errorResponse("Internal server error", 500);
  }
};
