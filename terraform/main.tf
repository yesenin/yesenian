terraform {
  backend "s3" {
    bucket         = "tfstate-yesenian-data1"
    key            = "app/terraform.tfstate"
    region         = "eu-north-1"
    use_lockfile   = true
    encrypt        = true
  }
  required_providers {
    aws = {
      source = "hashicorp/aws"
      version = ">= 6.43.0"
    }
  }
}

provider "aws" {
  region = "eu-north-1"
}

data "aws_iam_policy_document" "lambda_assume_role" {
  statement {
    effect = "Allow"
    actions = ["sts:AssumeRole"]
    principals {
        type = "Service"
        identifiers = ["lambda.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "commonRole" {
  name               = "lambda_execution_role"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume_role.json
}

resource "aws_iam_role_policy_attachment" "lambda_basic" {
  role       = aws_iam_role.commonRole.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_lambda_function" "getAllWords_function" {
  function_name    = "getAllWords"
  role             = aws_iam_role.commonRole.arn
  handler          = "index.getAllWordsHandler"
  runtime          = "nodejs22.x"
  filename         = "../src/dist/lambda.zip"
  source_code_hash = filebase64sha256("../src/dist/lambda.zip")

  depends_on = [
    aws_iam_role_policy_attachment.lambda_basic
  ]
}

resource "aws_lambda_function" "getWordById_function" {
  function_name    = "getWordById"
  role             = aws_iam_role.commonRole.arn
  handler          = "index.getWordByIdHandler"
  runtime          = "nodejs22.x"
  filename         = "../src/dist/lambda.zip"
  source_code_hash = filebase64sha256("../src/dist/lambda.zip")

  depends_on = [
    aws_iam_role_policy_attachment.lambda_basic
  ]
}

resource "aws_lambda_function" "addWord_function" {
  function_name    = "addWord"
  role             = aws_iam_role.commonRole.arn
  handler          = "index.addWordHandler"
  runtime          = "nodejs22.x"
  filename         = "../src/dist/lambda.zip"
  source_code_hash = filebase64sha256("../src/dist/lambda.zip")

  depends_on = [
    aws_iam_role_policy_attachment.lambda_basic
  ]
}

resource "aws_apigatewayv2_api" "api" {
  name          = "yesenian-api"
  protocol_type = "HTTP"

  cors_configuration {
    allow_origins = [
      "https://yesenin.github.io",
      "http://localhost:5173"
    ]

    allow_methods = [
      "GET",
      "POST",
      "PUT",
      "DELETE",
      "OPTIONS"
    ]

    allow_headers = [
      "content-type",
      "authorization"
    ]

    max_age = 3600
  }
}

resource "aws_apigatewayv2_integration" "getAllWords_integration" {
  api_id                 = aws_apigatewayv2_api.api.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.getAllWords_function.invoke_arn
  integration_method     = "POST"
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_integration" "getWordById_integration" {
  api_id                 = aws_apigatewayv2_api.api.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.getWordById_function.invoke_arn
  integration_method     = "POST"
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_integration" "addWord_integration" {
  api_id                 = aws_apigatewayv2_api.api.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.addWord_function.invoke_arn
  integration_method     = "POST"
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "getAllWords_route" {
  api_id    = aws_apigatewayv2_api.api.id
  route_key = "GET /words"
  target    = "integrations/${aws_apigatewayv2_integration.getAllWords_integration.id}"
}

resource "aws_apigatewayv2_route" "getWordById_route" {
  api_id    = aws_apigatewayv2_api.api.id
  route_key = "GET /words/{id}"
  target    = "integrations/${aws_apigatewayv2_integration.getWordById_integration.id}"
}

resource "aws_apigatewayv2_route" "addWord_route" {
  api_id    = aws_apigatewayv2_api.api.id
  route_key = "POST /words"
  target    = "integrations/${aws_apigatewayv2_integration.addWord_integration.id}"
}

resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.api.id
  name        = "$default"
  auto_deploy = true
}

resource "aws_lambda_permission" "getAllWords_permission" {
  statement_id  = "AllowAPIGatewayInvokeGetAllWords"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.getAllWords_function.function_name
  principal     = "apigateway.amazonaws.com"

  source_arn = "${aws_apigatewayv2_api.api.execution_arn}/*/*"
}

resource "aws_lambda_permission" "getWordById_permission" {
  statement_id  = "AllowAPIGatewayInvokeGetWordById"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.getWordById_function.function_name
  principal     = "apigateway.amazonaws.com"

  source_arn = "${aws_apigatewayv2_api.api.execution_arn}/*/*"
}

resource "aws_lambda_permission" "addWord_permission" {
  statement_id  = "AllowAPIGatewayInvokeAddWord"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.addWord_function.function_name
  principal     = "apigateway.amazonaws.com"

  source_arn = "${aws_apigatewayv2_api.api.execution_arn}/*/*"
}

resource "aws_dynamodb_table" "yesenian_vocabulary_table" {
  name         = "yesenian-vocabulary"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "language"
  range_key    = "id"

  attribute {
    name = "id"
    type = "S"
  }

  attribute {
    name = "language"
    type = "S"
  }
}

data "aws_iam_policy_document" "yesenian_vocabulary_table_lambda_policy" {
  statement {
    effect = "Allow"

    actions = [
      "dynamodb:GetItem",
      "dynamodb:PutItem",
      "dynamodb:UpdateItem",
      "dynamodb:DeleteItem",
      "dynamodb:Scan",
      "dynamodb:Query"
    ]

    resources = [
      aws_dynamodb_table.yesenian_vocabulary_table.arn,
      "${aws_dynamodb_table.yesenian_vocabulary_table.arn}/index/*"
    ]
  }
}

resource "aws_iam_policy" "yesenian_vocabulary_table_lambda_policy" {
  name   = "yesenian-vocabulary-table-lambda-policy"
  policy = data.aws_iam_policy_document.yesenian_vocabulary_table_lambda_policy.json
}

resource "aws_iam_role_policy_attachment" "yesenian_vocabulary_table_lambda_policy_attachment" {
  role       = aws_iam_role.commonRole.name
  policy_arn = aws_iam_policy.yesenian_vocabulary_table_lambda_policy.arn
}

resource "aws_lambda_function" "telegram" {
  function_name    = "telegramBot"
  role             = aws_iam_role.commonRole.arn
  handler          = "index.botHandler"
  runtime          = "nodejs22.x"
  filename         = "../src/dist/lambda.zip"
  source_code_hash = filebase64sha256("../src/dist/lambda.zip")

  depends_on = [
    aws_iam_role_policy_attachment.lambda_basic
  ]
}

resource "aws_apigatewayv2_route" "telegram" {
  api_id    = aws_apigatewayv2_api.api.id
  route_key = "POST /telegram"
  target    = "integrations/${aws_apigatewayv2_integration.telegram.id}"
}

resource "aws_apigatewayv2_integration" "telegram" {
  api_id                 = aws_apigatewayv2_api.api.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.telegram.invoke_arn
  payload_format_version = "2.0"
}

resource "aws_lambda_permission" "allow_apigw_telegram" {
  statement_id  = "AllowAPIGatewayInvokeTelegram"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.telegram.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.api.execution_arn}/*/*"
}

resource "aws_dynamodb_table" "yesenian_bot_table" {
  name         = "yesenian-bot-state"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "userId"

  attribute {
    name = "userId"
    type = "S"
  }

  ttl {
    attribute_name = "expiresAt"
    enabled        = true
  }
}

resource "aws_iam_role_policy" "ddb_access" {
  role = aws_iam_role.commonRole.id

  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Effect = "Allow",
        Action = [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:DeleteItem"
        ],
        Resource = aws_dynamodb_table.yesenian_bot_table.arn
      }
    ]
  })
}