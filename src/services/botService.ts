import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { GetCommand, PutCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";

export type Session = {
  userId: string;
  step:
    | "add_language"
    | "add_specify_language"
    | "add_ru_word"
    | "add_translation"
    | "add_word_kind"
    | "find_query"
    | "search_value"
    | "note_add";
  language?: string;
  ruWord?: string;
  translation?: string;
  searchValue?: string;
  note?: string;
  expiresAt: number;
};

const dynamoClient = new DynamoDBClient({
  region: "eu-north-1", //process.env.AWS_REGION ?? "eu-north-1",
});

const botTableName = "yesenian-bot-state"; //process.env.BOT_TABLE_NAME ?? "BotState";

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
