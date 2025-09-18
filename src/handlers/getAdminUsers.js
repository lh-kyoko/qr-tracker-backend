const { CognitoIdentityProviderClient, ListUsersCommand, AdminListGroupsForUserCommand } = require('@aws-sdk/client-cognito-identity-provider');
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
    // Cognitoユーザー一覧を取得
    const listUsersCommand = new ListUsersCommand({
      UserPoolId: process.env.COGNITO_USER_POOL_ID,
    });

    const result = await cognitoClient.send(listUsersCommand);
    const users = result.Users || [];

    // 各ユーザーのグループ情報を取得
    const usersWithGroups = await Promise.all(
      users.map(async (user) => {
        try {
          const groupsCommand = new AdminListGroupsForUserCommand({
            Username: user.Username,
            UserPoolId: process.env.COGNITO_USER_POOL_ID,
          });

          const groupsResult = await cognitoClient.send(groupsCommand);
          const groups = groupsResult.Groups.map(group => group.GroupName);

          return {
            username: user.Username,
            email: user.Attributes.find(attr => attr.Name === 'email')?.Value || '',
            status: user.UserStatus,
            enabled: user.Enabled,
            userCreateDate: user.UserCreateDate,
            lastModifiedDate: user.UserLastModifiedDate,
            groups: groups,
          };
        } catch (error) {
          console.error(`Error getting groups for user ${user.Username}:`, error);
          return {
            username: user.Username,
            email: user.Attributes.find(attr => attr.Name === 'email')?.Value || '',
            status: user.UserStatus,
            enabled: user.Enabled,
            userCreateDate: user.UserCreateDate,
            lastModifiedDate: user.UserLastModifiedDate,
            groups: [],
          };
        }
      })
    );

    return successResponse({
      users: usersWithGroups
    });
  } catch (error) {
    console.error('Error getting admin users:', error);
    return errorResponse('Internal server error', 500);
  }
};
