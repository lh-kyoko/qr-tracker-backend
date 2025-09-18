const fs = require("fs");
const path = require("path");

const handlersDir = path.join(__dirname, "src/handlers");
const files = fs
  .readdirSync(handlersDir)
  .filter((file) => file.endsWith(".js"));

files.forEach((file) => {
  const filePath = path.join(handlersDir, file);
  let content = fs.readFileSync(filePath, "utf8");

  // 既に共通化されているかチェック
  if (content.includes('require("../utils/cors")')) {
    console.log(`✅ ${file} - 既に共通化済み`);
    return;
  }

  // インポート追加
  if (content.includes('const AWS = require("aws-sdk");')) {
    content = content.replace(
      'const AWS = require("aws-sdk");',
      'const AWS = require("aws-sdk");\nconst { handleOptions, successResponse, errorResponse } = require("../utils/cors");'
    );
  }

  // OPTIONS処理を共通化
  content = content.replace(
    /if \(event\.httpMethod === "OPTIONS"\) \{[^}]*\}/s,
    'if (event.httpMethod === "OPTIONS") {\n    return handleOptions();\n  }'
  );

  // エラーレスポンスを共通化
  content = content.replace(
    /return \{\s*statusCode: (400|404|500),\s*headers: \{[^}]*\},\s*body: JSON\.stringify\(\{[^}]*\}\),\s*\};/g,
    (match, statusCode) => {
      return `return errorResponse("Error", ${statusCode});`;
    }
  );

  // 成功レスポンスを共通化
  content = content.replace(
    /return \{\s*statusCode: (200|201),\s*headers: \{[^}]*\},\s*body: JSON\.stringify\([^)]*\),\s*\};/g,
    (match, statusCode) => {
      return `return successResponse(data, ${statusCode});`;
    }
  );

  fs.writeFileSync(filePath, content);
  console.log(`✅ ${file} - 共通化完了`);
});

console.log("\n🎉 すべてのハンドラーのCORSヘッダーを共通化しました！");
console.log("次に `npx serverless deploy` を実行してください。");
