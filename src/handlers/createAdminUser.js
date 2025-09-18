const { CognitoIdentityProviderClient, AdminCreateUserCommand, AdminSetUserPasswordCommand, AdminAddUserToGroupCommand } = require('@aws-sdk/client-cognito-identity-provider');
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
    const body = JSON.parse(event.body);
    const { username, email, password, group } = body;

    if (!username || !email || !password) {
      return errorResponse('ユーザー名、メールアドレス、パスワードが必要です', 400);
    }

    // ユーザー作成
    const createUserCommand = new AdminCreateUserCommand({
      UserPoolId: process.env.COGNITO_USER_POOL_ID,
      Username: username,
      UserAttributes: [
        {
          Name: 'email',
          Value: email,
        },
        {
          Name: 'email_verified',
          Value: 'true',
        }
      ],
      TemporaryPassword: password,
      MessageAction: 'SUPPRESS'
    });

    await cognitoClient.send(createUserCommand);

    // パスワードを永続化
    const setPasswordCommand = new AdminSetUserPasswordCommand({
      UserPoolId: process.env.COGNITO_USER_POOL_ID,
      Username: username,
      Password: password,
      Permanent: true
    });

    await cognitoClient.send(setPasswordCommand);

    // グループが指定されている場合はグループに追加
    if (group) {
      const addToGroupCommand = new AdminAddUserToGroupCommand({
        UserPoolId: process.env.COGNITO_USER_POOL_ID,
        Username: username,
        GroupName: group
      });

      await cognitoClient.send(addToGroupCommand);
    }

    return successResponse({
      success: true,
      message: 'ユーザーが作成されました',
      user: {
        username,
        email,
        group
      }
    });
  } catch (error) {
    console.error('Error creating admin user:', error);
    
    if (error.name === 'UsernameExistsException') {
      return errorResponse('ユーザー名が既に存在します', 409);
    } else if (error.name === 'InvalidPasswordException') {
      return errorResponse('パスワードが要件を満たしていません', 400);
    } else if (error.name === 'GroupNotFoundException') {
      return errorResponse('指定されたグループが見つかりません', 404);
    }
    
    return errorResponse('Internal server error', 500);
  }
};
