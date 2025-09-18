const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  QueryCommand,
} = require("@aws-sdk/lib-dynamodb");
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

const client = new DynamoDBClient(dynamodbConfig);
const dynamodb = DynamoDBDocumentClient.from(client);

exports.handler = async (event) => {
  // OPTIONSリクエスト（プリフライトリクエスト）の処理
  if (event.httpMethod === "OPTIONS") {
    return handleOptions();
  }

  console.log(
    "getUserBoxes handler called with event - UPDATED:",
    JSON.stringify(event, null, 2)
  );

  try {
    const userId = event.queryStringParameters?.userId;
    console.log("User ID:", userId);

    if (!userId) {
      console.log("User ID is missing");
      return errorResponse("User ID is required", 400);
    }

    console.log("Environment variables:", {
      BOXES_TABLE: process.env.BOXES_TABLE,
      AWS_REGION: process.env.AWS_REGION,
    });

    const params = {
      TableName: process.env.BOXES_TABLE,
      IndexName: "userId-index",
      KeyConditionExpression: "userId = :userId",
      ExpressionAttributeValues: {
        ":userId": userId,
      },
      ScanIndexForward: false, // 最新のものから取得
    };

    console.log("DynamoDB query params:", JSON.stringify(params, null, 2));
    const command = new QueryCommand(params);
    const result = await dynamodb.send(command);
    console.log("DynamoDB query result:", JSON.stringify(result, null, 2));

    return successResponse({
      boxes: result.Items || [],
      count: result.Count || 0,
    });
  } catch (error) {
    console.error("Error in getUserBoxes:", error);
    console.error("Error stack:", error.stack);
    return errorResponse("Internal server error", 500);
  }
};
