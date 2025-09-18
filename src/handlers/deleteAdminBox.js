const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, GetCommand, DeleteCommand } = require("@aws-sdk/lib-dynamodb");
const { S3Client, DeleteObjectsCommand } = require("@aws-sdk/client-s3");
const {
  handleOptions,
  successResponse,
  errorResponse,
} = require("../utils/cors");
const { verifyAdminToken } = require("../utils/auth");

// AWS設定
const dynamodbConfig = {};
const s3Config = {};

if (process.env.AWS_ENDPOINT_URL) {
  dynamodbConfig.endpoint = process.env.AWS_ENDPOINT_URL;
  s3Config.endpoint = process.env.AWS_ENDPOINT_URL;
}

const dynamodbClient = new DynamoDBClient(dynamodbConfig);
const dynamodb = DynamoDBDocumentClient.from(dynamodbClient);
const s3Client = new S3Client(s3Config);

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
    const { id } = event.pathParameters;

    // DynamoDBからBOXを取得
    const getCommand = new GetCommand({
      TableName: process.env.BOXES_TABLE,
      Key: { id }
    });

    const boxResult = await dynamodb.send(getCommand);
    if (!boxResult.Item) {
      return errorResponse('BOX not found', 404);
    }

    const box = boxResult.Item;

    // S3からファイルを削除
    const filesToDelete = [];
    
    // 画像ファイルを削除
    if (box.imageUrls && box.imageUrls.length > 0) {
      box.imageUrls.forEach(url => {
        const key = url.split('/').pop(); // URLからファイルキーを抽出
        filesToDelete.push({ Key: key });
      });
    }

    // 音声ファイルを削除
    if (box.voiceMemoUrls && box.voiceMemoUrls.length > 0) {
      box.voiceMemoUrls.forEach(url => {
        const key = url.split('/').pop(); // URLからファイルキーを抽出
        filesToDelete.push({ Key: key });
      });
    }

    // S3からファイルを削除
    if (filesToDelete.length > 0) {
      const deleteObjectsCommand = new DeleteObjectsCommand({
        Bucket: process.env.S3_BUCKET,
        Delete: {
          Objects: filesToDelete
        }
      });

      try {
        await s3Client.send(deleteObjectsCommand);
      } catch (s3Error) {
        console.error('S3ファイル削除エラー:', s3Error);
        // S3エラーでもDynamoDBからは削除を続行
      }
    }

    // DynamoDBからBOXを削除
    const deleteCommand = new DeleteCommand({
      TableName: process.env.BOXES_TABLE,
      Key: { id }
    });

    await dynamodb.send(deleteCommand);

    return successResponse({
      success: true,
      message: `BOX ${id} has been deleted successfully`
    });
  } catch (error) {
    console.error('Error deleting admin box:', error);
    return errorResponse('Internal server error', 500);
  }
}; 