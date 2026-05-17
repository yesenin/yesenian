import { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { WordsService } from "./services/db";
import { Word } from "./models";
import { nanoid } from "nanoid";
import { z } from "zod";

const wordService = new WordsService();

export const getWordByIdHandler: APIGatewayProxyHandlerV2 = async (event) => {
  const id = event.pathParameters?.id;
  const language = event.queryStringParameters?.lang;

  if (!id || !language) {
    return {
      statusCode: 400,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        message: "Missing 'id' path parameter or 'lang' query parameter",
      }),
    };
  }
  const word = await wordService.getById(id, language);
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

export const getAllWordsHandler: APIGatewayProxyHandlerV2 = async (event) => {
  const query = event.queryStringParameters?.ru ?? "";
  const words: Word[] = await wordService.scan(query);
  return {
    statusCode: 200,
    headers: { "content-type": "application/json" },
    body: "Да пока непонятно как это сделать",
  };
};

interface AddWordRequest {
  ru: string;
  language: string;
  quickTranslation: string;
  kind: string;
  tags?: string[];
}

const AddWordRequestSchema = z.object({
  ru: z.string().min(2),
  language: z.string().min(2),
  quickTranslation: z.string().min(2),
  kind: z.string().min(2),
  tags: z.array(z.string()).optional(),
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
    source: "api",
    addedAt: new Date().toISOString(),
    modifiedAt: new Date().toISOString(),
    tags: parsedBody.tags,
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

export const scanHandler: APIGatewayProxyHandlerV2 = async (event) => {
  const query = event.queryStringParameters?.ru ?? "";
  const words: Word[] = await wordService.scan(query);
  return {
    statusCode: 200,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(words),
  };
};
