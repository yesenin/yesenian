import { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { BotService, WordsService } from "./db";
import { Word } from "./models";
import { nanoid } from "nanoid";
import { z } from "zod";

const wordService = new WordsService();
const botService = new BotService();

export const getAllWordsHandler: APIGatewayProxyHandlerV2 = async (event) => {
  const words: Word[] = await wordService.getAll();
  return {
    statusCode: 200,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(words),
  };
};

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

const token = "8636794064:AAEy7fBhzEWkmgfrytmsWfX-KtnsL-e_qNs"; //process.env.TELEGRAM_BOT_TOKEN!;

async function sendMessage(chatId: number, text: string, extra?: object) {
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      ...extra,
    }),
  });
}

export const botHandler: APIGatewayProxyHandlerV2 = async (event) => {
  const update = JSON.parse(event.body ?? "{}");

  if (update.message?.text) {
    await handleMessage(
      update.message.chat.id,
      update.message.from.id,
      update.message.text.trim(),
    );
  }

  if (update.callback_query) {
    await handleCallbackQuery(update.callback_query);
  }

  return { statusCode: 200, body: "ok" };
};

async function handleMessage(chatId: number, userId: number, text: string) {
  const session = await botService.getSession(userId);

  const now = Math.floor(Date.now() / 1000);

  if (text === "/add") {
    await botService.saveSession({
      userId: String(userId),
      step: "language",
      expiresAt: now + 60 * 10,
    });

    await sendMessage(chatId, "Выбери язык:", {
      reply_markup: {
        inline_keyboard: [
          [
            { text: "Английский", callback_data: "lang:en" },
            { text: "Французский", callback_data: "lang:fr" },
          ],
          [
            { text: "Сербский", callback_data: "lang:sr" },
            { text: "Армянский", callback_data: "lang:hy" },
          ],
          [{ text: "Другой", callback_data: "lang:other" }],
        ],
      },
    });

    return;
  }

  if (!session) {
    await sendMessage(chatId, "Используй /add, чтобы добавить слово.");
    return;
  }

  switch (session.step) {
    case "ru_word":
      await botService.saveSession({
        ...session,
        ruWord: text,
        step: "translation",
        expiresAt: now + 60 * 10,
      });

      await sendMessage(chatId, "Теперь введи перевод:");
      return;

    case "translation":
      await botService.saveSession({
        ...session,
        translation: text,
        step: "word_kind",
        expiresAt: now + 60 * 10,
      });

      await sendMessage(chatId, "Выбери тип слова:", {
        reply_markup: {
          inline_keyboard: [
            [
              { text: "существительное", callback_data: "kind:noun" },
              { text: "глагол", callback_data: "kind:verb" },
              { text: "прилагательное", callback_data: "kind:adjective" },
            ],
            [
              { text: "наречие", callback_data: "kind:adverb" },
              { text: "местоимение", callback_data: "kind:pronoun" },
              { text: "предлог", callback_data: "kind:preposition" },
            ],
            [
              { text: "числительное", callback_data: "kind:numeral" },
              { text: "союз", callback_data: "kind:conjunction" },
              { text: "междометие", callback_data: "kind:interjection" },
            ],
            [
              { text: "частица", callback_data: "kind:particle" },
              { text: "другое", callback_data: "kind:other" },
              { text: "фраза", callback_data: "kind:phrase" },
            ],
          ],
        },
      });

      return;
  }
}

async function handleCallbackQuery(callbackQuery: any) {
  const data = callbackQuery.data;
  const chatId = callbackQuery.message.chat.id;
  const userId = callbackQuery.from.id;

  const now = Math.floor(Date.now() / 1000);

  const session = await botService.getSession(userId);

  if (!session) return;

  if (session.step === "language" && data.startsWith("lang:")) {
    const language = data.replace("lang:", "");

    await botService.saveSession({
      ...session,
      language,
      step: "ru_word",
      expiresAt: now + 60 * 10,
    });

    await sendMessage(chatId, "Введи русский перевод:");
    return;
  }

  if (session.step === "word_kind" && data.startsWith("kind:")) {
    const wordKind = data.replace("kind:", "");

    await wordService.create({
      language: session.language!,
      ru: session.ruWord!,
      translations: [
        {
          id: nanoid(8),
          variant: "",
          value: session.translation!,
        },
      ],
      kind: wordKind,
      source: "bot",
      id: nanoid(8),
      addedAt: new Date().toISOString(),
      modifiedAt: new Date().toISOString(),
    });

    await botService.deleteSession(userId);

    await sendMessage(chatId, "Слово добавлено ✅");
    return;
  }
}
