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

resource "aws_lambda_function" "getAllWords" {
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