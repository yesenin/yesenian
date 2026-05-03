terraform {
  required_providers {
    aws = {
      source = "hashicorp/aws"
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

resource "aws_apigatewayv2_api" "api" {
  name          = "yesenian-api"
  protocol_type = "HTTP"
}

resource "aws_apigatewayv2_integration" "getAllWords_integration" {
  api_id                 = aws_apigatewayv2_api.api.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.getAllWords_function.invoke_arn
  integration_method     = "GET"
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "getAllWords_route" {
  api_id    = aws_apigatewayv2_api.api.id
  route_key = "GET /words"
  target    = "integrations/${aws_apigatewayv2_integration.getAllWords_integration.id}"
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