const { CognitoIdentityProviderClient, AdminUpdateUserAttributesCommand, AdminSetUserPasswordCommand, AdminRemoveUserFromGroupCommand, AdminAddUserToGroupCommand, AdminListGroupsForUserCommand } = require('@aws-sdk/client-cognito-identity-provider');
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
    const body = JSON.parse(event.body);
    const { email, password, group } = body;

    if (!username) {
      return errorResponse('ユーザー名が必要です', 400);
    }

    // ユーザー属性を更新
    const updateAttributes = [];
    if (email) {
      updateAttributes.push({
        Name: 'email',
        Value: email,
      });
    }

    if (updateAttributes.length > 0) {
      const updateUserCommand = new AdminUpdateUserAttributesCommand({
        UserPoolId: process.env.COGNITO_USER_POOL_ID,
        Username: username,
        UserAttributes: updateAttributes,
      });

      await cognitoClient.send(updateUserCommand);
    }

    // パスワードが指定されている場合は更新
    if (password) {
      const setPasswordCommand = new AdminSetUserPasswordCommand({
        UserPoolId: process.env.COGNITO_USER_POOL_ID,
        Username: username,
        Password: password,
        Permanent: true
      });

      await cognitoClient.send(setPasswordCommand);
    }

    // グループが指定されている場合はグループを更新
    if (group !== undefined) {
      // 現在のグループを取得
      const listGroupsCommand = new AdminListGroupsForUserCommand({
        UserPoolId: process.env.COGNITO_USER_POOL_ID,
        Username: username,
      });

      const groupsResult = await cognitoClient.send(listGroupsCommand);
      const currentGroups = groupsResult.Groups.map(g => g.GroupName);

      // 既存のグループから削除
      for (const currentGroup of currentGroups) {
        const removeFromGroupCommand = new AdminRemoveUserFromGroupCommand({
          UserPoolId: process.env.COGNITO_USER_POOL_ID,
          Username: username,
          GroupName: currentGroup
        });

        await cognitoClient.send(removeFromGroupCommand);
      }

      // 新しいグループに追加（空文字列でない場合のみ）
      if (group) {
        const addToGroupCommand = new AdminAddUserToGroupCommand({
          UserPoolId: process.env.COGNITO_USER_POOL_ID,
          Username: username,
          GroupName: group
        });

        await cognitoClient.send(addToGroupCommand);
      }
    }

    return successResponse({
      success: true,
      message: 'ユーザーが更新されました',
      user: {
        username,
        email,
        group
      }
    });
  } catch (error) {
    console.error('Error updating admin user:', error);
    
    if (error.name === 'UserNotFoundException') {
      return errorResponse('ユーザーが見つかりません', 404);
    } else if (error.name === 'InvalidPasswordException') {
      return errorResponse('パスワードが要件を満たしていません', 400);
    } else if (error.name === 'GroupNotFoundException') {
      return errorResponse('指定されたグループが見つかりません', 404);
    }
    
    return errorResponse('Internal server error', 500);
  }
};
