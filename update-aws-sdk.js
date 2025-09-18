const fs = require("fs");
const path = require("path");

const handlersDir = path.join(__dirname, "src/handlers");
const handlers = fs
  .readdirSync(handlersDir)
  .filter((file) => file.endsWith(".js"));

// AWS SDK v3 imports mapping
const sdkV3Imports = {
  "aws-sdk": {
    "DynamoDB.DocumentClient": {
      import:
        'const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");\nconst { DynamoDBDocumentClient } = require("@aws-sdk/lib-dynamodb");',
      client:
        "const dynamodbClient = new DynamoDBClient(dynamodbConfig);\nconst dynamodb = DynamoDBDocumentClient.from(dynamodbClient);",
    },
    CognitoIdentityServiceProvider: {
      import:
        'const { CognitoIdentityProviderClient } = require("@aws-sdk/client-cognito-identity-provider");',
      client:
        "const cognito = new CognitoIdentityProviderClient(cognitoConfig);",
    },
    S3: {
      import: 'const { S3Client } = require("@aws-sdk/client-s3");',
      client: "const s3 = new S3Client(s3Config);",
    },
  },
};

// Command mappings for AWS SDK v3
const commandMappings = {
  "dynamodb.get(params).promise()": "dynamodb.send(new GetCommand(params))",
  "dynamodb.put(params).promise()": "dynamodb.send(new PutCommand(params))",
  "dynamodb.query(params).promise()": "dynamodb.send(new QueryCommand(params))",
  "dynamodb.update(params).promise()":
    "dynamodb.send(new UpdateCommand(params))",
  "dynamodb.delete(params).promise()":
    "dynamodb.send(new DeleteCommand(params))",
  "cognito.adminGetUser(params).promise()":
    "cognito.send(new AdminGetUserCommand(params))",
  "cognito.adminCreateUser(params).promise()":
    "cognito.send(new AdminCreateUserCommand(params))",
  "cognito.adminSetUserPassword(params).promise()":
    "cognito.send(new AdminSetUserPasswordCommand(params))",
  "cognito.forgotPassword(params).promise()":
    "cognito.send(new ForgotPasswordCommand(params))",
  "cognito.confirmForgotPassword(params).promise()":
    "cognito.send(new ConfirmForgotPasswordCommand(params))",
  "cognito.initiateAuth(params).promise()":
    "cognito.send(new InitiateAuthCommand(params))",
  "cognito.respondToAuthChallenge(params).promise()":
    "cognito.send(new RespondToAuthChallengeCommand(params))",
  "s3.putObject(params).promise()": "s3.send(new PutObjectCommand(params))",
  "s3.getObject(params).promise()": "s3.send(new GetObjectCommand(params))",
  "s3.deleteObject(params).promise()":
    "s3.send(new DeleteObjectCommand(params))",
};

// Import mappings for commands
const importMappings = {
  GetCommand: "@aws-sdk/lib-dynamodb",
  PutCommand: "@aws-sdk/lib-dynamodb",
  QueryCommand: "@aws-sdk/lib-dynamodb",
  UpdateCommand: "@aws-sdk/lib-dynamodb",
  DeleteCommand: "@aws-sdk/lib-dynamodb",
  AdminGetUserCommand: "@aws-sdk/client-cognito-identity-provider",
  AdminCreateUserCommand: "@aws-sdk/client-cognito-identity-provider",
  AdminSetUserPasswordCommand: "@aws-sdk/client-cognito-identity-provider",
  ForgotPasswordCommand: "@aws-sdk/client-cognito-identity-provider",
  ConfirmForgotPasswordCommand: "@aws-sdk/client-cognito-identity-provider",
  InitiateAuthCommand: "@aws-sdk/client-cognito-identity-provider",
  RespondToAuthChallengeCommand: "@aws-sdk/client-cognito-identity-provider",
  PutObjectCommand: "@aws-sdk/client-s3",
  GetObjectCommand: "@aws-sdk/client-s3",
  DeleteObjectCommand: "@aws-sdk/client-s3",
};

