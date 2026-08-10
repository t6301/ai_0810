(() => {
  "use strict";

  const form = document.querySelector("#question-form");
  const sourceButtons = [...document.querySelectorAll(".source-option")];
  const urlPanel = document.querySelector("#url-panel");
  const textPanel = document.querySelector("#text-panel");
  const newsUrl = document.querySelector("#news-url");
  const newsText = document.querySelector("#news-text");
  const subject = document.querySelector("#subject");
  const curriculumFocus = document.querySelector("#curriculum-focus");
  const newsTitle = document.querySelector("#news-title");
  const mediaName = document.querySelector("#media-name");
  const publishDate = document.querySelector("#publish-date");
  const questionType = document.querySelector("#question-type");
  const questionCount = document.querySelector("#question-count");
  const difficulty = document.querySelector("#difficulty");
  const messageBox = document.querySelector("#message-box");
  const resultCard = document.querySelector("#result-card");
  const questionGrid = document.querySelector("#question-grid");
  const printStudentButton = document.querySelector("#print-student");
  const printAnswerButton = document.querySelector("#print-answer");
  const printSheet = document.querySelector("#print-sheet");
  const draftStatus = document.querySelector("#draft-status");
  const clearDraftButton = document.querySelector("#clear-draft");
  const generateDraftButton = document.querySelector("#generate-draft");

  const DRAFT_KEY = "current-event-question-draft-v1";
  let sourceMode = "url";
  let saveTimer;
  let questionSlots = [];

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

  function switchSource(nextMode, options = {}) {
    const { focus = true, save = true } = options;
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
    newsText.required = true;

    if (focus) {
      if (useUrl) {
        newsUrl.focus();
      } else {
        newsText.focus();
      }
    }

    if (save) {
      scheduleDraftSave();
    }
  }

  function getDraftData() {
    return {
      sourceMode,
      subject: subject.value,
      curriculumFocus: curriculumFocus.value,
      newsUrl: newsUrl.value,
      newsText: newsText.value,
      newsTitle: newsTitle.value,
      mediaName: mediaName.value,
      publishDate: publishDate.value,
      questionType: questionType.value,
      questionCount: questionCount.value,
      difficulty: difficulty.value,
      questions: getQuestionData(),
      savedAt: new Date().toISOString()
    };
  }

  function hasDraftContent(draft) {
    return Boolean(
      draft.subject.trim() ||
      draft.curriculumFocus.trim() ||
      draft.newsUrl.trim() ||
      draft.newsText.trim() ||
      draft.newsTitle.trim() ||
      draft.mediaName.trim() ||
      draft.publishDate ||
      draft.questionType ||
      draft.questionCount ||
      draft.difficulty ||
      draft.questions.some((question) => question.stem.trim())
    );
  }

  function renderQuestionSlots(count = 0) {
    questionGrid.innerHTML = "";
    questionSlots = [];

    if (count === 0) {
      questionGrid.innerHTML = '<p class="field-help">尚未產生題目。請先完成上方命題條件，再按「產生考題草稿」。</p>';
      return;
    }

    for (let index = 0; index < count; index += 1) {
      const slot = document.createElement("article");
      slot.className = "question-slot";
      slot.dataset.questionIndex = String(index);
      slot.innerHTML = `
        <div class="question-slot-header">
          <h3>第 ${index + 1} 題</h3>
          <span data-generated-label hidden>Gemini 產生｜草稿</span>
          <span data-empty-label>題幹空白時不列印</span>
        </div>
        <label for="question-${index}-stem">題幹</label>
        <textarea id="question-${index}-stem" data-field="stem" rows="4" placeholder="請輸入自足、可獨立閱讀的題幹。"></textarea>
        <div class="options-grid">
          ${["A", "B", "C", "D"].map((label) => `
            <div>
              <label for="question-${index}-option-${label}">選項 ${label}</label>
              <input id="question-${index}-option-${label}" data-field="option${label}" type="text" placeholder="選項 ${label}">
            </div>
          `).join("")}
        </div>
        <div class="question-detail-grid">
          <div>
            <label for="question-${index}-answer">答案</label>
            <select id="question-${index}-answer" data-field="answer">
              <option value="">請選擇答案</option>
              <option value="A">A</option>
              <option value="B">B</option>
              <option value="C">C</option>
              <option value="D">D</option>
            </select>
          </div>
          <div>
            <label for="question-${index}-source">出處提醒</label>
            <input id="question-${index}-source" data-field="source" type="text" placeholder="例如：中央社，2026-08-10">
          </div>
        </div>
        <label for="question-${index}-explanation">詳解</label>
        <textarea id="question-${index}-explanation" data-field="explanation" rows="3" placeholder="請說明正確答案與判斷理由。"></textarea>
      `;
      questionGrid.append(slot);
    }

    questionSlots = [...questionGrid.querySelectorAll(".question-slot")];
  }

  function getQuestionData() {
    return questionSlots.map((slot) => ({
      stem: slot.querySelector('[data-field="stem"]').value,
      options: ["A", "B", "C", "D"].map((label) => slot.querySelector(`[data-field="option${label}"]`).value),
      answer: slot.querySelector('[data-field="answer"]').value,
      explanation: slot.querySelector('[data-field="explanation"]').value,
      source: slot.querySelector('[data-field="source"]').value,
      generated: slot.dataset.generated === "true"
    }));
  }

  function setGeneratedState(slot, isGenerated) {
    slot.dataset.generated = isGenerated ? "true" : "false";
    slot.querySelector("[data-generated-label]").hidden = !isGenerated;
    slot.querySelector("[data-empty-label]").hidden = isGenerated;
  }

  function restoreQuestions(questions) {
    if (!Array.isArray(questions)) {
      return;
    }

    questionSlots.forEach((slot, index) => {
      const question = questions[index] || {};
      slot.querySelector('[data-field="stem"]').value = typeof question.stem === "string" ? question.stem : "";
      ["A", "B", "C", "D"].forEach((label, optionIndex) => {
        const options = Array.isArray(question.options) ? question.options : [];
        slot.querySelector(`[data-field="option${label}"]`).value = typeof options[optionIndex] === "string" ? options[optionIndex] : "";
      });
      slot.querySelector('[data-field="answer"]').value = typeof question.answer === "string" ? question.answer : "";
      slot.querySelector('[data-field="explanation"]').value = typeof question.explanation === "string" ? question.explanation : "";
      slot.querySelector('[data-field="source"]').value = typeof question.source === "string" ? question.source : "";
      setGeneratedState(slot, question.generated === true);
    });
  }

  function hasQuestionContent(question) {
    return Boolean(
      question &&
      (cleanValue(question.stem) ||
        (Array.isArray(question.options) && question.options.some((option) => cleanValue(option))) ||
        cleanValue(question.answer) ||
        cleanValue(question.explanation) ||
        cleanValue(question.source))
    );
  }

  function cleanValue(value) {
    return typeof value === "string" ? value.trim() : "";
  }

  function formatSavedTime(dateValue) {
    return new Intl.DateTimeFormat("zh-TW", {
      hour: "2-digit",
      minute: "2-digit"
    }).format(dateValue);
  }

  function updateDraftStatus(message, isError = false) {
    draftStatus.textContent = message;
    draftStatus.classList.toggle("is-error", isError);
  }

  function saveDraft() {
    const draft = getDraftData();

    try {
      if (!hasDraftContent(draft)) {
        localStorage.removeItem(DRAFT_KEY);
        updateDraftStatus("尚未有本機草稿");
        clearDraftButton.hidden = true;
        return;
      }

      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
      updateDraftStatus(`已自動保存於這台裝置｜${formatSavedTime(new Date(draft.savedAt))}`);
      clearDraftButton.hidden = false;
    } catch {
      updateDraftStatus("瀏覽器不允許保存草稿，請勿關閉這個頁面。", true);
      clearDraftButton.hidden = true;
    }
  }

  function scheduleDraftSave() {
    window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(saveDraft, 250);
  }

  function loadDraft() {
    try {
      const savedValue = localStorage.getItem(DRAFT_KEY);

      if (!savedValue) {
        renderQuestionSlots(0);
        switchSource("url", { focus: false, save: false });
        return;
      }

      const draft = JSON.parse(savedValue);
      subject.value = typeof draft.subject === "string" ? draft.subject : "";
      curriculumFocus.value = typeof draft.curriculumFocus === "string" ? draft.curriculumFocus : "";
      newsUrl.value = typeof draft.newsUrl === "string" ? draft.newsUrl : "";
      newsText.value = typeof draft.newsText === "string" ? draft.newsText : "";
      newsTitle.value = typeof draft.newsTitle === "string" ? draft.newsTitle : "";
      mediaName.value = typeof draft.mediaName === "string" ? draft.mediaName : "";
      publishDate.value = typeof draft.publishDate === "string" ? draft.publishDate : "";
      questionType.value = typeof draft.questionType === "string" ? draft.questionType : "";
      questionCount.value = typeof draft.questionCount === "string" ? draft.questionCount : "";
      difficulty.value = typeof draft.difficulty === "string" ? draft.difficulty : "";
      const savedQuestions = Array.isArray(draft.questions) ? draft.questions.filter(hasQuestionContent) : [];
      renderQuestionSlots(savedQuestions.length);
      restoreQuestions(savedQuestions);
      switchSource(draft.sourceMode === "text" ? "text" : "url", { focus: false, save: false });
      updateDraftStatus("已恢復上次保存在這台裝置的草稿");
      clearDraftButton.hidden = false;
    } catch {
      localStorage.removeItem(DRAFT_KEY);
      renderQuestionSlots(0);
      switchSource("url", { focus: false, save: false });
      updateDraftStatus("先前的草稿無法讀取，已改用空白表單。", true);
      clearDraftButton.hidden = true;
    }
  }

  function clearDraft() {
    const confirmed = window.confirm("確定要清除目前保存在這台裝置的草稿嗎？清除後無法復原。");

    if (!confirmed) {
      return;
    }

    window.clearTimeout(saveTimer);
    form.reset();
    renderQuestionSlots(0);
    newsUrl.value = "";
    newsText.value = "";
    switchSource("url", { focus: false, save: false });
    localStorage.removeItem(DRAFT_KEY);
    clearMessage();
    updateDraftStatus("本機草稿已清除");
    clearDraftButton.hidden = true;
    newsUrl.focus();
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
    if (!subject.value.trim()) {
      return "請先填寫科目。";
    }

    if (!curriculumFocus.value.trim()) {
      return "請先填寫課綱單元重點。";
    }

    if (sourceMode === "url" && !newsUrl.value.trim()) {
      return "請先貼上新聞網址。";
    }

    if (sourceMode === "url" && !isValidNewsUrl(newsUrl.value.trim())) {
      return "新聞網址格式看起來不完整，請確認網址以 http:// 或 https:// 開頭。";
    }

    if (!newsText.value.trim()) {
      return "請先貼上足以看懂事件的新聞重點。";
    }

    if (!newsTitle.value.trim()) {
      return "請填寫新聞標題。";
    }

    if (!mediaName.value.trim()) {
      return "請填寫媒體名稱，之後題目才能附上出處提醒。";
    }

    if (!publishDate.value) {
      return "請選擇新聞日期，方便老師查核時效。";
    }

    if (!questionType.value) {
      return "請選擇題型。";
    }

    if (!questionCount.value) {
      return "請選擇題數。";
    }

    if (!difficulty.value) {
      return "請選擇題目難度。";
    }

    return "";
  }

  function getFilledQuestions() {
    return getQuestionData().filter((question) => question.stem.trim());
  }

  function isQuestionSlotEmpty(slot) {
    return [...slot.querySelectorAll("input, textarea, select")].every((field) => !field.value.trim());
  }

  function fillGeneratedQuestions(questions) {
    let filledCount = 0;

    questions.forEach((question, questionIndex) => {
      const slot = questionSlots[questionIndex];

      if (!slot || !isQuestionSlotEmpty(slot)) {
        return;
      }

      slot.querySelector('[data-field="stem"]').value = question.stem;
      ["A", "B", "C", "D"].forEach((label, optionIndex) => {
        slot.querySelector(`[data-field="option${label}"]`).value = question.options[optionIndex];
      });
      slot.querySelector('[data-field="answer"]').value = question.answer;
      slot.querySelector('[data-field="explanation"]').value = question.explanation;
      slot.querySelector('[data-field="source"]').value = question.source;
      setGeneratedState(slot, true);
      filledCount += 1;
    });

    return filledCount;
  }

  async function readErrorMessage(response) {
    try {
      const result = await response.json();
      return typeof result.error === "string" ? result.error : "Gemini 暫時無法產生題目，請稍後再試。";
    } catch {
      return "Gemini 暫時無法產生題目，請稍後再試。";
    }
  }

  async function generateQuestionDrafts() {
    clearMessage();
    const errorMessage = validateForm();

    if (errorMessage) {
      showMessage(errorMessage, "error");
      return;
    }

    if (window.location.protocol === "file:") {
      showMessage("AI 出題需要從測試網站網址開啟；直接雙擊檔案仍可編輯、保存與列印。", "error");
      return;
    }

    const requestedCount = Number(questionCount.value);

    if (questionSlots.length > 0) {
      showMessage("目前已有題目草稿，為避免覆蓋老師修改過的內容，不會再次產生。若要重新開始，請先使用「清除目前草稿」。", "error");
      return;
    }

    generateDraftButton.disabled = true;
    generateDraftButton.textContent = "正在產生草稿…";
    showMessage("Gemini 正在整理題目草稿，請稍候；請勿關閉頁面。", "success");

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: subject.value.trim(),
          curriculumFocus: curriculumFocus.value.trim(),
          newsUrl: newsUrl.value.trim(),
          newsText: newsText.value.trim(),
          newsTitle: newsTitle.value.trim(),
          mediaName: mediaName.value.trim(),
          publishDate: publishDate.value,
          questionType: questionType.value,
          questionCount: requestedCount,
          difficulty: difficulty.value
        })
      });

      if (!response.ok) {
        throw new Error(await readErrorMessage(response));
      }

      const result = await response.json();
      if (!Array.isArray(result.questions) || result.questions.length !== requestedCount) {
        throw new Error("Gemini 回傳的題目數量不完整，請再試一次。");
      }

      renderQuestionSlots(requestedCount);
      const filledCount = fillGeneratedQuestions(result.questions);
      if (filledCount !== requestedCount) {
        renderQuestionSlots(0);
        throw new Error("部分題格在產生期間已有內容，因此未覆蓋；請確認後再試一次。");
      }

      saveDraft();
      showMessage(`已填入 ${filledCount} 題 Gemini 草稿。請逐題查核事實、時效、著作權、偏誤與答案唯一性。`, "success");
      resultCard.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Gemini 暫時無法產生題目，請稍後再試。";
      showMessage(message, "error");
    } finally {
      generateDraftButton.disabled = false;
      generateDraftButton.textContent = "產生考題草稿";
    }
  }

  function buildPrintSheet(mode) {
    const questions = getFilledQuestions();

    if (!questions.length) {
      showMessage("目前沒有可列印的題目，請至少填寫一個題幹。", "error");
      return false;
    }

    const isAnswerSheet = mode === "answer";
    const sheetTitle = isAnswerSheet ? "答案詳解卷" : "試題卷";
    const sourceText = `${mediaName.value.trim()}｜${publishDate.value || "未填日期"}`;

    printSheet.innerHTML = `
      <header class="print-header">
        <p>校園時事命題｜${escapeHtml(questionType.value || "未選題型")}</p>
        <h1>${escapeHtml(subject.value.trim() || "未填科目")}｜${sheetTitle}</h1>
        <p>新聞：${escapeHtml(newsTitle.value.trim() || "未填標題")}｜來源：${escapeHtml(sourceText)}</p>
      </header>
      <div class="print-questions">
        ${questions.map((question, index) => `
          <article class="print-question">
            <h2>${index + 1}. ${escapeHtml(question.stem.trim())}</h2>
            <ol class="print-options" type="A">
              ${question.options.filter((option) => option.trim()).map((option) => `<li>${escapeHtml(option.trim())}</li>`).join("")}
            </ol>
            ${isAnswerSheet ? `
              <div class="print-answer-block">
                <p><strong>答案：</strong>${escapeHtml(question.answer || "未填")}</p>
                <p><strong>詳解：</strong>${escapeHtml(question.explanation.trim() || "未填")}</p>
                <p><strong>出處提醒：</strong>${escapeHtml(question.source.trim() || sourceText)}</p>
              </div>
            ` : ""}
          </article>
        `).join("")}
      </div>
    `;
    printSheet.hidden = false;
    document.body.classList.add("is-printing");
    window.print();
    return true;
  }

  function finishPrinting() {
    document.body.classList.remove("is-printing");
    printSheet.hidden = true;
  }

  sourceButtons.forEach((button) => {
    button.addEventListener("click", () => switchSource(button.dataset.source));
  });

  form.addEventListener("input", () => {
    clearMessage();
    scheduleDraftSave();
  });

  form.addEventListener("change", scheduleDraftSave);
  questionGrid.addEventListener("input", scheduleDraftSave);
  questionGrid.addEventListener("change", scheduleDraftSave);
  clearDraftButton.addEventListener("click", clearDraft);
  window.addEventListener("pagehide", saveDraft);
  window.addEventListener("afterprint", finishPrinting);
  printStudentButton.addEventListener("click", () => buildPrintSheet("student"));
  printAnswerButton.addEventListener("click", () => buildPrintSheet("answer"));
  generateDraftButton.addEventListener("click", generateQuestionDrafts);

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const errorMessage = validateForm();

    if (errorMessage) {
      showMessage(errorMessage, "error");
      return;
    }

    saveDraft();
    showMessage(`命題條件已通過檢查。可按下「產生考題草稿」，請 Gemini 準備 ${escapeHtml(questionCount.value)} 題「${escapeHtml(questionType.value)}」。`, "success");
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

  renderQuestionSlots(0);
  loadDraft();
})();
