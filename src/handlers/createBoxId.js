const { DynamoDBClient, PutCommand } = require("@aws-sdk/client-dynamodb");
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
    const body = JSON.parse(event.body);
    const { boxId, activationDate } = body;

    if (!boxId || !activationDate) {
      return errorResponse('BOXIDとアクティベーション期限が必要です', 400);
    }

    const now = new Date().toISOString();
    const params = {
      TableName: process.env.BOX_IDS_TABLE,
      Item: {
        boxId: { S: boxId },
        activationDate: { S: activationDate },
        isActive: { BOOL: true },
        createdAt: { S: now },
        updatedAt: { S: now },
      },
    };

    await dynamoDb.send(new PutCommand(params));

    console.log('BOXID作成成功:', boxId);

    return successResponse({
      message: 'BOXIDが正常に作成されました',
      boxId,
      activationDate,
    });
  } catch (error) {
    console.error('Error creating box ID:', error);
    return errorResponse('Internal server error', 500);
  }
}; 