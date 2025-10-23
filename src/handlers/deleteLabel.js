const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, DeleteCommand } = require("@aws-sdk/lib-dynamodb");
const { handleOptions, successResponse, errorResponse } = require("../utils/cors");

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return handleOptions();
  }

  const dynamodbClient = new DynamoDBClient({});
  const dynamodb = DynamoDBDocumentClient.from(dynamodbClient);

  try {
    const labelId = event.pathParameters.id;

    if (!labelId) {
      return errorResponse("Label ID is required", 400);
    }

    const deleteCommand = new DeleteCommand({
      TableName: process.env.LABELS_TABLE,
      Key: { id: labelId },
    });

    await dynamodb.send(deleteCommand);

    return successResponse({ message: "Label deleted successfully" }, 200);
  } catch (error) {
    console.error("Error deleting label:", error);
    return errorResponse("Internal server error", 500);
  }
};

