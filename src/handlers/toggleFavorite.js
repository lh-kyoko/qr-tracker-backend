const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, GetCommand, UpdateCommand } = require("@aws-sdk/lib-dynamodb");
const { verifyUserToken } = require('../utils/auth');
const { handleOptions, successResponse, errorResponse } = require('../utils/cors');

const dynamodbClient = new DynamoDBClient({});
const dynamodb = DynamoDBDocumentClient.from(dynamodbClient);

exports.handler = async (event) => {
  try {
    const boxId = event.pathParameters.id;
    
    if (!boxId) {
      return {
        statusCode: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
        },
        body: JSON.stringify({
          error: 'Box ID is required'
        })
      };
    }

    const body = JSON.parse(event.body);
    const { userId, isFavorite } = body;

    if (!userId) {
      return {
        statusCode: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
        },
        body: JSON.stringify({
          error: 'User ID is required'
        })
      };
    }

    // BOXが存在するかチェック
    const getCommand = new GetCommand({
      TableName: process.env.BOXES_TABLE,
      Key: { id: boxId }
    });
    const existingBox = await dynamodb.send(getCommand);

    if (!existingBox.Item) {
      return {
        statusCode: 404,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
        },
        body: JSON.stringify({
          error: 'Box not found'
        })
      };
    }

    // 作成者かどうかチェック
    if (existingBox.Item.userId !== userId) {
      return {
        statusCode: 403,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
        },
        body: JSON.stringify({
          error: 'You can only toggle favorite for boxes you created'
        })
      };
    }

    const now = new Date().toISOString();

    // お気に入り状態を更新
    const updateCommand = new UpdateCommand({
      TableName: process.env.BOXES_TABLE,
      Key: { id: boxId },
      UpdateExpression: 'SET isFavorite = :isFavorite, updatedAt = :updatedAt',
      ExpressionAttributeValues: {
        ':isFavorite': isFavorite,
        ':updatedAt': now
      },
      ReturnValues: 'ALL_NEW'
    });

    const updateResult = await dynamodb.send(updateCommand);

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
      },
      body: JSON.stringify({
        message: 'Favorite status updated successfully',
        box: updateResult.Attributes
      })
    };

  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
      },
      body: JSON.stringify({
        error: 'Internal server error'
      })
    };
  }
}; 