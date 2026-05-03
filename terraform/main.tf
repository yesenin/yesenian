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
}

resource "aws_apigatewayv2_integration" "getAllWords_integration" {
  api_id                 = aws_apigatewayv2_api.api.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.getAllWords_function.invoke_arn
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