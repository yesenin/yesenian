import { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { WordsService } from "./db";
import { Word } from "./models";
import { nanoid } from "nanoid";
import { z } from "zod";

const wordService = new WordsService();

export const getAllWordsHandler: APIGatewayProxyHandlerV2 = async (event) => {
  const words = await wordService.getAll();
  return {
    statusCode: 200,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      words,
    }),
  };
};

export const getWordByIdHandler: APIGatewayProxyHandlerV2 = async (event) => {
  const id = event.pathParameters?.id;
  if (!id) {
    return {
      statusCode: 400,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message: "Missing 'id' path parameter" }),
    };
  }
  const word = await wordService.getById(id, "ru");
  if (!word) {
    return {
      statusCode: 404,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message: "Word not found" }),
    };
  }
  return {
    statusCode: 200,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(word),
  };
};

interface AddWordRequest {
  ru: string;
  language: string;
  quickTranslation: string;
  kind: string;
}

const AddWordRequestSchema = z.object({
  ru: z.string().min(2),
  language: z.string().min(2),
  quickTranslation: z.string().min(2),
  kind: z.string().min(2),
});

export const addWordHandler: APIGatewayProxyHandlerV2 = async (event) => {
  const { body } = event;
  const parsedBody: AddWordRequest = body ? JSON.parse(body) : null;
  if (!parsedBody) {
    return {
      statusCode: 400,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message: "Missing request body" }),
    };
  }

  const validationResult = AddWordRequestSchema.safeParse(parsedBody);
  if (!validationResult.success) {
    return {
      statusCode: 400,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        message: "Invalid request body",
        issues: validationResult.error.issues,
      }),
    };
  }

  const newWord: Word = {
    id: nanoid(8),
    ru: parsedBody.ru.toLowerCase(),
    language: parsedBody.language,
    translations: [
      {
        id: nanoid(8),
        variant: "",
        value: parsedBody.quickTranslation.toLowerCase(),
      },
    ],
    kind: parsedBody.kind,
    addedAt: new Date().toISOString(),
    modifiedAt: new Date().toISOString(),
  };

  await wordService.create(newWord);

  return {
    statusCode: 201,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      newWord,
    }),
  };
};
