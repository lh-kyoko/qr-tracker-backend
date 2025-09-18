// CORSヘッダーの共通化
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "Content-Type, X-Amz-Date, Authorization, X-Api-Key, X-Amz-Security-Token, X-Amz-User-Agent",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

// OPTIONSリクエストの共通レスポンス
const handleOptions = () => {
  return {
    statusCode: 200,
    headers: corsHeaders,
    body: "",
  };
};

// 成功レスポンスの共通化
const successResponse = (data, statusCode = 200) => {
  return {
    statusCode,
    headers: corsHeaders,
    body: JSON.stringify(data),
  };
};

// エラーレスポンスの共通化
const errorResponse = (message, statusCode = 500) => {
  return {
    statusCode,
    headers: corsHeaders,
    body: JSON.stringify({
      error: message,
    }),
  };
};

module.exports = {
  corsHeaders,
  handleOptions,
  successResponse,
  errorResponse,
};
