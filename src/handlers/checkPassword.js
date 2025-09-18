const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({ region: 'ap-northeast-1' });
const dynamodb = DynamoDBDocumentClient.from(client);

exports.handler = async (event) => {
  console.log('checkPassword handler called with event:', JSON.stringify(event, null, 2));
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

    console.log('Parsing request body...');
    const body = JSON.parse(event.body);
    console.log('Request body:', JSON.stringify(body, null, 2));
    const { password } = body;

    if (!password) {
      return {
        statusCode: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
        },
        body: JSON.stringify({
          error: 'Password is required'
        })
      };
    }

    console.log('Checking if box exists...');
    console.log('BOXES_TABLE:', process.env.BOXES_TABLE);
    console.log('boxId:', boxId);
    // BOXが存在するかチェック
    const existingBox = await dynamodb.send(new GetCommand({
      TableName: process.env.BOXES_TABLE,
      Key: { id: boxId }
    }));
    console.log('DynamoDB response:', JSON.stringify(existingBox, null, 2));

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

    // パスワードが設定されているかチェック
    if (!existingBox.Item.password) {
      return {
        statusCode: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
        },
        body: JSON.stringify({
          error: 'This box is not password protected'
        })
      };
    }

    // パスワードをチェック
    if (existingBox.Item.password !== password) {
      return {
        statusCode: 401,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
        },
        body: JSON.stringify({
          error: 'Incorrect password'
        })
      };
    }

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
      },
      body: JSON.stringify({
        message: 'Password is correct',
        box: {
          id: existingBox.Item.id,
          title: existingBox.Item.title,
          memo: existingBox.Item.memo,
          status: existingBox.Item.status,
          imageUrls: existingBox.Item.imageUrls,
          voiceMemoUrls: existingBox.Item.voiceMemoUrls,
          isFavorite: existingBox.Item.isFavorite,
          userId: existingBox.Item.userId,
          createdAt: existingBox.Item.createdAt,
          updatedAt: existingBox.Item.updatedAt
        }
      })
    };

  } catch (error) {
    console.error('Error in checkPassword handler:', error);
    console.error('Error stack:', error.stack);
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