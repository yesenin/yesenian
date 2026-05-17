import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  ScanCommand,
  DeleteCommand,
} from "@aws-sdk/lib-dynamodb";
import { Note, Word } from "../models";

const dynamoClient = new DynamoDBClient({
  region: "eu-north-1", //process.env.AWS_REGION ?? "eu-north-1",
});

const docClient = DynamoDBDocumentClient.from(dynamoClient);

const vocabularyTableName = "yesenian-vocabulary"; //process.env.WORDS_TABLE_NAME ?? "Words";
const notesTableName = "yesenian-queue"; //process.env.NOTES_TABLE_NAME ?? "Notes";

export class WordsService {
  async scan(ruQuery: string): Promise<Word[]> {
    const result = await docClient.send(
      new ScanCommand({
        TableName: vocabularyTableName,
        FilterExpression: "contains(ru, :ruQuery)",
        ExpressionAttributeValues: {
          ":ruQuery": ruQuery,
        },
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

  async getRandom(): Promise<Word | null> {
    const result = await docClient.send(
      new ScanCommand({
        TableName: vocabularyTableName,
        ProjectionExpression: "id, #lang",
        ExpressionAttributeNames: {
          "#lang": "language",
        },
      }),
    );
    const items = result.Items ?? [];

    const randomItem = items[Math.floor(Math.random() * items.length)];
    const word = await docClient.send(
      new GetCommand({
        TableName: vocabularyTableName,
        Key: {
          id: randomItem.id,
          language: randomItem.language,
        },
      }),
    );
    return word.Item ? (word.Item as Word) : null;
  }
}

export class NotesService {
  async create(note: Note): Promise<void> {
    await docClient.send(
      new PutCommand({
        TableName: notesTableName,
        Item: note,
      }),
    );
  }

  async getAll(): Promise<Note[]> {
    const result = await docClient.send(
      new ScanCommand({
        TableName: notesTableName,
      }),
    );

    return (result.Items ?? []) as Note[];
  }
}
