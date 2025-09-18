const { DynamoDBClient, ScanCommand } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient } = require("@aws-sdk/lib-dynamodb");
const {
  handleOptions,
  successResponse,
  errorResponse,
} = require("../utils/cors");
const { verifyAdminToken } = require("../utils/auth");

// AWS SDK v3設定
const client = new DynamoDBClient({});
const dynamoDb = DynamoDBDocumentClient.from(client);

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
    const params = {
      TableName: process.env.BOX_IDS_TABLE,
    };

    const result = await dynamoDb.send(new ScanCommand(params));

    const boxIds = result.Items.map(item => ({
      id: item.boxId.S,
      activationDate: item.activationDate.S,
      isActive: item.isActive ? item.isActive.BOOL : true,
      createdAt: item.createdAt.S,
      updatedAt: item.updatedAt.S,
    }));

    console.log('BOXID一覧取得成功:', boxIds.length);

    return successResponse({
      boxIds,
      total: boxIds.length,
    });
  } catch (error) {
    console.error('Error fetching box IDs:', error);
    return errorResponse('Internal server error', 500);
  }
}; 