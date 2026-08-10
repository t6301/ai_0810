"use strict";

const MODEL = "gemini-3.6-flash";
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

function sendJson(response, status, body) {
  response.status(status).setHeader("Content-Type", "application/json; charset=utf-8");
  response.end(JSON.stringify(body));
}

function cleanText(value, maximumLength) {
  return typeof value === "string" ? value.trim().slice(0, maximumLength) : "";
}

function validateQuestion(question) {
  if (!question || typeof question !== "object") {
    return false;
  }

  const options = Array.isArray(question.options) ? question.options.map((option) => cleanText(option, 500)) : [];
  const uniqueOptions = new Set(options.map((option) => option.toLocaleLowerCase("zh-TW")));

  return Boolean(
    cleanText(question.stem, 3000) &&
    options.length === 4 &&
    options.every(Boolean) &&
    uniqueOptions.size === 4 &&
    ["A", "B", "C", "D"].includes(question.answer) &&
    cleanText(question.explanation, 3000) &&
    cleanText(question.source, 500)
  );
}

function normalizeQuestion(question) {
  return {
    stem: cleanText(question.stem, 3000),
    options: question.options.map((option) => cleanText(option, 500)),
    answer: question.answer,
    explanation: cleanText(question.explanation, 3000),
    source: cleanText(question.source, 500)
  };
}

function buildPrompt(input) {
  return `你是協助臺灣高中職老師命題的助理。請依下列資料產生 ${input.questionCount} 題繁體中文「${input.questionType}」單選題草稿。

命題資料：
- 科目：${input.subject}
- 課綱單元重點：${input.curriculumFocus}
- 難度：${input.difficulty}
- 新聞標題：${input.newsTitle}
- 媒體名稱：${input.mediaName}
- 新聞日期：${input.publishDate}
- 新聞網址：${input.newsUrl || "未提供"}
- 老師整理的新聞重點：${input.newsText}

必須遵守：
1. 題幹要改寫成不看原新聞也能理解的完整情境，不得逐字照抄新聞句子。
2. 不得添加素材中沒有根據的具體事實、數字、人物或日期。
3. 每題固定四個互不重複的選項，依序為 A、B、C、D，而且只能有一個正確答案。
4. 每題提供清楚詳解，說明正確答案與其他選項不適合的原因。
5. 每題的出處提醒必須包含「${input.mediaName}、${input.publishDate}」，可再附新聞標題。
6. 題型為題組時，各題仍須能獨立閱讀，必要時在題幹重述共同情境。
7. 所有題目都是待老師查核的草稿，不要聲稱已查核。
8. 只回傳符合指定格式的資料。`;
}

module.exports = async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    sendJson(response, 405, { error: "這個功能只接受網站送出的出題要求。" });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    sendJson(response, 503, { error: "網站尚未設定 Gemini 金鑰，請先在 Vercel 的秘密設定加入 GEMINI_API_KEY。" });
    return;
  }

  const body = request.body && typeof request.body === "object" ? request.body : {};
  const input = {
    subject: cleanText(body.subject, 200),
    curriculumFocus: cleanText(body.curriculumFocus, 5000),
    newsUrl: cleanText(body.newsUrl, 2000),
    newsText: cleanText(body.newsText, 20000),
    newsTitle: cleanText(body.newsTitle, 500),
    mediaName: cleanText(body.mediaName, 200),
    publishDate: cleanText(body.publishDate, 20),
    questionType: cleanText(body.questionType, 20),
    questionCount: Number(body.questionCount),
    difficulty: cleanText(body.difficulty, 20)
  };

  if (!input.subject || !input.curriculumFocus || !input.newsText || !input.newsTitle || !input.mediaName || !input.publishDate || !input.questionType || !input.difficulty || ![3, 5].includes(input.questionCount)) {
    sendJson(response, 400, { error: "命題資料不完整，請回到畫面補齊所有必填欄位。" });
    return;
  }

  const questionSchema = {
    type: "object",
    properties: {
      questions: {
        type: "array",
        minItems: input.questionCount,
        maxItems: input.questionCount,
        items: {
          type: "object",
          properties: {
            stem: { type: "string", description: "自足且經過改寫的繁體中文題幹" },
            options: {
              type: "array",
              minItems: 4,
              maxItems: 4,
              items: { type: "string" },
              description: "依序為 A、B、C、D 的四個互不重複選項"
            },
            answer: { type: "string", enum: ["A", "B", "C", "D"] },
            explanation: { type: "string", description: "答案與各選項判斷理由" },
            source: { type: "string", description: "媒體名稱、日期及新聞標題" }
          },
          required: ["stem", "options", "answer", "explanation", "source"]
        }
      }
    },
    required: ["questions"]
  };

  try {
    const geminiResponse = await fetch(GEMINI_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey
      },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: buildPrompt(input) }] }],
        generationConfig: {
          maxOutputTokens: 8192,
          responseFormat: {
            text: {
              mimeType: "APPLICATION_JSON",
              schema: questionSchema
            }
          }
        }
      })
    });

    const geminiData = await geminiResponse.json().catch(() => ({}));
    if (!geminiResponse.ok) {
      const errorStatus = cleanText(geminiData.error?.status, 100);
      const providerMessage = cleanText(geminiData.error?.message, 500);
      const safeProviderMessage = providerMessage.replace(/AIza[0-9A-Za-z_-]+/g, "[金鑰已隱藏]");
      console.error("[api/generate] Gemini request failed", {
        httpStatus: geminiResponse.status,
        errorStatus,
        providerMessage: safeProviderMessage
      });

      if (geminiResponse.status === 429 || errorStatus === "RESOURCE_EXHAUSTED") {
        sendJson(response, 429, { error: "Gemini 目前使用量已達限制，請稍後再試。" });
        return;
      }

      if (
        ["UNAUTHENTICATED", "PERMISSION_DENIED"].includes(errorStatus) ||
        providerMessage.toLowerCase().includes("api key not valid")
      ) {
        sendJson(response, 502, { error: "Gemini 金鑰無效或尚未取得使用權限，請到 Vercel 重新設定有效金鑰。" });
        return;
      }

      if (geminiResponse.status === 404 || errorStatus === "NOT_FOUND") {
        sendJson(response, 502, { error: "目前設定的 Gemini 模型無法使用，請稍後再試。" });
        return;
      }

      if (geminiResponse.status === 400 || errorStatus === "INVALID_ARGUMENT") {
        sendJson(response, 502, { error: "Gemini 收到不支援的出題設定，請重新整理網站後再試。" });
        return;
      }

      sendJson(response, 502, { error: "Gemini 暫時無法完成出題，請稍後再試。" });
      return;
    }

    const outputText = geminiData.candidates?.[0]?.content?.parts
      ?.map((part) => part.text || "")
      .join("");

    if (!outputText) {
      sendJson(response, 502, { error: "Gemini 沒有回傳題目，可能是素材不足或內容無法處理。" });
      return;
    }

    const result = JSON.parse(outputText);
    if (!Array.isArray(result.questions) || result.questions.length !== input.questionCount || !result.questions.every(validateQuestion)) {
      sendJson(response, 502, { error: "Gemini 回傳的題目格式不完整，請再試一次。" });
      return;
    }

    sendJson(response, 200, {
      model: MODEL,
      questions: result.questions.map(normalizeQuestion)
    });
  } catch {
    sendJson(response, 502, { error: "目前無法連接 Gemini，請檢查網路後再試一次。" });
  }
};
