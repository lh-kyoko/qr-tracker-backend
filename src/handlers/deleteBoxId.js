const { DynamoDBClient, DeleteCommand } = require("@aws-sdk/client-dynamodb");
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
    const boxId = event.pathParameters?.boxId;
    if (!boxId) {
      return errorResponse('BOXIDが必要です', 400);
    }

    const params = {
      TableName: process.env.BOX_IDS_TABLE,
      Key: {
        boxId: { S: boxId },
      },
    };

    await dynamoDb.send(new DeleteCommand(params));

    console.log('BOXID削除成功:', boxId);

    return successResponse({
      message: 'BOXIDが正常に削除されました',
      boxId,
    });
  } catch (error) {
    console.error('Error deleting box ID:', error);
    return errorResponse('Internal server error', 500);
  }
}; 