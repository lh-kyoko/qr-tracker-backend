const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, GetCommand } = require("@aws-sdk/lib-dynamodb");
const {
  handleOptions,
  successResponse,
  errorResponse,
} = require("../utils/cors");

// AWS設定
const dynamodbConfig = {};

if (process.env.AWS_ENDPOINT_URL) {
  dynamodbConfig.endpoint = process.env.AWS_ENDPOINT_URL;
}

const dynamodbClient = new DynamoDBClient(dynamodbConfig);
const dynamodb = DynamoDBDocumentClient.from(dynamodbClient);

exports.handler = async (event) => {
  // OPTIONSリクエスト（プリフライトリクエスト）の処理
  if (event.httpMethod === "OPTIONS") {
    return handleOptions();
  }

  try {
    const boxId = event.pathParameters.id;

    if (!boxId) {
      return errorResponse("Box ID is required", 400);
    }

    // BOXが存在するかチェック
    const getCommand = new GetCommand({
      TableName: process.env.BOXES_TABLE,
      Key: { id: boxId },
    });

    const existingBoxResult = await dynamodb.send(getCommand);
    const existingBox = existingBoxResult.Item;

    if (!existingBox) {
      return errorResponse("Box not found", 404);
    }

    const now = new Date();
    const expiresAt = existingBox.expiresAt
      ? new Date(existingBox.expiresAt)
      : null;

    // 有効期限のチェック
    const isExpired = expiresAt && now > expiresAt;
    const daysUntilExpiration = expiresAt
      ? Math.ceil((expiresAt - now) / (1000 * 60 * 60 * 24))
      : null;

    return successResponse({
      isExpired,
      expiresAt: existingBox.expiresAt,
      daysUntilExpiration,
      message: isExpired ? "This box has expired" : "Box is still valid",
    });
  } catch (error) {
    console.error("Error:", error);
    return errorResponse("Internal server error", 500);
  }
};