function updateHandler(filePath) {
  console.log(`Updating ${filePath}...`);

  let content = fs.readFileSync(filePath, "utf8");
  let updated = false;

  // Replace AWS SDK v2 imports
  if (content.includes('const AWS = require("aws-sdk");')) {
    const imports = [];
    const clients = [];

    // Check what AWS services are used
    if (content.includes("AWS.DynamoDB.DocumentClient")) {
      imports.push(
        'const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");'
      );
      imports.push(
        'const { DynamoDBDocumentClient } = require("@aws-sdk/lib-dynamodb");'
      );
      clients.push(
        "const dynamodbClient = new DynamoDBClient(dynamodbConfig);"
      );
      clients.push(
        "const dynamodb = DynamoDBDocumentClient.from(dynamodbClient);"
      );
    }

    if (content.includes("AWS.CognitoIdentityServiceProvider")) {
      imports.push(
        'const { CognitoIdentityProviderClient } = require("@aws-sdk/client-cognito-identity-provider");'
      );
      clients.push(
        "const cognito = new CognitoIdentityProviderClient(cognitoConfig);"
      );
    }

    if (content.includes("AWS.S3")) {
      imports.push('const { S3Client } = require("@aws-sdk/client-s3");');
      clients.push("const s3 = new S3Client(s3Config);");
    }

    // Replace the import line
    const corsImport = content.match(
      /const \{\s*handleOptions,\s*successResponse,\s*errorResponse,\s*\} = require\("\.\.\/utils\/cors"\);/
    );
    if (corsImport) {
      content = content.replace(
        /const AWS = require\("aws-sdk"\);\s*const \{\s*handleOptions,\s*successResponse,\s*errorResponse,\s*\} = require\("\.\.\/utils\/cors"\);/,
        `${imports.join(
          "\n"
        )}\nconst {\n  handleOptions,\n  successResponse,\n  errorResponse,\n} = require("../utils/cors");`
      );
    } else {
      content = content.replace(
        /const AWS = require\("aws-sdk"\);/,
        imports.join("\n")
      );
    }

    // Replace client initialization
    content = content.replace(
      /const dynamodb = new AWS\.DynamoDB\.DocumentClient\(dynamodbConfig\);/,
      clients.join("\n")
    );

    content = content.replace(
      /const cognito = new AWS\.CognitoIdentityServiceProvider\(cognitoConfig\);/,
      ""
    );

    content = content.replace(/const s3 = new AWS\.S3\(s3Config\);/, "");

    updated = true;
  }

  // Replace method calls
  for (const [oldCall, newCall] of Object.entries(commandMappings)) {
    if (content.includes(oldCall)) {
      content = content.replace(
        new RegExp(oldCall.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"),
        newCall
      );
      updated = true;
    }
  }

  // Add missing imports for commands
  const usedCommands = [];
  for (const [command, package] of Object.entries(importMappings)) {
    if (content.includes(command)) {
      usedCommands.push(command);
    }
  }

  if (usedCommands.length > 0) {
    const existingImports =
      content.match(/const \{ [^}]+\} = require\("@aws-sdk\/[^"]+"\);/g) || [];
    const importLines = [];

    for (const importLine of existingImports) {
      const packageMatch = importLine.match(/require\("@aws-sdk\/([^"]+)"\)/);
      if (packageMatch) {
        const package = packageMatch[1];
        const commands = usedCommands.filter(
          (cmd) => importMappings[cmd] === `@aws-sdk/${package}`
        );
        if (commands.length > 0) {
          const existingCommands = importLine
            .match(/\{ ([^}]+) \}/)[1]
            .split(",")
            .map((c) => c.trim());
          const allCommands = [...new Set([...existingCommands, ...commands])];
          importLines.push(
            `const { ${allCommands.join(
              ", "
            )} } = require("@aws-sdk/${package}");`
          );
        } else {
          importLines.push(importLine);
        }
      }
    }

    // Replace existing imports
    for (const importLine of existingImports) {
      content = content.replace(importLine, "");
    }

    // Add new imports at the top
    const firstImportIndex = content.indexOf("const {");
    if (firstImportIndex !== -1) {
      content =
        content.slice(0, firstImportIndex) +
        importLines.join("\n") +
        "\n" +
        content.slice(firstImportIndex);
    }
  }

  if (updated) {
    fs.writeFileSync(filePath, content);
    console.log(`✓ Updated ${filePath}`);
  } else {
    console.log(`- No changes needed for ${filePath}`);
  }
}

// Update all handlers
handlers.forEach((handler) => {
  updateHandler(path.join(handlersDir, handler));
});

console.log("\nAll handlers updated!");
