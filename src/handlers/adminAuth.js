const { CognitoIdentityProviderClient, AdminInitiateAuthCommand, AdminGetUserCommand, AdminListGroupsForUserCommand } = require('@aws-sdk/client-cognito-identity-provider');
const {
  handleOptions,
  successResponse,
  errorResponse,
} = require("../utils/cors");

const cognitoClient = new CognitoIdentityProviderClient();

exports.handler = async (event) => {
  // OPTIONSリクエスト（プリフライトリクエスト）の処理
  if (event.httpMethod === "OPTIONS") {
    return handleOptions();
  }

  try {
    const body = JSON.parse(event.body);
    const { email, password } = body;

    if (!email || !password) {
      return errorResponse('メールアドレスとパスワードが必要です', 400);
    }

    // Cognitoで認証
    const authCommand = new AdminInitiateAuthCommand({
      AuthFlow: 'ADMIN_NO_SRP_AUTH',
      ClientId: process.env.COGNITO_CLIENT_ID,
      UserPoolId: process.env.COGNITO_USER_POOL_ID,
      AuthParameters: {
        USERNAME: email,
        PASSWORD: password,
      },
    });

    const authResult = await cognitoClient.send(authCommand);

    if (authResult.AuthenticationResult) {
      // ユーザー情報を取得
      const userCommand = new AdminGetUserCommand({
        Username: email,
        UserPoolId: process.env.COGNITO_USER_POOL_ID,
      });

      const userResult = await cognitoClient.send(userCommand);
      
      // 管理者グループに所属しているかチェック
      const groupsCommand = new AdminListGroupsForUserCommand({
        Username: email,
        UserPoolId: process.env.COGNITO_USER_POOL_ID,
      });

      const groupsResult = await cognitoClient.send(groupsCommand);
      const isAdmin = groupsResult.Groups.some(group => group.GroupName === 'admin' || group.GroupName === 'admins');

      if (!isAdmin) {
        return errorResponse('管理者権限がありません', 403);
      }

      return successResponse({
        token: authResult.AuthenticationResult.IdToken,
        accessToken: authResult.AuthenticationResult.AccessToken,
        user: {
          email: email,
          role: 'admin',
          groups: groupsResult.Groups.map(g => g.GroupName)
        }
      });
    } else {
      return errorResponse('認証に失敗しました', 401);
    }
  } catch (error) {
    console.error('Admin auth error:', error);
    
    if (error.name === 'NotAuthorizedException') {
      return errorResponse('メールアドレスまたはパスワードが正しくありません', 401);
    } else if (error.name === 'UserNotFoundException') {
      return errorResponse('ユーザーが見つかりません', 404);
    } else if (error.name === 'UserNotConfirmedException') {
      return errorResponse('ユーザーが確認されていません', 400);
    }
    
    return errorResponse('認証エラーが発生しました', 500);
  }
}; 