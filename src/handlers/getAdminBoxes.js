const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, ScanCommand } = require("@aws-sdk/lib-dynamodb");
const { CognitoIdentityProviderClient, AdminGetUserCommand } = require("@aws-sdk/client-cognito-identity-provider");
const {
  handleOptions,
  successResponse,
  errorResponse,
} = require("../utils/cors");
const { verifyAdminToken } = require("../utils/auth");

// AWS設定
const dynamodbConfig = {};

if (process.env.AWS_ENDPOINT_URL) {
  dynamodbConfig.endpoint = process.env.AWS_ENDPOINT_URL;
}

const dynamodbClient = new DynamoDBClient(dynamodbConfig);
const dynamodb = DynamoDBDocumentClient.from(dynamodbClient);
const cognitoClient = new CognitoIdentityProviderClient();

exports.handler = async (event) => {
  console.log('=== getAdminBoxes handler START ===');
  console.log('Event:', JSON.stringify(event, null, 2));
  console.log('Event.httpMethod:', event.httpMethod);
  console.log('Event.headers:', event.headers);
  console.log('Event.pathParameters:', event.pathParameters);
  console.log('Event.queryStringParameters:', event.queryStringParameters);
  console.log('Event.body:', event.body);
  
  // OPTIONSリクエスト（プリフライトリクエスト）の処理
  if (event.httpMethod === "OPTIONS") {
    console.log('Handling OPTIONS request');
    return handleOptions();
  }

  // Cognito認証チェック
  const decoded = await verifyAdminToken(event);
  if (!decoded) {
    console.log('認証失敗');
    return errorResponse('認証が必要です', 401);
  }
  
  console.log('認証成功:', decoded);

  try {
    // DynamoDBからすべてのBOXを取得
    const scanParams = {
      TableName: process.env.BOXES_TABLE,
    };

    const result = await dynamodb.send(new ScanCommand(scanParams));
    const boxes = result.Items || [];

    // ユーザー情報を取得する関数
    const getUserInfo = async (userId) => {
      if (!userId) return null;
      try {
        const userCommand = new AdminGetUserCommand({
          Username: userId,
          UserPoolId: process.env.COGNITO_USER_POOL_ID,
        });
        const userResult = await cognitoClient.send(userCommand);
        const email = userResult.UserAttributes.find(attr => attr.Name === 'email')?.Value;
        const name = userResult.UserAttributes.find(attr => attr.Name === 'name')?.Value;
        return { email, name };
      } catch (error) {
        console.error(`Error getting user info for ${userId}:`, error);
        return null;
      }
    };

    // Box一覧を取得し、ユーザー情報も含める
    const boxesWithUsers = await Promise.all(
      boxes.map(async (box) => {
        const userInfo = await getUserInfo(box.userId);
        return {
          id: box.id,
          userId: box.userId,
          title: box.title,
          memo: box.memo,
          status: box.status,
          imageUrls: box.imageUrls || [],
          voiceMemoUrls: box.voiceMemoUrls || [],
          isFavorite: box.isFavorite || false,
          password: box.password,
          expiresAt: box.expiresAt,
          createdAt: box.createdAt,
          updatedAt: box.updatedAt,
          owner: userInfo,
        };
      })
    );

    // Box一覧を返す（統計は含めない）
    return successResponse({
      boxes: boxesWithUsers
    });
  } catch (error) {
    console.error('Error getting admin boxes:', error);
    return errorResponse('Internal server error', 500);
  }
}; 