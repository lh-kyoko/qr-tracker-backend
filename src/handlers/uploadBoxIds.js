const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, BatchWriteCommand } = require("@aws-sdk/lib-dynamodb");
const {
  handleOptions,
  successResponse,
  errorResponse,
} = require("../utils/cors");
const { verifyAdminToken } = require("../utils/auth");

// AWS SDK v3設定
const client = new DynamoDBClient({});
const dynamoDb = DynamoDBDocumentClient.from(client);

const parseCSV = (csvContent) => {
  try {
    const lines = csvContent.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.trim());
    
    // ヘッダー行をスキップ
    const dataLines = lines.slice(1);
    
    const boxIds = [];
    for (const line of dataLines) {
      if (!line.trim()) continue; // 空行をスキップ
      
      const values = line.split(',').map(v => v.trim());
      if (values.length < 2) continue; // データが不足している行をスキップ
      
      const boxId = values[0];
      const activationDate = values[1];
      
      // 基本的なバリデーション
      if (boxId && activationDate) {
        boxIds.push({
          boxId,
          activationDate,
        });
      }
    }
    
    return boxIds;
  } catch (error) {
    console.error('CSV解析エラー:', error);
    throw new Error('CSVファイルの解析に失敗しました');
  }
};

exports.handler = async (event) => {
  // OPTIONSリクエスト（プリフライトリクエスト）の処理
  if (event.httpMethod === "OPTIONS") {
    return handleOptions();
  }

  // Cognito認証チェック
  const decoded = await verifyAdminToken(event);
  if (!decoded) {
    return errorResponse('認証が必要です', 401);
  }

  try {
    const body = JSON.parse(event.body);
    const { csvContent } = body;

    if (!csvContent) {
      return errorResponse('CSVコンテンツが必要です', 400);
    }

    console.log('CSVコンテンツ受信');

    // CSVを解析
    const boxIds = parseCSV(csvContent);
    console.log('解析されたBOXID数:', boxIds.length);

    if (boxIds.length === 0) {
      return errorResponse('有効なBOXIDデータが見つかりません', 400);
    }

    // DynamoDBに一括書き込み
    const now = new Date().toISOString();
    const writeRequests = boxIds.map(({ boxId, activationDate }) => ({
      PutRequest: {
        Item: {
          boxId: boxId,
          activationDate: activationDate,
          isActive: true,
          createdAt: now,
          updatedAt: now,
        },
      },
    }));

    // DynamoDBのBatchWriteは25件ずつに制限されているため、分割して処理
    const batchSize = 25;
    const batches = [];
    for (let i = 0; i < writeRequests.length; i += batchSize) {
      batches.push(writeRequests.slice(i, i + batchSize));
    }

    let successCount = 0;
    let errorCount = 0;

    for (const batch of batches) {
      try {
        const params = {
          RequestItems: {
            [process.env.BOX_IDS_TABLE]: batch,
          },
        };

        await dynamoDb.send(new BatchWriteCommand(params));
        successCount += batch.length;
        console.log('バッチ書き込み成功:', batch.length);
      } catch (error) {
        console.error('バッチ書き込みエラー:', error);
        errorCount += batch.length;
      }
    }

    console.log('BOXID一括登録完了');
    console.log('成功:', successCount, 'エラー:', errorCount);

    return successResponse({
      message: 'BOXIDの一括登録が完了しました',
      total: boxIds.length,
      success: successCount,
      errors: errorCount,
    });
  } catch (error) {
    console.error('Error uploading box IDs:', error);
    return errorResponse('Internal server error', 500);
  }
}; 