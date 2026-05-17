import { NotesService, WordsService } from "./services/db";
import { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { nanoid } from "nanoid";
import { BotService } from "./services/botService";

const wordsService = new WordsService();
const notesService = new NotesService();
const botService = new BotService();

const token = "8636794064:AAERG7LHDIX8TBS9PG8rpIUXqYINXtb3_j8"; //process.env.TELEGRAM_BOT_TOKEN!;

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

async function answerCallbackQuery(callbackQueryId: string, extra?: object) {
  await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      callback_query_id: callbackQueryId,
      ...extra,
    }),
  });
}

async function handleMessage(chatId: number, userId: number, text: string) {
  if (userId !== 1009256639) {
    await sendMessage(chatId, "Ура, ты не Антон. Тебе этого не надо.");
    return;
  }

  if (await handleText(text, chatId, userId)) {
    return;
  }

  const session = await botService.getSession(userId);

  if (!session) {
    await sendMessage(chatId, "Чудо бот приветствует тебя!");
    return;
  }

  await handleAddWordStep(session, chatId, text);
}

async function handleText(text: string, chatId: number, userId: number) {
  const now = Math.floor(Date.now() / 1000);

  const workingCommands = [
    "/add",
    "/find",
    "/add_note",
    "/show_notes",
    "/random",
  ];

  const allCommands = [...workingCommands];

  if (text === "/add") {
    await botService.saveSession({
      userId: String(userId),
      step: "add_language",
      expiresAt: now + 60 * 10,
    });
    await sendMessage(chatId, "Выбери язык:", {
      reply_markup: {
        inline_keyboard: [
          [
            { text: "🇬🇧", callback_data: "lang:en" },
            { text: "🇫🇷", callback_data: "lang:fr" },
            { text: "🇷🇸", callback_data: "lang:sr" },
            { text: "🇦🇲", callback_data: "lang:hy" },
            { text: "🇯🇵", callback_data: "lang:jp" },
            { text: "🇸🇪", callback_data: "lang:sv" },
          ],
          [{ text: "🏳️", callback_data: "lang:other" }],
          [{ text: "❌", callback_data: "cancel" }],
        ],
      },
    });
    return true;
  }

  if (text === "/find") {
    await botService.saveSession({
      userId: String(userId),
      step: "find_query",
      expiresAt: now + 60 * 10,
    });
    await sendMessage(chatId, "Начинаем поиск слова! Что ищем?", {
      reply_markup: {
        inline_keyboard: [[{ text: "❌", callback_data: "cancel" }]],
      },
    });
    return true;
  }

  if (text === "/add_note") {
    await sendMessage(chatId, "Напиши заметку, которую хочешь сохранить:");
    await botService.saveSession({
      userId: String(userId),
      step: "note_add",
      expiresAt: now + 60 * 10,
    });
    return true;
  }

  if (text === "/show_notes") {
    const notes = await notesService.getAll();
    if (notes.length === 0) {
      await sendMessage(chatId, "Заметок нет 😢");
      return true;
    }
    const notesText = notes
      .map(
        (n) => `- ${n.text} <i>(${new Date(n.createdAt).toLocaleString()})</i>`,
      )
      .join("\n");
    await sendMessage(chatId, `Твои заметки:\n\n${notesText}`, {
      parse_mode: "HTML",
    });
    return true;
  }

  if (text === "/random") {
    const word = await wordsService.getRandom();
    if (!word) {
      await sendMessage(chatId, "Слов нет 😢");
      return true;
    }
    const translations = word.translations.map((t) => t.value).join(", ");
    await sendMessage(
      chatId,
      `<b>${word.ru}</b>\n\n<u>${word.kind}</u>${mapLanguageToEmoji(word.language)} ${translations}`,
      {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "Открыть слово",
                url: `https://yesenin.github.io/hy/#/words?id=${word.id}&lang=${word.language}`,
              },
            ],
          ],
        },
      },
    );
    return true;
  }

  return false;
}

async function handleAddWordStep(session: any, chatId: number, text?: string) {
  if (!text) {
    await sendMessage(chatId, "Пожалуйста, отправь текстовое сообщение.");
    return;
  }
  const now = Math.floor(Date.now() / 1000);
  switch (session.step) {
    case "add_specify_language":
      const language = text!.toLowerCase();
      await botService.saveSession({
        ...session,
        language,
        step: "add_ru_word",
        expiresAt: now + 60 * 10,
      });
      await sendMessage(chatId, "Русский перевод:", {
        reply_markup: {
          inline_keyboard: [[{ text: "❌", callback_data: "cancel" }]],
        },
      });
      return;

    case "add_ru_word":
      await botService.saveSession({
        ...session,
        ruWord: text!,
        step: "add_translation",
        expiresAt: now + 60 * 10,
      });

      await sendMessage(chatId, "Запись:", {
        reply_markup: {
          inline_keyboard: [[{ text: "❌", callback_data: "cancel" }]],
        },
      });
      return;

    case "add_translation":
      await botService.saveSession({
        ...session,
        translation: text!,
        step: "add_word_kind",
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
              { text: "местоимение", callback_data: "kind:pronoun" },
              { text: "предлог", callback_data: "kind:preposition" },
              { text: "союз", callback_data: "kind:conjunction" },
              { text: "междометие", callback_data: "kind:interjection" },
            ],
            [
              { text: "наречие", callback_data: "kind:adverb" },
              { text: "числительное", callback_data: "kind:numeral" },
            ],
            [
              { text: "частица", callback_data: "kind:particle" },
              { text: "фраза", callback_data: "kind:phrase" },
            ],
            [
              { text: "другое", callback_data: "kind:other" },
              { text: "❌", callback_data: "cancel" },
            ],
          ],
        },
      });

      return;

    case "find_query":
      const query = text?.toLowerCase() || "";
      await findResult(query, chatId);
      return;

    case "note_add":
      await notesService.create({
        id: nanoid(8),
        text: text!,
        createdAt: new Date().toISOString(),
      });

      await sendMessage(chatId, "Заметка сохранена ✅");
      botService.deleteSession(session.userId);
      await sendMessage(chatId, "Чудо бот приветствует тебя!");
      return;
  }
}

