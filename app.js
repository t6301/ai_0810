(() => {
  "use strict";

  const form = document.querySelector("#question-form");
  const sourceButtons = [...document.querySelectorAll(".source-option")];
  const urlPanel = document.querySelector("#url-panel");
  const textPanel = document.querySelector("#text-panel");
  const newsUrl = document.querySelector("#news-url");
  const newsText = document.querySelector("#news-text");
  const mediaName = document.querySelector("#media-name");
  const publishDate = document.querySelector("#publish-date");
  const difficulty = document.querySelector("#difficulty");
  const messageBox = document.querySelector("#message-box");
  const resultCard = document.querySelector("#result-card");
  const emptyState = document.querySelector("#empty-state");

  let sourceMode = "url";

  function showMessage(message, type) {
    messageBox.textContent = message;
    messageBox.className = `message-box is-${type}`;
    messageBox.hidden = false;
    messageBox.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function clearMessage() {
    messageBox.hidden = true;
    messageBox.textContent = "";
    messageBox.className = "message-box";
  }

  function switchSource(nextMode) {
    sourceMode = nextMode;
    clearMessage();

    sourceButtons.forEach((button) => {
      const isSelected = button.dataset.source === nextMode;
      button.classList.toggle("is-selected", isSelected);
      button.setAttribute("aria-pressed", String(isSelected));
    });

    const useUrl = nextMode === "url";
    urlPanel.hidden = !useUrl;
    textPanel.hidden = useUrl;
    newsUrl.required = useUrl;
    newsText.required = !useUrl;

    if (useUrl) {
      newsUrl.focus();
    } else {
      newsText.focus();
    }
  }

  function isValidNewsUrl(value) {
    try {
      const parsedUrl = new URL(value);
      return parsedUrl.protocol === "http:" || parsedUrl.protocol === "https:";
    } catch {
      return false;
    }
  }

  function validateForm() {
    if (sourceMode === "url" && !newsUrl.value.trim()) {
      return "請先貼上新聞網址。";
    }

    if (sourceMode === "url" && !isValidNewsUrl(newsUrl.value.trim())) {
      return "新聞網址格式看起來不完整，請確認網址以 http:// 或 https:// 開頭。";
    }

    if (sourceMode === "text" && !newsText.value.trim()) {
      return "請先貼上足以看懂事件的新聞文字。";
    }

    if (!mediaName.value.trim()) {
      return "請填寫媒體名稱，之後題目才能附上出處提醒。";
    }

    if (!publishDate.value) {
      return "請選擇新聞日期，方便老師查核時效。";
    }

    if (!difficulty.value) {
      return "請選擇題目難度。";
    }

    return "";
  }

  sourceButtons.forEach((button) => {
    button.addEventListener("click", () => switchSource(button.dataset.source));
  });

  form.addEventListener("input", clearMessage);

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const errorMessage = validateForm();

    if (errorMessage) {
      showMessage(errorMessage, "error");
      return;
    }

    showMessage("素材與出題設定已通過基本檢查。第一階段畫面完成；AI 出題服務尚未連接，因此目前不會產生題目。", "success");
    emptyState.innerHTML = `
      <div class="empty-icon" aria-hidden="true">✓</div>
      <h3>素材已準備完成</h3>
      <p>媒體：${escapeHtml(mediaName.value.trim())}｜日期：${escapeHtml(publishDate.value)}｜難度：${escapeHtml(difficulty.value)}</p>
      <p>真實題目尚未產生，因此列印與下載功能暫不顯示。</p>
    `;
    resultCard.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  function escapeHtml(value) {
    return value.replace(/[&<>'"]/g, (character) => {
      const entities = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "'": "&#39;",
        '"': "&quot;"
      };
      return entities[character];
    });
  }

  switchSource("url");
})();
