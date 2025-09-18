
const { CognitoIdentityProviderClient, ConfirmForgotPasswordCommand } = require("@aws-sdk/client-cognito-identity-provider");
const { handleOptions, successResponse, errorResponse } = require("../utils/cors");

// AWS設定
const cognitoConfig = {
  region: process.env.AWS_REGION || 'ap-northeast-1'
};

if (process.env.AWS_ENDPOINT_URL) {
  cognitoConfig.endpoint = process.env.AWS_ENDPOINT_URL;
}

// Cognitoクライアントを初期化
const cognito = new CognitoIdentityProviderClient(cognitoConfig);

exports.handler = async (event) => {
  // CORS preflight request
  if (event.httpMethod === 'OPTIONS') {
    return handleOptions();
  }

  try {
    const body = JSON.parse(event.body);
    const { email, code, newPassword } = body;

    if (!email || !code || !newPassword) {
      return errorResponse("Email, code, and new password are required", 400);
    }

    // 開発環境ではモックレスポンス
    if (process.env.AWS_ENDPOINT_URL) {
      console.log("Development mode: Mock password reset confirmation for email:", email);
      return {
        statusCode: 200,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers": "Content-Type",
          "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        },
        body: JSON.stringify({
          message: "Password reset successful (Development mode)",
        }),
      };
    }

    const params = {
      ClientId: process.env.COGNITO_CLIENT_ID,
      Username: email,
      ConfirmationCode: code,
      Password: newPassword,
    };

    console.log("Sending ConfirmForgotPasswordCommand for email:", email);
    await cognito.send(new ConfirmForgotPasswordCommand(params));

    const responseData = {
      message: "Password reset successful"
    };

    return successResponse(responseData, 200);
  } catch (error) {
    console.error("Error in confirmForgotPassword:", error);
    return errorResponse(error.message || "Internal server error", 500);
  }
};
