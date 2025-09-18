const AWS = require('aws-sdk');
const dynamodb = new AWS.DynamoDB.DocumentClient();

exports.handler = async (event) => {
  try {
    // DynamoDBからすべてのBOXを取得
    const scanParams = {
      TableName: process.env.BOXES_TABLE,
    };

    const result = await dynamodb.scan(scanParams).promise();
    const boxes = result.Items || [];

    // 統計データを計算
    const now = new Date();
    const stats = {
      total: boxes.length,
      active: 0,
      expired: 0,
      withPassword: 0,
      withFiles: 0,
    };

    boxes.forEach(box => {
      // アクティブ/期限切れの判定
      if (box.expiresAt) {
        const expiresAt = new Date(box.expiresAt);
        if (expiresAt > now) {
          stats.active++;
        } else {
          stats.expired++;
        }
      } else {
        stats.active++;
      }

      // パスワード保護の判定
      if (box.password) {
        stats.withPassword++;
      }

      // ファイル付きの判定
      if ((box.imageUrls && box.imageUrls.length > 0) || 
          (box.voiceMemoUrls && box.voiceMemoUrls.length > 0)) {
        stats.withFiles++;
      }
    });

    // エクスポートデータを構築
    const exportData = {
      exportDate: new Date().toISOString(),
      stats,
      boxes: boxes.map(box => ({
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
      }))
    };

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-User-Id',
        'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
      },
      body: JSON.stringify(exportData)
    };
  } catch (error) {
    console.error('Error exporting admin data:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-User-Id',
        'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
      },
      body: JSON.stringify({
        error: 'Internal server error'
      })
    };
  }
}; 