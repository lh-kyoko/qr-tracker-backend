const { CognitoIdentityProviderClient, AdminDeleteUserCommand } = require('@aws-sdk/client-cognito-identity-provider');
const {
  handleOptions,
  successResponse,
  errorResponse,
} = require("../utils/cors");
const { verifyAdminToken } = require("../utils/auth");

const cognitoClient = new CognitoIdentityProviderClient();

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
    const username = event.pathParameters?.username;

    if (!username) {
      return errorResponse('ユーザー名が必要です', 400);
    }

    // 自分自身を削除しようとしている場合は拒否
    if (username === decoded.username) {
      return errorResponse('自分自身を削除することはできません', 400);
    }

    // ユーザー削除
    const deleteUserCommand = new AdminDeleteUserCommand({
      UserPoolId: process.env.COGNITO_USER_POOL_ID,
      Username: username,
    });

    await cognitoClient.send(deleteUserCommand);

    return successResponse({
      success: true,
      message: 'ユーザーが削除されました',
      username: username
    });
  } catch (error) {
    console.error('Error deleting admin user:', error);
    
    if (error.name === 'UserNotFoundException') {
      return errorResponse('ユーザーが見つかりません', 404);
    }
    
    return errorResponse('Internal server error', 500);
  }
};
