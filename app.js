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
  const autoLawResearchButton = document.querySelector("#auto-law-research");
  const lawCaseResultsCard = document.querySelector("#law-case-results");
  const lawCaseStatus = document.querySelector("#law-case-status");
  const lawCaseList = document.querySelector("#law-case-list");
  const generateSelectedCaseButton = document.querySelector("#generate-selected-case");
  const teachingResourcesCard = document.querySelector("#teaching-resources");
  const researchSummary = document.querySelector("#research-summary");
  const resourceList = document.querySelector("#resource-list");
  const authStatus = document.querySelector("#auth-status");
  const googleSignInButton = document.querySelector("#google-sign-in");
  const googleSignOutButton = document.querySelector("#google-sign-out");
  const cloudRecords = document.querySelector("#cloud-records");
  const examTitle = document.querySelector("#exam-title");
  const saveCloudExamButton = document.querySelector("#save-cloud-exam");
  const saveCloudExamAsButton = document.querySelector("#save-cloud-exam-as");
  const cloudRecordStatus = document.querySelector("#cloud-record-status");
  const cloudRecordList = document.querySelector("#cloud-record-list");

  const DRAFT_KEY = "current-event-question-draft-v1";
  const AUTH_REDIRECT_KEY = "google-auth-redirect-pending-v1";
  let sourceMode = "url";
  let saveTimer;
  let questionSlots = [];
  let firebaseAuth = null;
  let firebaseAuthSdk = null;
  let firebaseDb = null;
  let firebaseFirestoreSdk = null;
  let currentFirebaseUser = null;
  let currentCloudExamId = "";
  let teachingResources = null;
  let lawCaseCandidates = [];
  let selectedLawCase = null;

  function updateAuthDisplay(user) {
    currentFirebaseUser = user || null;
    cloudRecords.hidden = !user;

    if (user) {
      authStatus.textContent = `已登入：${user.displayName || user.email || "Google 使用者"}`;
      googleSignInButton.hidden = true;
      googleSignOutButton.hidden = false;
      loadCloudRecordList();
      return;
    }

    currentCloudExamId = "";
    cloudRecordList.innerHTML = '<p class="field-help">登入後才能查看自己的雲端紀錄。</p>';
    authStatus.textContent = "尚未登入｜目前使用本機草稿";
    googleSignInButton.hidden = false;
    googleSignOutButton.hidden = true;
  }

  function getAuthErrorMessage(error) {
    const messages = {
      "auth/popup-blocked": "瀏覽器阻擋了 Google 登入視窗，請允許這個網站開啟彈出視窗後再試。",
      "auth/popup-closed-by-user": "您已關閉 Google 登入視窗，本機草稿仍會保留。",
      "auth/cancelled-popup-request": "前一次登入尚未完成，請稍後再試。",
      "auth/redirect-cancelled-by-user": "您已取消 Google 登入，本機草稿仍會保留。",
      "auth/web-storage-unsupported": "瀏覽器封鎖了登入所需的網站儲存空間，請確認不是無痕模式後再試。",
      "auth/unauthorized-domain": "這個測試網址尚未加入 Firebase 授權網域，請先到 Firebase Authentication 設定。",
      "auth/operation-not-allowed": "Firebase 尚未啟用 Google 登入，請先到 Authentication 的登入方式開啟 Google。",
      "auth/network-request-failed": "目前無法連接 Google 登入服務，請檢查網路後再試。"
    };
    return messages[error?.code] || "Google 登入失敗，請稍後再試；本機草稿不會消失。";
  }

  async function initializeFirebaseAuth() {
    if (window.location.protocol === "file:") {
      authStatus.textContent = "本機模式｜Google 登入請使用測試網站";
      googleSignInButton.disabled = true;
      return;
    }

    try {
      const [firebaseAppSdk, loadedAuthSdk, loadedFirestoreSdk] = await Promise.all([
        import("https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js"),
        import("https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js"),
        import("https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js")
      ]);
      const response = await fetch("/api/firebase-config", { cache: "no-store" });
      if (!response.ok) {
        throw new Error("config-unavailable");
      }

      const firebaseConfig = await response.json();
      firebaseAuthSdk = loadedAuthSdk;
      firebaseFirestoreSdk = loadedFirestoreSdk;
      const firebaseApp = firebaseAppSdk.initializeApp(firebaseConfig);
      firebaseAuth = loadedAuthSdk.getAuth(firebaseApp);
      firebaseDb = loadedFirestoreSdk.getFirestore(firebaseApp);
      firebaseAuth.languageCode = "zh-TW";
      await loadedAuthSdk.setPersistence(firebaseAuth, loadedAuthSdk.browserLocalPersistence);
      loadedAuthSdk.onAuthStateChanged(firebaseAuth, updateAuthDisplay, () => {
        authStatus.textContent = "無法確認登入狀態，請重新整理頁面。";
      });

      let wasRedirecting = false;
      try {
        wasRedirecting = sessionStorage.getItem(AUTH_REDIRECT_KEY) === "true";
        const redirectResult = await loadedAuthSdk.getRedirectResult(firebaseAuth);
        sessionStorage.removeItem(AUTH_REDIRECT_KEY);
        if (redirectResult?.user) {
          updateAuthDisplay(redirectResult.user);
          showMessage("Google 登入成功，已恢復這台電腦的草稿。", "success");
        } else if (wasRedirecting && !firebaseAuth.currentUser) {
          showMessage("Google 已返回網站，但登入資料未成功帶回。請確認網址是 ai-0810.vercel.app 後再試一次。", "error");
        }
      } catch (error) {
        sessionStorage.removeItem(AUTH_REDIRECT_KEY);
        showMessage(getAuthErrorMessage(error), "error");
      }
    } catch {
      authStatus.textContent = "Google 登入尚未完成設定｜本機功能仍可使用";
      googleSignInButton.disabled = true;
    }
  }

  async function handleGoogleSignIn() {
    if (!firebaseAuth || !firebaseAuthSdk) {
      showMessage("Google 登入尚未完成設定，請稍後再試。", "error");
      return;
    }

    googleSignInButton.disabled = true;
    googleSignInButton.textContent = "正在前往 Google…";

    try {
      saveDraft();
      sessionStorage.setItem(AUTH_REDIRECT_KEY, "true");
      const provider = new firebaseAuthSdk.GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      await firebaseAuthSdk.signInWithRedirect(firebaseAuth, provider);
    } catch (error) {
      sessionStorage.removeItem(AUTH_REDIRECT_KEY);
      showMessage(getAuthErrorMessage(error), "error");
      googleSignInButton.disabled = false;
      googleSignInButton.textContent = "使用 Google 登入";
    }
  }

  async function handleGoogleSignOut() {
    if (!firebaseAuth) {
      return;
    }

    googleSignOutButton.disabled = true;
    try {
      await firebaseAuthSdk.signOut(firebaseAuth);
      showMessage("已登出 Google 帳號，目前繼續使用這台電腦的本機草稿。", "success");
    } catch {
      showMessage("登出失敗，請檢查網路後再試。", "error");
    } finally {
      googleSignOutButton.disabled = false;
    }
  }

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
      teachingResources,
      savedAt: new Date().toISOString()
    };
  }

  function getCloudExamData() {
    return {
      title: examTitle.value.trim() || newsTitle.value.trim() || `${subject.value.trim() || "未命名"}考卷`,
      conditions: {
        subject: subject.value,
        sourceMode,
        questionType: questionType.value,
        questionCount: questionCount.value,
        difficulty: difficulty.value
      },
      curriculumFocus: curriculumFocus.value,
      newsMaterial: {
        url: newsUrl.value,
        text: newsText.value,
        title: newsTitle.value,
        mediaName: mediaName.value,
        publishDate: publishDate.value
      },
      questions: getQuestionData(),
      teachingResources
    };
  }

  function getCloudCollection() {
    return firebaseFirestoreSdk.collection(firebaseDb, "users", currentFirebaseUser.uid, "examSets");
  }

  function setCloudStatus(message, isError = false) {
    cloudRecordStatus.textContent = message;
    cloudRecordStatus.classList.toggle("is-error", isError);
  }

  function formatCloudTime(timestamp) {
    if (!timestamp || typeof timestamp.toDate !== "function") {
      return "剛剛更新";
    }

    return new Intl.DateTimeFormat("zh-TW", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    }).format(timestamp.toDate());
  }

  function getCloudErrorMessage(error) {
    const messages = {
      "permission-denied": "Firestore 安全規則尚未發布，或目前帳號沒有權限。",
      "unavailable": "目前無法連接雲端，請檢查網路後再試。",
      "not-found": "這筆雲端紀錄已不存在，清單將重新整理。"
    };
    return messages[error?.code] || "雲端操作失敗，請稍後再試；本機草稿不會消失。";
  }

  async function loadCloudRecordList() {
    if (!currentFirebaseUser || !firebaseDb || !firebaseFirestoreSdk) {
      return;
    }

    cloudRecordList.innerHTML = '<p class="field-help">正在讀取命題紀錄…</p>';

    try {
      const recordQuery = firebaseFirestoreSdk.query(
        getCloudCollection(),
        firebaseFirestoreSdk.orderBy("updatedAt", "desc")
      );
      const snapshot = await firebaseFirestoreSdk.getDocs(recordQuery);
      cloudRecordList.innerHTML = "";

      if (snapshot.empty) {
        cloudRecordList.innerHTML = '<p class="field-help">目前沒有雲端紀錄。填好標題後，按「儲存這份考卷」。</p>';
        setCloudStatus("雲端目前沒有命題紀錄");
        return;
      }

      snapshot.forEach((record) => {
        const data = record.data();
        const item = document.createElement("article");
        item.className = "question-slot";
        item.dataset.cloudExamId = record.id;

        const heading = document.createElement("h3");
        heading.textContent = data.title || "未命名考卷";
        const time = document.createElement("p");
        time.className = "field-help";
        time.textContent = `更新：${formatCloudTime(data.updatedAt)}`;
        const actions = document.createElement("div");
        actions.className = "result-actions";
        actions.innerHTML = `
          <button type="button" class="secondary-button" data-cloud-action="load">載入</button>
          <button type="button" class="danger-button" data-cloud-action="delete">刪除</button>
        `;
        item.append(heading, time, actions);
        cloudRecordList.append(item);
      });

      setCloudStatus(`已讀取 ${snapshot.size} 筆自己的命題紀錄`);
    } catch (error) {
      cloudRecordList.innerHTML = '<p class="field-help">暫時無法讀取雲端紀錄。</p>';
      setCloudStatus(getCloudErrorMessage(error), true);
    }
  }

  async function saveCloudExam(saveAsNew = false) {
    if (!currentFirebaseUser || !firebaseDb || !firebaseFirestoreSdk) {
      showMessage("請先使用 Google 登入，才能儲存雲端紀錄。", "error");
      return;
    }

    const data = getCloudExamData();
    if (!hasDraftContent(getDraftData())) {
      showMessage("目前沒有可儲存的考卷內容。", "error");
      return;
    }

    const button = saveAsNew ? saveCloudExamAsButton : saveCloudExamButton;
    button.disabled = true;
    setCloudStatus("正在儲存雲端紀錄…");

    try {
      if (!saveAsNew && currentCloudExamId) {
        const recordRef = firebaseFirestoreSdk.doc(getCloudCollection(), currentCloudExamId);
        await firebaseFirestoreSdk.updateDoc(recordRef, {
          ...data,
          updatedAt: firebaseFirestoreSdk.serverTimestamp()
        });
      } else {
        const recordRef = await firebaseFirestoreSdk.addDoc(getCloudCollection(), {
          ...data,
          createdAt: firebaseFirestoreSdk.serverTimestamp(),
          updatedAt: firebaseFirestoreSdk.serverTimestamp()
        });
        currentCloudExamId = recordRef.id;
      }

      examTitle.value = data.title;
      setCloudStatus(saveAsNew ? "已另存成新的雲端紀錄" : "考卷已儲存到自己的雲端紀錄");
      await loadCloudRecordList();
    } catch (error) {
      setCloudStatus(getCloudErrorMessage(error), true);
    } finally {
      button.disabled = false;
    }
  }

  function restoreCloudExam(data) {
    const conditions = data.conditions || {};
    const news = data.newsMaterial || {};
    examTitle.value = typeof data.title === "string" ? data.title : "";
    subject.value = typeof conditions.subject === "string" ? conditions.subject : "";
    curriculumFocus.value = typeof data.curriculumFocus === "string" ? data.curriculumFocus : "";
    newsUrl.value = typeof news.url === "string" ? news.url : "";
    newsText.value = typeof news.text === "string" ? news.text : "";
    newsTitle.value = typeof news.title === "string" ? news.title : "";
    mediaName.value = typeof news.mediaName === "string" ? news.mediaName : "";
    publishDate.value = typeof news.publishDate === "string" ? news.publishDate : "";
    questionType.value = typeof conditions.questionType === "string" ? conditions.questionType : "";
    difficulty.value = typeof conditions.difficulty === "string" ? conditions.difficulty : "";
    const questions = Array.isArray(data.questions) ? data.questions : [];
    const count = questions.length;
    questionCount.value = [3, 5].includes(count) ? String(count) : (conditions.questionCount || "");
    renderQuestionSlots(count);
    restoreQuestions(questions);
    renderTeachingResources(data.teachingResources);
    switchSource(conditions.sourceMode === "text" ? "text" : "url", { focus: false, save: false });
    saveDraft();
  }

  async function loadCloudExam(recordId) {
    try {
      const recordRef = firebaseFirestoreSdk.doc(getCloudCollection(), recordId);
      const snapshot = await firebaseFirestoreSdk.getDoc(recordRef);
      if (!snapshot.exists()) {
        throw Object.assign(new Error("not-found"), { code: "not-found" });
      }

      restoreCloudExam(snapshot.data());
      currentCloudExamId = recordId;
      showMessage("已載入雲端考卷，並同步保存在這台電腦。", "success");
      resultCard.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (error) {
      showMessage(getCloudErrorMessage(error), "error");
      await loadCloudRecordList();
    }
  }

  async function deleteCloudExam(recordId) {
    if (!window.confirm("確定要刪除這筆雲端命題紀錄嗎？刪除後無法復原。")) {
      return;
    }

    try {
      await firebaseFirestoreSdk.deleteDoc(firebaseFirestoreSdk.doc(getCloudCollection(), recordId));
      if (currentCloudExamId === recordId) {
        currentCloudExamId = "";
      }
      setCloudStatus("雲端紀錄已刪除，本機表單內容仍保留");
      await loadCloudRecordList();
    } catch (error) {
      setCloudStatus(getCloudErrorMessage(error), true);
    }
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

  function safeExternalUrl(value) {
    try {
      const url = new URL(cleanValue(value));
      return ["http:", "https:"].includes(url.protocol) ? url.href : "";
    } catch {
      return "";
    }
  }

  function normalizeResourceItems(items) {
    if (!Array.isArray(items)) {
      return [];
    }

    const seenUrls = new Set();
    return items.reduce((result, item) => {
      const url = safeExternalUrl(item?.url);
      const title = cleanValue(item?.title);
      if (!url || !title || seenUrls.has(url)) {
        return result;
      }

      seenUrls.add(url);
      result.push({
        title,
        publisher: cleanValue(item?.publisher),
        date: cleanValue(item?.date),
        summary: cleanValue(item?.summary),
        url
      });
      return result;
    }, []);
  }

  function normalizeLawCaseItems(items) {
    if (!Array.isArray(items)) {
      return [];
    }

    const seenUrls = new Set();
    return items.reduce((result, item) => {
      const url = safeExternalUrl(item?.url);
      const title = cleanValue(item?.title);
      const publisher = cleanValue(item?.publisher);
      const date = cleanValue(item?.date);
      const summary = cleanValue(item?.summary);
      if (!url || !title || !publisher || !date || !summary || seenUrls.has(url)) {
        return result;
      }

      seenUrls.add(url);
      result.push({
        title,
        publisher,
        date,
        summary,
        url,
        legalTopic: cleanValue(item?.legalTopic)
      });
      return result;
    }, []);
  }

  function renderLawCaseCandidates(items, rangeStart, rangeEnd) {
    lawCaseCandidates = normalizeLawCaseItems(items);
    selectedLawCase = null;
    generateSelectedCaseButton.disabled = true;

    if (lawCaseCandidates.length === 0) {
      lawCaseResultsCard.hidden = true;
      lawCaseList.innerHTML = "";
      return;
    }

    const range = rangeStart && rangeEnd ? `${rangeStart} 至 ${rangeEnd}` : "近一年";
    lawCaseStatus.textContent = `搜尋期間：${range}｜共找到 ${lawCaseCandidates.length} 則候選新聞。請開啟原文查核後選擇一則。`;
    lawCaseList.innerHTML = lawCaseCandidates.map((item, index) => `
      <article class="question-slot">
        <div class="question-slot-header">
          <h3><label><input type="radio" name="law-case-choice" value="${index}"> ${escapeHtml(item.title)}</label></h3>
          <span>${escapeHtml(item.legalTopic || "法律與生活")}</span>
        </div>
        <p class="field-help">${escapeHtml(item.publisher)}｜${escapeHtml(item.date)}</p>
        <p>${escapeHtml(item.summary)}</p>
        <p><a href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer">開啟新聞原文確認</a></p>
      </article>
    `).join("");
    lawCaseResultsCard.hidden = false;
    lawCaseResultsCard.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function renderTeachingResources(data) {
    const normalized = data && typeof data === "object" ? {
      topic: cleanValue(data.topic),
      summary: cleanValue(data.summary),
      researchedAt: cleanValue(data.researchedAt),
      rangeStart: cleanValue(data.rangeStart),
      rangeEnd: cleanValue(data.rangeEnd),
      official: normalizeResourceItems(data.official),
      news: normalizeResourceItems(data.news),
      videos: normalizeResourceItems(data.videos),
      citations: normalizeResourceItems(data.citations)
    } : null;

    const groups = normalized ? [
      ["官方法規與權利救濟資料", normalized.official],
      ["台灣新聞案例", normalized.news],
      ["YouTube 延伸影片", normalized.videos],
      ["Gemini 網路搜尋引用", normalized.citations]
    ].filter(([, items]) => items.length > 0) : [];

    if (!normalized || groups.length === 0) {
      teachingResources = null;
      teachingResourcesCard.hidden = true;
      researchSummary.textContent = "";
      resourceList.innerHTML = "";
      return;
    }

    teachingResources = normalized;
    const range = normalized.rangeStart && normalized.rangeEnd
      ? `｜搜尋期間：${normalized.rangeStart} 至 ${normalized.rangeEnd}`
      : "";
    researchSummary.textContent = `${normalized.topic || "法律與生活近期案例"}${range}。${normalized.summary}`;
    resourceList.innerHTML = groups.map(([heading, items]) => `
      <article class="question-slot">
        <div class="question-slot-header">
          <h3>${escapeHtml(heading)}</h3>
          <span>${items.length} 筆｜待查核</span>
        </div>
        <ul>
          ${items.map((item) => `
            <li>
              <a href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.title)}</a>
              <p class="field-help">${escapeHtml([item.publisher, item.date].filter(Boolean).join("｜") || "來源日期待確認")}</p>
              ${item.summary ? `<p>${escapeHtml(item.summary)}</p>` : ""}
            </li>
          `).join("")}
        </ul>
      </article>
    `).join("");
    teachingResourcesCard.hidden = false;
  }

  function buildTeachingResourcesPrintHtml() {
    if (!teachingResources) {
      return "";
    }

    const items = [
      ...teachingResources.official,
      ...teachingResources.news,
      ...teachingResources.videos
    ];
    if (!items.length) {
      return "";
    }

    return `
      <section class="print-answer-block">
        <h2>延伸教材連結｜老師查核後使用</h2>
        <ul>
          ${items.map((item) => `<li>${escapeHtml(item.title)}｜${escapeHtml(item.url)}</li>`).join("")}
        </ul>
      </section>
    `;
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
      renderTeachingResources(draft.teachingResources);
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
    renderTeachingResources(null);
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

  async function searchLawCases() {
    clearMessage();

    if (window.location.protocol === "file:") {
      showMessage("法律新聞搜尋需要從正式網站開啟；直接雙擊檔案仍可編輯、保存與列印。", "error");
      return;
    }

    autoLawResearchButton.disabled = true;
    generateSelectedCaseButton.disabled = true;
    autoLawResearchButton.textContent = "正在搜尋新聞…";
    showMessage("Gemini 正在搜尋台灣近一年法律新聞，可能需要一些時間，請勿關閉頁面。", "success");

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          researchMode: "search"
        })
      });

      if (!response.ok) {
        throw new Error(await readErrorMessage(response));
      }

      const result = await response.json();
      if (!Array.isArray(result.cases) || result.cases.length === 0) {
        throw new Error("Gemini 沒有回傳可選擇的新聞案例，請再試一次。");
      }

      renderLawCaseCandidates(result.cases, result.rangeStart, result.rangeEnd);
      showMessage(`已找到 ${lawCaseCandidates.length} 則候選新聞。請先開啟原文查核，再選擇一則案例。`, "success");
    } catch (error) {
      const message = error instanceof Error ? error.message : "法律新聞搜尋失敗，請稍後再試。";
      showMessage(message, "error");
    } finally {
      autoLawResearchButton.disabled = false;
      generateSelectedCaseButton.disabled = !selectedLawCase;
      autoLawResearchButton.textContent = "重新搜尋近一年法律新聞";
    }
  }

  async function generateSelectedLawCaseDrafts() {
    clearMessage();

    if (!selectedLawCase) {
      showMessage("請先從搜尋結果選擇一則新聞案例。", "error");
      return;
    }

    if (questionSlots.length > 0) {
      showMessage("目前已有題目草稿，為避免覆蓋老師修改過的內容，請先使用「清除目前草稿」。", "error");
      return;
    }

    const hasExistingMaterial = [newsUrl.value, newsText.value, newsTitle.value, mediaName.value, publishDate.value]
      .some((value) => cleanValue(value));
    if (hasExistingMaterial && !window.confirm("將以您選取的案例取代目前新聞素材。確定要繼續嗎？")) {
      return;
    }

    questionType.value = questionType.value || "單選";
    questionCount.value = questionCount.value || "5";
    difficulty.value = difficulty.value || "中等";
    const requestedCount = Number(questionCount.value);

    autoLawResearchButton.disabled = true;
    generateDraftButton.disabled = true;
    generateSelectedCaseButton.disabled = true;
    generateSelectedCaseButton.textContent = "正在依選取案例出題…";
    showMessage("Gemini 正在查核選取案例並整理題目、官方資料與 YouTube 影片，請勿關閉頁面。", "success");

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          researchMode: "generate",
          selectedCase: selectedLawCase,
          questionType: questionType.value,
          questionCount: requestedCount,
          difficulty: difficulty.value
        })
      });

      if (!response.ok) {
        throw new Error(await readErrorMessage(response));
      }

      const result = await response.json();
      const lesson = result.lesson && typeof result.lesson === "object" ? result.lesson : null;
      if (!lesson || !Array.isArray(result.questions) || result.questions.length !== requestedCount) {
        throw new Error("Gemini 回傳的案例教材不完整，請再試一次。");
      }

      subject.value = cleanValue(lesson.subject) || "法律與生活";
      curriculumFocus.value = cleanValue(lesson.curriculumFocus);
      newsUrl.value = safeExternalUrl(lesson.newsUrl) || selectedLawCase.url;
      newsText.value = cleanValue(lesson.newsText) || selectedLawCase.summary;
      newsTitle.value = cleanValue(lesson.newsTitle) || selectedLawCase.title;
      mediaName.value = cleanValue(lesson.mediaName) || selectedLawCase.publisher;
      publishDate.value = cleanValue(lesson.publishDate) || selectedLawCase.date;
      examTitle.value = examTitle.value.trim() || `${newsTitle.value}｜${difficulty.value}`;
      switchSource(newsUrl.value ? "url" : "text", { focus: false, save: false });

      renderQuestionSlots(requestedCount);
      const filledCount = fillGeneratedQuestions(result.questions);
      if (filledCount !== requestedCount) {
        renderQuestionSlots(0);
        throw new Error("題目填入不完整，原本資料未被覆蓋，請再試一次。");
      }

      renderTeachingResources(result.resources);
      saveDraft();
      showMessage(`已依您選取的新聞完成 ${filledCount} 題草稿及延伸教材。請查核法律時效、事實、著作權、偏誤與答案唯一性。`, "success");
      resultCard.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "依選取案例產生考題失敗，請稍後再試。";
      showMessage(message, "error");
    } finally {
      autoLawResearchButton.disabled = false;
      generateDraftButton.disabled = false;
      generateSelectedCaseButton.disabled = !selectedLawCase;
      generateSelectedCaseButton.textContent = "依選取案例產生考題";
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
      ${isAnswerSheet ? buildTeachingResourcesPrintHtml() : ""}
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
  autoLawResearchButton.addEventListener("click", searchLawCases);
  generateSelectedCaseButton.addEventListener("click", generateSelectedLawCaseDrafts);
  lawCaseList.addEventListener("change", (event) => {
    const choice = event.target.closest('input[name="law-case-choice"]');
    if (!choice) {
      return;
    }

    selectedLawCase = lawCaseCandidates[Number(choice.value)] || null;
    generateSelectedCaseButton.disabled = !selectedLawCase;
    if (selectedLawCase) {
      lawCaseStatus.textContent = `已選擇：${selectedLawCase.title}｜請確認原文後再產生考題。`;
    }
  });
  googleSignInButton.addEventListener("click", handleGoogleSignIn);
  googleSignOutButton.addEventListener("click", handleGoogleSignOut);
  saveCloudExamButton.addEventListener("click", () => saveCloudExam(false));
  saveCloudExamAsButton.addEventListener("click", () => saveCloudExam(true));
  cloudRecordList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-cloud-action]");
    const record = button?.closest("[data-cloud-exam-id]");

    if (!button || !record) {
      return;
    }

    if (button.dataset.cloudAction === "load") {
      loadCloudExam(record.dataset.cloudExamId);
    } else if (button.dataset.cloudAction === "delete") {
      deleteCloudExam(record.dataset.cloudExamId);
    }
  });

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
  initializeFirebaseAuth();
})();
