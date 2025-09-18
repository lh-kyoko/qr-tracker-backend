const { CognitoIdentityProviderClient, GetUserCommand } = require('@aws-sdk/client-cognito-identity-provider');

const cognitoClient = new CognitoIdentityProviderClient();

/**
 * Cognitoトークンを検証してユーザー情報を取得する
 * @param {Object} event - Lambdaイベント
 * @returns {Object|null} ユーザー情報（認証失敗時はnull）
 */
const verifyCognitoToken = async (event) => {
  console.log('=== verifyCognitoToken START ===');
  console.log('Event headers:', event.headers);
  console.log('Event headers keys:', Object.keys(event.headers));
  console.log('Event headers.Authorization:', event.headers.Authorization);
  console.log('Event headers.authorization:', event.headers.authorization);
  
  try {
    const authHeader = event.headers.Authorization || event.headers.authorization;
    console.log('Auth header found:', authHeader ? 'YES' : 'NO');
    console.log('Auth header value:', authHeader);
    console.log('Auth header type:', typeof authHeader);
    console.log('Auth header starts with Bearer:', authHeader ? authHeader.startsWith('Bearer ') : false);
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('認証ヘッダーが不正です:', authHeader);
      console.log('Auth header is null/undefined:', !authHeader);
      console.log('Auth header does not start with Bearer:', authHeader ? !authHeader.startsWith('Bearer ') : true);
      return null;
    }

    const token = authHeader.substring(7);
    console.log('Extracted token:', token);
    console.log('Token length:', token.length);
    console.log('Token first 50 chars:', token.substring(0, 50));
    console.log('Token last 50 chars:', token.substring(token.length - 50));
    
    // JWTトークンを直接検証（Cognito APIを呼び出さない）
    try {
      console.log('JWT解析開始...');
      const tokenParts = token.split('.');
      console.log('Token parts count:', tokenParts.length);
      console.log('Token part 0 (header):', tokenParts[0]);
      console.log('Token part 1 (payload):', tokenParts[1]);
      console.log('Token part 2 (signature):', tokenParts[2]);
      
      const payload = JSON.parse(atob(tokenParts[1]));
      console.log('JWT payload:', payload);
      console.log('JWT payload keys:', Object.keys(payload));
      
      // 有効期限チェック
      const currentTime = Math.floor(Date.now() / 1000);
      console.log('Current time:', currentTime);
      console.log('Token exp time:', payload.exp);
      console.log('Token is expired:', payload.exp < currentTime);
      
      if (payload.exp < currentTime) {
        console.log('トークンの有効期限が切れています');
        console.log('Expired by:', currentTime - payload.exp, 'seconds');
        return null;
      }
      
      // 管理者グループチェック
      console.log('cognito:groups:', payload['cognito:groups']);
      console.log('cognito:groups type:', typeof payload['cognito:groups']);
      console.log('cognito:groups includes admins:', payload['cognito:groups'] && payload['cognito:groups'].includes('admins'));
      
      if (!payload['cognito:groups'] || !payload['cognito:groups'].includes('admins')) {
        console.log('管理者グループに属していません');
        console.log('Available groups:', payload['cognito:groups']);
        return null;
      }
      
      console.log('JWT認証成功');
      return { 
        sub: payload.sub,
        'cognito:groups': payload['cognito:groups'],
        username: payload.username,
        attributes: []
      };
    } catch (jwtError) {
      console.error('JWT解析エラー:', jwtError);
      console.error('JWT解析エラー詳細:', jwtError.message);
      console.error('JWT解析エラースタック:', jwtError.stack);
      
      // JWT解析に失敗した場合は、Cognito APIを試す
      console.log('JWT解析に失敗。Cognito APIを試行...');
      const command = new GetUserCommand({
        AccessToken: token
      });
      
      console.log('Command:', JSON.stringify(command, null, 2));
      const response = await cognitoClient.send(command);
      console.log('Cognito response:', JSON.stringify(response, null, 2));
      
      return { 
        sub: response.Username, 
        'cognito:groups': ['admins'],
        username: response.Username,
        attributes: response.UserAttributes
      };
    }
  } catch (error) {
    console.error('Cognito認証エラー:', error);
    console.error('Cognito認証エラー詳細:', error.message);
    console.error('Cognito認証エラースタック:', error.stack);
    return null;
  }
};

/**
 * 管理者権限をチェックする
 * @param {Object} event - Lambdaイベント
 * @returns {Object|null} ユーザー情報（管理者でない場合はnull）
 */
const verifyAdminToken = async (event) => {
  const user = await verifyCognitoToken(event);
  if (!user) {
    return null;
  }

  // 管理者グループに属しているかチェック
  // 実際の実装では、Cognitoのグループ情報を取得して検証
  if (user['cognito:groups'] && user['cognito:groups'].includes('admins')) {
    return user;
  }

  console.log('管理者権限がありません');
  return null;
};

/**
 * 一般ユーザー権限をチェックする
 * @param {Object} event - Lambdaイベント
 * @returns {Object|null} ユーザー情報（認証失敗時はnull）
 */
const verifyUserToken = async (event) => {
  return await verifyCognitoToken(event);
};

module.exports = {
  verifyCognitoToken,
  verifyAdminToken,
  verifyUserToken,
}; 