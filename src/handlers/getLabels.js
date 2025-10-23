const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, QueryCommand } = require("@aws-sdk/lib-dynamodb");
const { handleOptions, successResponse, errorResponse } = require("../utils/cors");
const { verifyUserToken } = require("../utils/auth");

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return handleOptions();
  }

  const dynamodbClient = new DynamoDBClient({});
  const dynamodb = DynamoDBDocumentClient.from(dynamodbClient);

  try {
    // 認証チェック（一般ユーザー）
    const decoded = await verifyUserToken(event);
    if (!decoded) {
      return errorResponse('認証が必要です', 401);
    }
    const userId = decoded.sub; // Cognitoから取得したユーザーID

    // クエリパラメータのuserIdは無視し、認証されたユーザーIDを使用
    console.log("Authenticated userId:", userId);

    const queryCommand = new QueryCommand({
      TableName: process.env.LABELS_TABLE,
      IndexName: "userId-index",
      KeyConditionExpression: "userId = :userId",
      ExpressionAttributeValues: {
        ":userId": userId,
      },
    });

    const result = await dynamodb.send(queryCommand);

    return successResponse({
      labels: result.Items || [],
      count: result.Count || 0,
    });
  } catch (error) {
    console.error("Error getting labels:", error);
    return errorResponse("Internal server error", 500);
  }
};

