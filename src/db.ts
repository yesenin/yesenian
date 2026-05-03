import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  ScanCommand,
  DeleteCommand,
} from "@aws-sdk/lib-dynamodb";

export type Word = {
  id: string;
  ru: string;
  sr_cyr?: string;
  sr_lat?: string;
  tags?: string[];
  addedAt: string;
  modifiedAt: string;
};

const dynamoClient = new DynamoDBClient({
  region: "eu-north-1", //process.env.AWS_REGION ?? "eu-north-1",
});

const docClient = DynamoDBDocumentClient.from(dynamoClient);

const tableName = "yesenian-vocabulary"; //process.env.WORDS_TABLE_NAME ?? "Words";

export class WordsService {
  async getAll(): Promise<Word[]> {
    const result = await docClient.send(
      new ScanCommand({
        TableName: tableName,
      }),
    );

    return (result.Items ?? []) as Word[];
  }

  async getById(id: string, language: string): Promise<Word | null> {
    const result = await docClient.send(
      new GetCommand({
        TableName: tableName,
        Key: {
          id,
          language,
        },
      }),
    );

    return result.Item ? (result.Item as Word) : null;
  }

  async create(word: Word): Promise<void> {
    await docClient.send(
      new PutCommand({
        TableName: tableName,
        Item: word,
      }),
    );
  }

  async delete(id: string, language: string): Promise<void> {
    await docClient.send(
      new DeleteCommand({
        TableName: tableName,
        Key: {
          id,
          language,
        },
      }),
    );
  }
}
