import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  ScanCommand,
  DeleteCommand,
} from "@aws-sdk/lib-dynamodb";
import { Word } from "./models";

const dynamoClient = new DynamoDBClient({
  region: "eu-north-1", //process.env.AWS_REGION ?? "eu-north-1",
});

const docClient = DynamoDBDocumentClient.from(dynamoClient);

const vocabularyTableName = "yesenian-vocabulary"; //process.env.WORDS_TABLE_NAME ?? "Words";

const botTableName = "yesenian-bot-state"; //process.env.BOT_TABLE_NAME ?? "BotState";

export class WordsService {
  async getAll(): Promise<Word[]> {
    const result = await docClient.send(
      new ScanCommand({
        TableName: vocabularyTableName,
      }),
    );

    return (result.Items ?? []) as Word[];
  }

  async getById(id: string, language: string): Promise<Word | null> {
    const result = await docClient.send(
      new GetCommand({
        TableName: vocabularyTableName,
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
        TableName: vocabularyTableName,
        Item: word,
      }),
    );
  }

  async delete(id: string, language: string): Promise<void> {
    await docClient.send(
      new DeleteCommand({
        TableName: vocabularyTableName,
        Key: {
          id,
          language,
        },
      }),
    );
  }
}

export type Session = {
  userId: string;
  step: "language" | "ru_word" | "translation" | "word_kind";
  language?: string;
  ruWord?: string;
  translation?: string;
  expiresAt: number;
};

export class BotService {
  async getSession(userId: number): Promise<Session | null> {
    const res = await dynamoClient.send(
      new GetCommand({
        TableName: botTableName,
        Key: { userId: String(userId) },
      }),
    );

    return (res.Item as Session) ?? null;
  }

  async saveSession(session: Session) {
    await dynamoClient.send(
      new PutCommand({
        TableName: botTableName,
        Item: session,
      }),
    );
  }

  async deleteSession(userId: number) {
    await dynamoClient.send(
      new DeleteCommand({
        TableName: botTableName,
        Key: { userId: String(userId) },
      }),
    );
  }
}
