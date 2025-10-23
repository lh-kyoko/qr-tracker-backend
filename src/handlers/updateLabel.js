const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, UpdateCommand } = require("@aws-sdk/lib-dynamodb");
const { handleOptions, successResponse, errorResponse } = require("../utils/cors");

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return handleOptions();
  }

  const dynamodbClient = new DynamoDBClient({});
  const dynamodb = DynamoDBDocumentClient.from(dynamodbClient);

  try {
    const labelId = event.pathParameters.id;
    const body = JSON.parse(event.body);
    const { name, color, description } = body;

    if (!labelId) {
      return errorResponse("Label ID is required", 400);
    }

    const updateCommand = new UpdateCommand({
      TableName: process.env.LABELS_TABLE,
      Key: { id: labelId },
      UpdateExpression: "SET #name = :name, #color = :color, description = :description, updatedAt = :updatedAt",
      ExpressionAttributeNames: {
        "#name": "name",
        "#color": "color",
      },
      ExpressionAttributeValues: {
        ":name": name,
        ":color": color || "#0366d6",
        ":description": description || null,
        ":updatedAt": new Date().toISOString(),
      },
      ReturnValues: "ALL_NEW",
    });

    const result = await dynamodb.send(updateCommand);

    return successResponse({ label: result.Attributes }, 200);
  } catch (error) {
    console.error("Error updating label:", error);
    return errorResponse("Internal server error", 500);
  }
};

