const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, GetCommand } = require("@aws-sdk/lib-dynamodb");
const {
  CognitoIdentityProviderClient,
  AdminGetUserCommand,
} = require("@aws-sdk/client-cognito-identity-provider");
const {
  handleOptions,
  successResponse,
  errorResponse,
} = require("../utils/cors");

// AWS設定
const dynamodbConfig = {};
const cognitoConfig = {};

if (process.env.AWS_ENDPOINT_URL) {
  dynamodbConfig.endpoint = process.env.AWS_ENDPOINT_URL;
  cognitoConfig.endpoint = process.env.AWS_ENDPOINT_URL;
}

const dynamodbClient = new DynamoDBClient(dynamodbConfig);
const dynamodb = DynamoDBDocumentClient.from(dynamodbClient);
const cognito = new CognitoIdentityProviderClient(cognitoConfig);

// ユーザーIDからユーザー名を取得する関数
async function getUserName(userId) {
  try {
    // 開発環境ではユーザーIDから名前を生成
    if (process.env.AWS_ENDPOINT_URL) {
      return userId.split("-")[0]; // UUIDの最初の部分
    }

    const params = {
      UserPoolId: process.env.USER_POOL_ID,
      Username: userId,
    };

    const result = await cognito.send(new AdminGetUserCommand(params));

    // name属性があればそれを使用、なければemailの@より前の部分を使用
    const nameAttr = result.UserAttributes.find((attr) => attr.Name === "name");
    const emailAttr = result.UserAttributes.find(
      (attr) => attr.Name === "email"
    );

    if (nameAttr && nameAttr.Value) {
      return nameAttr.Value;
    } else if (emailAttr && emailAttr.Value) {
      return emailAttr.Value.split("@")[0];
    } else {
      return userId.split("-")[0]; // UUIDの最初の部分
    }
  } catch (error) {
    console.error("Error getting user name:", error);
    return userId.split("-")[0]; // フォールバック
  }
}

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

    const params = {
      TableName: process.env.BOXES_TABLE,
      Key: {
        id: boxId,
      },
    };

    const result = await dynamodb.send(new GetCommand(params));

    if (!result.Item) {
      return errorResponse("Box not found", 404);
    }

    // ユーザー名を取得
    const userName = await getUserName(result.Item.userId);

    // レスポンスにユーザー名を含める
    const boxData = {
      ...result.Item,
      userName: userName,
    };

    return successResponse({
      box: boxData,
    });
  } catch (error) {
    console.error("Error:", error);
    return errorResponse("Internal server error", 500);
  }
};
