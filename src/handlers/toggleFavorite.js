const AWS = require('aws-sdk');
const dynamodb = new AWS.DynamoDB.DocumentClient();
const { verifyUserToken } = require('../utils/auth');
const { handleOptions, successResponse, errorResponse } = require('../utils/cors');

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return handleOptions();
  }

  try {
    // 認証チェック
    const authResult = await verifyUserToken(event);
    if (!authResult.success) {
      return errorResponse(authResult.error, 401);
    }

    const boxId = event.pathParameters.id;
    
    if (!boxId) {
      return errorResponse('Box ID is required', 400);
    }

    const body = JSON.parse(event.body);
    const { userId, isFavorite } = body;

    if (!userId) {
      return errorResponse('User ID is required', 400);
    }

    // BOXが存在するかチェック
    const existingBox = await dynamodb.get({
      TableName: process.env.BOXES_TABLE,
      Key: { id: boxId }
    }).promise();

    if (!existingBox.Item) {
      return errorResponse('Box not found', 404);
    }

    // 作成者かどうかチェック
    if (existingBox.Item.userId !== userId) {
      return errorResponse('You can only toggle favorite for boxes you created', 403);
    }

    const now = new Date().toISOString();

    // お気に入り状態を更新
    const updateParams = {
      TableName: process.env.BOXES_TABLE,
      Key: { id: boxId },
      UpdateExpression: 'SET isFavorite = :isFavorite, updatedAt = :updatedAt',
      ExpressionAttributeValues: {
        ':isFavorite': isFavorite,
        ':updatedAt': now
      },
      ReturnValues: 'ALL_NEW'
    };

    const updateResult = await dynamodb.update(updateParams).promise();

    return successResponse({
      message: 'Favorite status updated successfully',
      box: updateResult.Attributes
    });

  } catch (error) {
    console.error('Error:', error);
    return errorResponse('Internal server error', 500);
  }
}; 