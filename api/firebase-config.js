"use strict";

const PRODUCTION_AUTH_DOMAIN = "ai-0810.vercel.app";

function sendJson(response, status, body) {
  response.status(status).setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.end(JSON.stringify(body));
}

module.exports = function handler(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    sendJson(response, 405, { error: "這個設定只供網站讀取。" });
    return;
  }

  const forwardedHost = String(request.headers?.["x-forwarded-host"] || request.headers?.host || "")
    .split(",")[0]
    .trim()
    .toLowerCase();
  const firebaseConfig = {
    apiKey: process.env.FIREBASE_API_KEY,
    authDomain: forwardedHost === PRODUCTION_AUTH_DOMAIN ? PRODUCTION_AUTH_DOMAIN : process.env.FIREBASE_AUTH_DOMAIN,
    projectId: process.env.FIREBASE_PROJECT_ID,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.FIREBASE_APP_ID
  };

  if (Object.values(firebaseConfig).some((value) => !value)) {
    sendJson(response, 503, { error: "Firebase 網頁設定尚未完成。" });
    return;
  }

  sendJson(response, 200, firebaseConfig);
};