async function handleCallbackQuery(callbackQuery: any) {
  const data = callbackQuery.data;
  const chatId = callbackQuery.message.chat.id;
  const userId = callbackQuery.from.id;

  await answerCallbackQuery(callbackQuery.id);

  const now = Math.floor(Date.now() / 1000);

  const session = await botService.getSession(userId);

  if (!session) {
    return;
  }

  if (data === "cancel") {
    await botService.deleteSession(userId);
    await sendMessage(chatId, "Операция отменена.");
    await sendMessage(chatId, "Чудо бот приветствует тебя!");
    return;
  }

  if (data === "ok") {
    await sendMessage(chatId, "Чудо бот приветствует тебя!");
    return;
  }

  if (session.step === "add_language" && data.startsWith("lang:")) {
    const language = data.replace("lang:", "");

    if (language === "other") {
      await botService.saveSession({
        ...session,
        language,
        step: "add_specify_language",
        expiresAt: now + 60 * 10,
      });
      await sendMessage(chatId, "Напиши язык словами:", {
        reply_markup: {
          inline_keyboard: [[{ text: "❌", callback_data: "cancel" }]],
        },
      });
    } else {
      await botService.saveSession({
        ...session,
        language,
        step: "add_ru_word",
        expiresAt: now + 60 * 10,
      });
      await sendMessage(chatId, "Русский перевод:", {
        reply_markup: {
          inline_keyboard: [[{ text: "❌", callback_data: "cancel" }]],
        },
      });
    }
    return;
  }

  if (session.step === "add_word_kind" && data.startsWith("kind:")) {
    const wordKind = data.replace("kind:", "");

    await wordsService.create({
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
    await sendMessage(chatId, "Чудо бот приветствует тебя!");
    return;
  }

  if (session.step === "find_query") {
    if (data.startsWith("find:")) {
      const answer = data.replace("find:", "");
      if (answer === "yes") {
        await sendMessage(chatId, "Ура! Я молодец 😎");
        await botService.deleteSession(userId);
        await sendMessage(chatId, "Чудо бот приветствует тебя!");
      } else {
        await sendMessage(chatId, "Что еще искать?");
      }
    }
    if (data.startsWith("get:")) {
      const [_, id, language] = data.split(":");
      const word = await wordsService.getById(id, language);
      if (!word) {
        await sendMessage(chatId, "Слово не найдено 😢");
        return;
      }
      const translations = word.translations.map((t) => t.value).join(", ");
      await sendMessage(
        chatId,
        `<b>${word.ru}</b> <a href="https://yesenin.github.io/hy/#/words?id=${word.id}&lang=${word.language}">${word.id}</a>\n\n<u>${word.kind}</u>${mapLanguageToEmoji(word.language)} <code>${translations}</code>\nТэги: <i>${word.tags?.join(", ") || "нет"}</i>`,
        {
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [
              [
                { text: "Ок", callback_data: "ok" },
                { text: "Назад", callback_data: "find:back" },
              ],
            ],
          },
        },
      );
    }
  }
}

async function findResult(query: string, chatId: number) {
  await wordsService.scan(query!).then(async (words) => {
    if (words.length === 0) {
      await sendMessage(chatId, "Слов не найдено 😢");
      return;
    }
    if (words.length > 5) {
      await sendMessage(
        chatId,
        `Найдено много слов (${words.length}), уточни запрос!`,
      );
      return;
    }
    const result = words.map((w) => ({
      text: `${mapLanguageToEmoji(w.language)}`,
      callback_data: "get:" + w.id + ":" + w.language,
    }));
    await sendMessage(chatId, "Что имеем:", {
      reply_markup: {
        inline_keyboard: [
          result,
          [
            { text: "Еще", callback_data: "find:yes" },
            { text: "Хватит", callback_data: "find:no" },
          ],
        ],
      },
    });
  });
}

function mapLanguageToEmoji(language: string) {
  switch (language) {
    case "en":
      return "🇬🇧";
    case "fr":
      return "🇫🇷";
    case "sr":
      return "🇷🇸";
    case "hy":
      return "🇦🇲";
    case "jp":
      return "🇯🇵";
    case "sv":
      return "🇸🇪";
    default:
      return "❓";
  }
}
