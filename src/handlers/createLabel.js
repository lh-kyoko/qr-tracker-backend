const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, PutCommand } = require("@aws-sdk/lib-dynamodb");
const { handleOptions, successResponse, errorResponse } = require("../utils/cors");

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return handleOptions();
  }

  const dynamodbClient = new DynamoDBClient({});
  const dynamodb = DynamoDBDocumentClient.from(dynamodbClient);

  try {
    const body = JSON.parse(event.body);
    const { name, color, description, userId } = body;

    if (!name || !userId) {
      return errorResponse("Name and userId are required", 400);
    }

    const labelId = `custom-${Date.now()}`;
    const now = new Date().toISOString();

    const labelData = {
      id: labelId,
      userId: userId,
      name: name,
      color: color || "#0366d6",
      description: description || null,
      createdAt: now,
      updatedAt: now,
    };

    const putCommand = new PutCommand({
      TableName: process.env.LABELS_TABLE,
      Item: labelData,
    });

    await dynamodb.send(putCommand);

    return successResponse({ label: labelData }, 201);
  } catch (error) {
    console.error("Error creating label:", error);
    return errorResponse("Internal server error", 500);
  }
};

