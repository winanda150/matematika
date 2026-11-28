/**
 * AI-STORY-MODELER.JS - Integrasi Gemini AI, Smart Cache, & Normalisasi Pemodelan Soal Cerita
 */
(function (global) {
    "use strict";

    const App = (global.AljabarApp = global.AljabarApp || {});

    // Mendukung kunci dinamis dari GitHub Actions Secrets atau dekripsi runtime lokal
    const DEFAULT_GEMINI_KEY = "__GEMINI_API_KEY__".startsWith("__")
        ? atob("QVEuQWI4Uk42S3Bmdkk0VS1TcWhhZnVwS2NyVVNRRHhxYlZmMFFqbHRSWkdLWjFvVkFwc1E=")
        : "__GEMINI_API_KEY__";

    function hashCacheStr(str) {
        let h = 2166136261;
        for (let i = 0; i < str.length; i++) {
            h ^= str.charCodeAt(i);
            h = Math.imul(h, 16777619);
        }
        return (h >>> 0).toString(36);
    }

    function escapeSafeHtml(str) {
        if (App.Core && typeof App.Core.escapeHtml === "function") {
            return App.Core.escapeHtml(str);
        }
        if (str === null || str === undefined) return "";
        return String(str).replace(/[&<>"']/g, (ch) => {
            switch (ch) {
                case "&":
                    return "&amp;";
                case "<":
                    return "&lt;";
                case ">":
                    return "&gt;";
                case '"':
                    return "&quot;";
                case "'":
                    return "&#39;";
                default:
                    return ch;
            }
        });
    }

    function inferMimeType(file) {
        if (file && file.type) return file.type;
        const name = ((file && file.name) || "").toLowerCase();
        if (name.endsWith(".png")) return "image/png";
        if (name.endsWith(".webp")) return "image/webp";
        if (name.endsWith(".gif")) return "image/gif";
        if (name.endsWith(".bmp")) return "image/bmp";
        if (name.endsWith(".pdf")) return "application/pdf";
        return "image/jpeg";
    }

    function getProblemCacheKey(text, file) {
        const cleanText = (text || "").toLowerCase().replace(/\s+/g, " ").trim();
        const textSig = cleanText ? `${hashCacheStr(cleanText)}_${cleanText.length}` : "";
        if (file) {
            const fileSig = `${file.name || "file"}_${file.size || 0}_${file.lastModified || 0}`;
            const combined = textSig ? `${fileSig}_t_${textSig}` : fileSig;
            return "spl_cache_v4_img_" + encodeURIComponent(combined);
        }
        if (!cleanText) return null;
        return "spl_cache_v4_txt_" + textSig;
    }

    function getCachedProblemAnalysis(key) {
        if (!key) return null;
        try {
            const item = localStorage.getItem(key);
            if (item) return JSON.parse(item);
        } catch (e) {
            console.warn("Gagal membaca cache:", e);
        }
        return null;
    }

    function setCachedProblemAnalysis(key, data) {
        if (!key || !data) return;
        try {
            localStorage.setItem(key, JSON.stringify(data));
        } catch (e) {
            console.warn("Gagal menyimpan cache:", e);
        }
    }

    function parseMatrixScalar(val) {
        if (typeof val === "number") return isFinite(val) ? (val === 0 ? 0 : val) : 0;
        if (typeof val === "string") {
            const trimmed = val.trim();
            if (trimmed.includes("/")) {
                const parts = trimmed.split("/");
                const top = parseFloat(parts[0]);
                const bot = parseFloat(parts[1]);
                if (parts.length === 2 && !isNaN(top) && !isNaN(bot) && bot !== 0) {
                    const res = top / bot;
                    return res === 0 ? 0 : res;
                }
            }
            const num = parseFloat(trimmed);
            return isNaN(num) ? 0 : num === 0 ? 0 : num;
        }
        return 0;
    }

    function normalizeAiMatrix(rawMatrix) {
        if (!Array.isArray(rawMatrix) || rawMatrix.length === 0) return null;
        const maxCols = rawMatrix.reduce((acc, row) => Math.max(acc, Array.isArray(row) ? row.length : 0), 0);
        const inferredVars = maxCols >= 2 ? maxCols - 1 : 2;
        const dim = Math.min(4, Math.max(2, rawMatrix.length, inferredVars));
        const result = [];
        for (let r = 0; r < dim; r++) {
            const srcRow = Array.isArray(rawMatrix[r]) ? rawMatrix[r] : [];
            const row = new Array(dim + 1).fill(0);
            if (srcRow.length >= dim + 1) {
                for (let c = 0; c <= dim; c++) {
                    row[c] = parseMatrixScalar(srcRow[c]);
                }
            } else if (srcRow.length > 0) {
                const coeffCount = Math.min(dim, srcRow.length - 1);
                for (let c = 0; c < coeffCount; c++) {
                    row[c] = parseMatrixScalar(srcRow[c]);
                }
                row[dim] = parseMatrixScalar(srcRow[srcRow.length - 1]);
            }
            result.push(row);
        }
        return result;
    }

    function formatStandardEquationsFromMatrix(matrix) {
        if (!Array.isArray(matrix) || matrix.length === 0) return [];
        const dim = matrix.length;
        return matrix.map((row) => {
            let lhs = "";
            for (let c = 0; c < dim; c++) {
                const val = parseMatrixScalar(row[c]);
                if (c === 0) {
                    lhs += `${val}x${c + 1}`;
                } else if (val < 0) {
                    lhs += ` - ${Math.abs(val)}x${c + 1}`;
                } else {
                    lhs += ` + ${val}x${c + 1}`;
                }
            }
            const kVal = parseMatrixScalar(row[dim]);
            return `${lhs} = ${kVal}`;
        });
    }

    function formatConciseStoryTitle(rawTitle) {
        if (!rawTitle || typeof rawTitle !== "string") return "Pemodelan Soal Cerita";
        let clean = rawTitle.trim();
        clean = clean.replace(
            /^(?:penyelesaian\s+(?:soal|masalah|kasus)|pemodelan\s+(?:soal|masalah|kasus|spl)|studi\s+kasus|analisis\s+(?:soal|masalah|kasus)|soal\s+cerita)\s*:?\s*/i,
            ""
        );
        clean = clean.replace(/\s+(?:dengan|menggunakan|melalui|via)\s+(?:metode\s+)?(?:eliminasi\s+)?gauss(?:-|\s+)?(?:jordan)?$/i, "");
        clean = clean.trim();
        if (!clean) return "Pemodelan Soal Cerita";
        return clean.charAt(0).toUpperCase() + clean.slice(1);
    }

    function formatConciseVariableDesc(rawVar) {
        if (!rawVar || typeof rawVar !== "string") return "";
        let clean = rawVar.trim();
        clean = clean.replace(
            /\s+yang\s+(?:akan\s+|harus\s+|dapat\s+|bisa\s+)?(?:dihasilkan|diproduksi|dibuat|disediakan|tersedia|digunakan|dibutuhkan|diperlukan|diminta|terjual|dijual|dibeli|diinvestasikan|ditanam)(?:\s+per\s+\w+)?\s*\.?$/i,
            ""
        );
        return clean.replace(/\.\s*$/, "").trim();
    }

    function detectMethodFromStoryText(text) {
        if (!text) return null;
        const lower = text.toLowerCase();

        if (
            lower.includes("gauss-jordan") ||
            lower.includes("gauss jordan") ||
            lower.includes("eselon baris tereduksi") ||
            /\brref\b/.test(lower)
        ) {
            return "gauss_jordan";
        }

        if (
            /\bgauss\b/.test(lower) ||
            lower.includes("eselon baris") ||
            lower.includes("substitusi balik") ||
            /\bref\b/.test(lower)
        ) {
            return "gauss";
        }

        if (/\bjordan\b/.test(lower)) {
            return "gauss_jordan";
        }

        return null;
    }

    function readFilePayload(file) {
        const reader = new FileReader();
        let aborted = false;

        const promise = new Promise((resolve, reject) => {
            reader.onload = () => {
                if (aborted) {
                    resolve(null);
                    return;
                }
                const resultStr = typeof reader.result === "string" ? reader.result : "";
                const commaIdx = resultStr.indexOf(",");
                const base64 = commaIdx !== -1 ? resultStr.substring(commaIdx + 1) : resultStr;
                const mimeType = inferMimeType(file);

                if (mimeType.startsWith("image/")) {
                    const probe = new Image();
                    probe.onload = () => {
                        if (aborted) {
                            resolve(null);
                            return;
                        }
                        if (typeof probe.decode === "function") {
                            probe
                                .decode()
                                .then(() => resolve({ file, mimeType, base64 }))
                                .catch(() => resolve({ file, mimeType, base64 }));
                        } else {
                            resolve({ file, mimeType, base64 });
                        }
                    };
                    probe.onerror = () => {
                        if (!aborted) {
                            reject(new Error("Berkas gambar tidak dapat dibaca atau rusak. Pastikan format PNG, JPG, atau JPEG valid."));
                        }
                    };
                    probe.src = resultStr;
                } else {
                    resolve({ file, mimeType, base64 });
                }
            };

            reader.onerror = () => {
                if (!aborted) {
                    reject(new Error("Gagal membaca berkas dari perangkat Anda."));
                }
            };

            reader.onabort = () => {
                resolve(null);
            };

            reader.readAsDataURL(file);
        });

        return {
            promise,
            abort: () => {
                if (aborted) return;
                aborted = true;
                try {
                    if (reader.readyState === FileReader.LOADING) {
                        reader.abort();
                    }
                } catch (_) {
                    // Abaikan bila pembacaan sudah selesai
                }
            }
        };
    }

    async function analyzeStoryProblemWithGemini(userText, imageFile, knownMethod = null, preparedPayload = null, externalSignal = null) {
        let imageBase64 = null;
        let mimeType = inferMimeType(imageFile);

        if (preparedPayload && preparedPayload.base64 && (!imageFile || preparedPayload.file === imageFile)) {
            imageBase64 = preparedPayload.base64;
            mimeType = preparedPayload.mimeType || mimeType;
        } else if (imageFile) {
            const readRes = await readFilePayload(imageFile).promise;
            if (!readRes || !readRes.base64) {
                throw new Error("Gagal memproses berkas soal.");
            }
            imageBase64 = readRes.base64;
            mimeType = readRes.mimeType;
        }

        const needAiMethod = !knownMethod;

        const systemPrompt = needAiMethod
            ? `Pakar Aljabar Linier. Analisis soal cerita/gambar ini secara cermat:
1. Tentukan judul topik yang ringkas, tepat, dan sesuai inti soal cerita (2-4 kata, misal: "Campuran Yogurt", "Produksi Kue", "Harga Tiket Konser"), TANPA kata "Penyelesaian Soal", "Studi Kasus", atau nama metode eliminasi.
2. Tentukan seluruh variabel keputusan (x1..xn) dan deskripsinya secara singkat, padat, langsung pada objek/satuannya (misal: "x1 = jumlah galon campuran Limeorange"), TANPA anak kalimat penjelas di akhir seperti "yang dihasilkan" atau "yang diproduksi".
3. Susun model SPL standar lengkap dengan menulis SEMUA suku variabel x1..xn di setiap persamaan secara berurutan, TERMASUK koefisien 0 dan 1 (contoh 3x3: "2x1 + 0x2 + 3x3 = 650"; contoh 2x2: "2x1 + 1x2 = 70").
4. Susun matriks augmented [A|k] tepat berukuran 2x3 (untuk 2x2), 3x4 (untuk 3x3), atau 4x5 (untuk 4x4) yang sinkron 100% dengan persamaan.
5. Tentukan metode sesuai instruksi soal: "gauss" atau "gauss_jordan".
6. Pada field "explanation", salin/ekstrak secara utuh dan persis kalimat pertanyaan atau perintah utama yang ditanyakan oleh soal cerita tersebut (misal: "Tentukan berapa banyak ...?"), TANPA penjelasan cara penyelesaian atau matriks.

Output WAJIB JSON murni:
{
  "title": "Campuran Yogurt",
  "variables": ["x1 = jumlah galon campuran ...", "x2 = jumlah galon campuran ..."],
  "equations": ["2x1 + 3x2 + 0x3 = 800", "2x1 + 0x2 + 3x3 = 650", "0x1 + 1x2 + 1x3 = 350"],
  "matrix": [[2, 3, 0, 800], [2, 0, 3, 650], [0, 1, 1, 350]],
  "method": "gauss_jordan",
  "explanation": "Tentukan berapa banyak ...?"
}`
            : `Pakar Aljabar Linier. Analisis soal cerita ini menjadi SPL standar:
1. Tentukan judul topik yang ringkas, tepat, dan sesuai inti soal cerita (2-4 kata, misal: "Campuran Yogurt", "Produksi Kue"), TANPA kata "Penyelesaian Soal", "Studi Kasus", atau nama metode eliminasi.
2. Tentukan seluruh variabel keputusan (x1..xn) dan deskripsinya secara singkat, padat, langsung pada objek/satuannya (misal: "x1 = jumlah galon campuran Limeorange"), TANPA anak kalimat penjelas seperti "yang dihasilkan/diproduksi".
3. Susun model SPL standar lengkap dengan menulis SEMUA suku variabel x1..xn di setiap persamaan, TERMASUK koefisien 0 dan 1.
4. Susun matriks augmented [A|k] tepat berukuran 2x3 (2x2), 3x4 (3x3), atau 4x5 (4x4).
5. Pada field "explanation", salin/ekstrak secara utuh dan persis kalimat pertanyaan atau perintah utama yang ditanyakan oleh soal cerita tersebut (misal: "Tentukan berapa banyak ...?"), TANPA penjelasan cara penyelesaian atau matriks.

Output WAJIB JSON murni:
{
  "title": "Campuran Yogurt",
  "variables": ["x1 = jumlah galon campuran ...", "x2 = jumlah galon campuran ..."],
  "equations": ["2x1 + 3x2 + 0x3 = 800", "2x1 + 0x2 + 3x3 = 650", "0x1 + 1x2 + 1x3 = 350"],
  "matrix": [[2, 3, 0, 800], [2, 0, 3, 650], [0, 1, 1, 350]],
  "explanation": "Tentukan berapa banyak ...?"
}`;

        const parts = [];
        if (imageBase64) {
            parts.push({
                inlineData: {
                    mimeType: mimeType,
                    data: imageBase64
                }
            });
        }

        let promptContent = systemPrompt;
        if (userText) {
            promptContent += `\n\nSoal: "${userText}"`;
        } else if (imageBase64) {
            promptContent += `\n\nEkstraksi soal dari gambar terlampir.`;
        }
        parts.push({ text: promptContent });

        const activeKey = DEFAULT_GEMINI_KEY;
        const models = ["gemini-flash-lite-latest", "gemini-3.1-flash-lite", "gemini-3.5-flash-lite"];
        let lastError = null;

        for (const model of models) {
            if (externalSignal && externalSignal.aborted) {
                const abortErr = new Error("Analisis soal dibatalkan.");
                abortErr.isAborted = true;
                throw abortErr;
            }
            const reqCtrl = typeof AbortController !== "undefined" ? new AbortController() : null;
            let didTimeout = false;
            const onExtAbort = () => {
                if (reqCtrl) reqCtrl.abort();
            };
            if (externalSignal && reqCtrl) {
                externalSignal.addEventListener("abort", onExtAbort, { once: true });
            }
            const timeoutId = reqCtrl
                ? setTimeout(() => {
                      didTimeout = true;
                      reqCtrl.abort();
                  }, 45000)
                : null;

            try {
                const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${activeKey}`;
                const response = await fetch(url, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    signal: reqCtrl ? reqCtrl.signal : undefined,
                    body: JSON.stringify({
                        contents: [{ parts: parts }],
                        generationConfig: {
                            responseMimeType: "application/json",
                            temperature: 0.1
                        }
                    })
                });

                if (!response.ok) {
                    const errData = await response.json().catch(() => ({}));
                    const errMsg = errData.error?.message || `HTTP ${response.status}`;
                    const is429 =
                        response.status === 429 ||
                        errMsg.includes("429") ||
                        errMsg.toLowerCase().includes("quota") ||
                        errMsg.toLowerCase().includes("limit") ||
                        errMsg.toLowerCase().includes("resourceexhausted") ||
                        errMsg.toLowerCase().includes("resource_exhausted");
                    const errorObj = new Error(errMsg);
                    errorObj.status = response.status;
                    errorObj.isQuotaLimit = is429;
                    throw errorObj;
                }

                const resData = await response.json();
                const candidate = resData.candidates?.[0];
                if (!candidate || !candidate.content?.parts?.[0]?.text) {
                    throw new Error("Respons model Gemini kosong atau tidak valid.");
                }

                const rawJsonText = candidate.content.parts[0].text.trim();
                let cleanJsonText = rawJsonText;
                if (cleanJsonText.startsWith("```")) {
                    cleanJsonText = cleanJsonText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
                }
                const parsed = JSON.parse(cleanJsonText);

                if (knownMethod) {
                    parsed.method = knownMethod;
                    parsed._detectedLocally = true;
                }

                return parsed;
            } catch (err) {
                if (externalSignal && externalSignal.aborted) {
                    const abortErr = new Error("Analisis soal dibatalkan.");
                    abortErr.isAborted = true;
                    throw abortErr;
                }
                if (didTimeout) {
                    lastError = new Error("Waktu permintaan ke server Gemini AI habis. Silakan coba lagi.");
                } else {
                    lastError = err;
                }
                console.warn(`Model ${model} gagal atau sibuk:`, lastError.message);
                if (err.isQuotaLimit || err.status === 429) {
                    throw err;
                }
            } finally {
                if (timeoutId) clearTimeout(timeoutId);
                if (externalSignal && reqCtrl) {
                    externalSignal.removeEventListener("abort", onExtAbort);
                }
            }
        }

        throw lastError || new Error("Gagal menghubungi Gemini API. Periksa koneksi internet Anda.");
    }

    function init() {
        const storyAppBtn = document.getElementById("btn-story-app");
        const storyProblemPanel = document.getElementById("story-problem-panel");
        const storyTextInput = document.getElementById("story-text-input");
        const storyFileInput = document.getElementById("story-file-input");
        const storyFilePreview = document.getElementById("story-file-preview");
        const storyFileName = document.getElementById("story-file-name");
        const removeFileBtn = document.getElementById("remove-file-btn");
        const btnParseStory = document.getElementById("btn-parse-story");

        const apiStatusBadge = document.getElementById("api-status-badge");
        const apiStatusText = document.getElementById("api-status-text");
        const storyQuotaCard = document.getElementById("story-quota-card");
        const quotaRetryBtn = document.getElementById("quota-retry-btn");

        const aiStoryAnalysisCard = document.getElementById("ai-story-analysis-card");
        const aiStoryTitle = document.getElementById("ai-story-title");
        const aiMethodBadge = document.getElementById("ai-method-badge");
        const aiStoryVariables = document.getElementById("ai-story-variables");
        const aiStoryEquations = document.getElementById("ai-story-equations");
        const aiStoryExplanation = document.getElementById("ai-story-explanation");

        let splApi = null;

        function setApiStatusUi(status = "active") {
            if (!apiStatusBadge) return;
            const dot = apiStatusBadge.querySelector(".api-status-dot");
            const text = apiStatusText || apiStatusBadge.querySelector(".api-status-text");

            if (status === "limit") {
                if (dot) {
                    dot.style.background = "#f59e0b";
                    dot.style.boxShadow = "0 0 0 2px rgba(245, 158, 11, 0.25)";
                }
                if (text) {
                    text.textContent = "Antrean Kuota AI Penuh";
                    text.style.color = "#b45309";
                }
                apiStatusBadge.style.background = "#fffbeb";
                apiStatusBadge.style.borderColor = "#fde68a";
            } else {
                if (dot) {
                    dot.style.background = "#10b981";
                    dot.style.boxShadow = "0 0 0 2px rgba(16, 185, 129, 0.2)";
                }
                if (text) {
                    text.textContent = "Gemini AI Terhubung";
                    text.style.color = "#15803d";
                }
                apiStatusBadge.style.background = "#f0fdf4";
                apiStatusBadge.style.borderColor = "#bbf7d0";
            }
        }

        function displayAiStoryAnalysis(data) {
            if (!aiStoryAnalysisCard) return;

            if (aiStoryTitle) {
                aiStoryTitle.textContent = formatConciseStoryTitle(data.title);
            }

            if (aiMethodBadge) {
                const isGauss = data.method === "gauss";
                const isLocal = data._detectedLocally === true;
                aiMethodBadge.textContent = isGauss
                    ? isLocal
                        ? "Metode Soal: Eliminasi Gauss"
                        : "Metode AI: Eliminasi Gauss"
                    : isLocal
                      ? "Metode Soal: Eliminasi Gauss-Jordan"
                      : "Metode AI: Eliminasi Gauss-Jordan";
                aiMethodBadge.style.background = isGauss ? "#eff6ff" : "#f0fdf4";
                aiMethodBadge.style.color = isGauss ? "#1d4ed8" : "#166534";
                aiMethodBadge.style.borderColor = isGauss ? "#bfdbfe" : "#bbf7d0";
            }

            if (aiStoryVariables) {
                aiStoryVariables.innerHTML = "";
                if (Array.isArray(data.variables)) {
                    data.variables.forEach((v) => {
                        const li = document.createElement("li");
                        li.textContent = formatConciseVariableDesc(v);
                        aiStoryVariables.appendChild(li);
                    });
                }
            }

            if (aiStoryEquations) {
                aiStoryEquations.innerHTML = "";
                const eqList =
                    Array.isArray(data.matrix) && data.matrix.length > 0
                        ? formatStandardEquationsFromMatrix(data.matrix)
                        : Array.isArray(data.equations)
                          ? data.equations
                          : [];
                eqList.forEach((eq) => {
                    const eqDiv = document.createElement("div");
                    eqDiv.textContent = eq;
                    aiStoryEquations.appendChild(eqDiv);
                });
            }

            if (aiStoryExplanation) {
                const qText = (data.explanation || "").trim().replace(/^["']|["']$/g, "");
                aiStoryExplanation.textContent = qText || "Tentukan nilai setiap variabel yang memenuhi sistem persamaan linear pada soal.";
            }

            aiStoryAnalysisCard.classList.remove("hidden");
        }

        function applyAiStoryResult(resultObj) {
            if (!splApi) return false;
            const normalizedMat = normalizeAiMatrix(resultObj.matrix);
            if (!normalizedMat) return false;

            resultObj.title = formatConciseStoryTitle(resultObj.title);
            if (Array.isArray(resultObj.variables)) {
                resultObj.variables = resultObj.variables.map(formatConciseVariableDesc);
            }
            resultObj.matrix = normalizedMat;
            resultObj.equations = formatStandardEquationsFromMatrix(normalizedMat);
            const dim = normalizedMat.length;

            splApi.setActiveSizePill(dim);

            const determinedMethod = resultObj.method === "gauss" ? "gauss" : "gauss_jordan";
            splApi.setCurrentMethod(determinedMethod);

            splApi.clearMethodPills();
            if (storyAppBtn) {
                storyAppBtn.classList.add("active");
                storyAppBtn.setAttribute("aria-checked", "true");
            }

            splApi.renderSplInputs(dim, normalizedMat);
            displayAiStoryAnalysis(resultObj);
            splApi.executeSplResolution(normalizedMat, determinedMethod);
            return true;
        }

        if (storyAppBtn && storyProblemPanel) {
            storyAppBtn.addEventListener("click", () => {
                if (storyAppBtn.classList.contains("active") && !storyProblemPanel.classList.contains("hidden")) {
                    return;
                }
                if (splApi) {
                    splApi.clearMethodPills();
                    splApi.setCurrentMethod("story");
                    splApi.hideManualSections();
                    splApi.hideMessages();
                }
                if (aiStoryAnalysisCard) aiStoryAnalysisCard.classList.add("hidden");
                storyAppBtn.classList.add("active");
                storyAppBtn.setAttribute("aria-checked", "true");
                storyProblemPanel.classList.remove("hidden");
                if (storyQuotaCard) storyQuotaCard.classList.add("hidden");
            });
        }

        const storyDropzone = document.getElementById("story-dropzone");
        const animator = App.UploadAnimator && typeof App.UploadAnimator.init === "function" ? App.UploadAnimator.init() : null;

        let selectedFileRef = null;
        let preparedImagePayload = null;
        let activeReaderHandle = null;
        let activeAnimatorHandle = null;
        let activeAnalysisController = null;
        let analysisSessionToken = 0;
        let isFileUploading = false;
        let isAiAnalyzing = false;
        const defaultParseBtnHtml = btnParseStory ? btnParseStory.innerHTML : "Ekstraksi Matriks & Selesaikan OBE";

        function cancelOngoingAnalysis() {
            analysisSessionToken += 1;
            if (activeAnalysisController) {
                try {
                    activeAnalysisController.abort();
                } catch (_) {}
                activeAnalysisController = null;
            }
            if (isAiAnalyzing) {
                isAiAnalyzing = false;
                if (animator) animator.stopScan(false);
                if (btnParseStory && !isFileUploading) {
                    btnParseStory.disabled = false;
                    btnParseStory.classList.remove("is-upload-waiting");
                    btnParseStory.innerHTML = defaultParseBtnHtml;
                }
            }
        }

        function setUploadWaitingState(waiting) {
            isFileUploading = waiting;
            if (!btnParseStory || isAiAnalyzing) return;
            if (waiting) {
                btnParseStory.disabled = true;
                btnParseStory.classList.add("is-upload-waiting");
                btnParseStory.innerHTML = '<span class="ai-spinner"></span> Menyiapkan Gambar Soal...';
            } else {
                btnParseStory.disabled = false;
                btnParseStory.classList.remove("is-upload-waiting");
                btnParseStory.innerHTML = defaultParseBtnHtml;
            }
        }

        function cancelOngoingUpload() {
            if (activeReaderHandle) {
                activeReaderHandle.abort();
                activeReaderHandle = null;
            }
            if (activeAnimatorHandle) {
                activeAnimatorHandle.abort();
                activeAnimatorHandle = null;
            }
            setUploadWaitingState(false);
        }

        function isSupportedQuestionFile(file) {
            if (!file) return false;
            if (file.type && (file.type.startsWith("image/") || file.type === "application/pdf")) {
                return true;
            }
            return /\.(png|jpe?g|webp|gif|bmp|pdf)$/i.test(file.name || "");
        }

        function handleSelectedFile(file) {
            if (!file) return;

            if (!isSupportedQuestionFile(file) || file.size === 0) {
                cancelOngoingUpload();
                selectedFileRef = null;
                preparedImagePayload = null;
                if (storyFileInput) storyFileInput.value = "";
                if (animator) animator.animateFileRemove();
                if (splApi) {
                    splApi.showSplError(`
            <div class="error-title">Format Berkas Tidak Didukung</div>
            <div class="error-desc">Silakan pilih berkas gambar soal berformat PNG, JPG, JPEG, atau PDF yang valid.</div>
          `);
                }
                return;
            }

            if (splApi) splApi.hideMessages();
            cancelOngoingAnalysis();
            cancelOngoingUpload();

            selectedFileRef = file;
            preparedImagePayload = null;
            setUploadWaitingState(true);

            const readerHandle = readFilePayload(file);
            activeReaderHandle = readerHandle;

            const animHandle = animator
                ? animator.startUploadProgress(file, {
                      onReady: () => {
                          if (selectedFileRef !== file) return;
                          activeAnimatorHandle = null;
                          setUploadWaitingState(false);
                      }
                  })
                : null;
            activeAnimatorHandle = animHandle;

            if (!animHandle && storyFileName && storyFilePreview) {
                storyFileName.textContent = file.name;
                storyFilePreview.classList.remove("hidden");
            }

            readerHandle.promise
                .then((payload) => {
                    if (selectedFileRef !== file || activeReaderHandle !== readerHandle) return;
                    activeReaderHandle = null;
                    if (!payload) return;
                    preparedImagePayload = payload;
                    if (animHandle) {
                        animHandle.markPayloadReady();
                    } else {
                        setUploadWaitingState(false);
                    }
                })
                .catch((err) => {
                    if (selectedFileRef !== file || activeReaderHandle !== readerHandle) return;
                    activeReaderHandle = null;
                    selectedFileRef = null;
                    preparedImagePayload = null;
                    if (storyFileInput) storyFileInput.value = "";
                    if (animHandle) animHandle.abort();
                    activeAnimatorHandle = null;
                    setUploadWaitingState(false);
                    if (animator) animator.animateFileRemove();
                    if (splApi) {
                        splApi.showSplError(`
              <div class="error-title">Gagal Memuat Gambar Soal</div>
              <div class="error-desc">${escapeSafeHtml(err.message || "Berkas tidak dapat diproses.")}</div>
            `);
                    }
                });
        }

        if (storyFileInput && storyFileName && storyFilePreview) {
            storyFileInput.addEventListener("change", (e) => {
                const file = e.target.files[0];
                if (file) handleSelectedFile(file);
            });

            if (storyDropzone) {
                storyDropzone.addEventListener("dragover", (e) => {
                    e.preventDefault();
                    if (animator) animator.setDragActive(true);
                    else storyDropzone.classList.add("drag-over");
                });

                storyDropzone.addEventListener("dragleave", (e) => {
                    if (!storyDropzone.contains(e.relatedTarget)) {
                        if (animator) animator.setDragActive(false);
                        else storyDropzone.classList.remove("drag-over");
                    }
                });

                storyDropzone.addEventListener("drop", (e) => {
                    e.preventDefault();
                    if (animator) animator.setDragActive(false);
                    else storyDropzone.classList.remove("drag-over");
                    const files = e.dataTransfer && e.dataTransfer.files;
                    if (files && files.length > 0) {
                        try {
                            const dt = new DataTransfer();
                            dt.items.add(files[0]);
                            storyFileInput.files = dt.files;
                        } catch (_) {
                            // Fallback bila DataTransfer tidak didukung penuh
                        }
                        handleSelectedFile(files[0]);
                    }
                });
            }

            if (removeFileBtn) {
                removeFileBtn.addEventListener("click", (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    cancelOngoingAnalysis();
                    cancelOngoingUpload();
                    selectedFileRef = null;
                    preparedImagePayload = null;
                    storyFileInput.value = "";
                    if (animator) {
                        animator.animateFileRemove();
                    } else {
                        storyFilePreview.classList.add("hidden");
                    }
                });
            }
        }

        if (quotaRetryBtn && btnParseStory) {
            quotaRetryBtn.addEventListener("click", () => {
                if (storyQuotaCard) storyQuotaCard.classList.add("hidden");
                setApiStatusUi("active");
                btnParseStory.click();
            });
        }

        if (btnParseStory) {
            btnParseStory.addEventListener("click", async () => {
                if (isFileUploading || isAiAnalyzing) return;

                const textVal = storyTextInput ? storyTextInput.value.trim() : "";
                const inputFile =
                    storyFileInput && storyFileInput.files && storyFileInput.files.length > 0 ? storyFileInput.files[0] : null;
                const file = inputFile || selectedFileRef;
                const hasFile = Boolean(file);

                if (!textVal && !hasFile) {
                    if (splApi) {
                        splApi.showSplError(`
              <div class="error-title">Soal Cerita Belum Dimasukkan</div>
              <div class="error-desc">Silakan ketik/tempel teks soal cerita atau unggah foto/gambar soal terlebih dahulu.</div>
            `);
                    }
                    return;
                }

                if (splApi) {
                    splApi.hideMessages();
                    splApi.hideManualSections();
                }
                if (aiStoryAnalysisCard) aiStoryAnalysisCard.classList.add("hidden");
                if (storyQuotaCard) storyQuotaCard.classList.add("hidden");
                setApiStatusUi("active");

                // 1. Cek Smart Cache lokal (0 token)
                const cacheKey = getProblemCacheKey(textVal, file);
                const cachedResult = getCachedProblemAnalysis(cacheKey);
                if (cachedResult && applyAiStoryResult(cachedResult)) {
                    if (animator) {
                        if (hasFile) animator.stopScan(true);
                        animator.animateAnalysisReveal(aiStoryAnalysisCard, document.getElementById("spl-result-area"));
                    }
                    return;
                }

                const localMethod = !hasFile && textVal ? detectMethodFromStoryText(textVal) : null;

                // 2. Panggil Gemini AI + Animasi Laser Scan
                const sessionToken = ++analysisSessionToken;
                const ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
                activeAnalysisController = ctrl;
                isAiAnalyzing = true;
                btnParseStory.disabled = true;
                btnParseStory.classList.remove("is-upload-waiting");
                btnParseStory.innerHTML = '<span class="ai-spinner"></span> Menganalisis Soal dengan Gemini AI...';
                if (hasFile && animator) animator.startScan();

                try {
                    const aiResult = await analyzeStoryProblemWithGemini(
                        textVal,
                        file,
                        localMethod,
                        preparedImagePayload,
                        ctrl ? ctrl.signal : null
                    );

                    if (sessionToken !== analysisSessionToken) return;

                    if (!aiResult || !Array.isArray(aiResult.matrix) || aiResult.matrix.length === 0) {
                        throw new Error("Matriks hasil ekstraksi AI tidak valid.");
                    }

                    const normalizedMat = normalizeAiMatrix(aiResult.matrix);
                    if (!normalizedMat) {
                        throw new Error("Dimensi matriks hasil ekstraksi AI tidak valid.");
                    }
                    const isAllCoeffZero = normalizedMat.every((row) =>
                        row.slice(0, normalizedMat.length).every((val) => val === 0)
                    );
                    if (isAllCoeffZero) {
                        throw new Error("Model AI tidak dapat menemukan persamaan linear yang valid dari soal tersebut.");
                    }
                    aiResult.matrix = normalizedMat;
                    aiResult.equations = formatStandardEquationsFromMatrix(normalizedMat);

                    if (cacheKey) {
                        setCachedProblemAnalysis(cacheKey, aiResult);
                    }

                    applyAiStoryResult(aiResult);
                    if (animator) {
                        if (hasFile) animator.stopScan(true);
                        animator.animateAnalysisReveal(aiStoryAnalysisCard, document.getElementById("spl-result-area"));
                    }
                } catch (err) {
                    if (sessionToken !== analysisSessionToken || err.isAborted) return;
                    if (hasFile && animator) animator.stopScan(false);
                    console.error("Error analisis soal cerita:", err);
                    const isQuota =
                        err.isQuotaLimit ||
                        err.status === 429 ||
                        (err.message &&
                            (err.message.includes("429") ||
                                err.message.toLowerCase().includes("quota") ||
                                err.message.toLowerCase().includes("limit") ||
                                err.message.toLowerCase().includes("resourceexhausted") ||
                                err.message.toLowerCase().includes("resource_exhausted") ||
                                err.message.toLowerCase().includes("antrean")));

                    if (isQuota) {
                        if (storyQuotaCard) storyQuotaCard.classList.remove("hidden");
                        setApiStatusUi("limit");
                        if (splApi) splApi.hideMessages();
                    } else if (splApi) {
                        splApi.showSplError(`
              <div class="error-title">Gagal Menganalisis Soal Cerita</div>
              <div class="error-desc">${escapeSafeHtml(err.message || "Terjadi kesalahan saat menganalisis soal.")}</div>
            `);
                    }
                } finally {
                    if (activeAnalysisController === ctrl) {
                        activeAnalysisController = null;
                    }
                    if (sessionToken === analysisSessionToken) {
                        isAiAnalyzing = false;
                        if (isFileUploading) {
                            setUploadWaitingState(true);
                        } else {
                            btnParseStory.disabled = false;
                            btnParseStory.classList.remove("is-upload-waiting");
                            btnParseStory.innerHTML = defaultParseBtnHtml;
                        }
                    }
                }
            });
        }

        return {
            bindSplApi: (api) => {
                splApi = api;
            },
            hideStoryUi: () => {
                cancelOngoingAnalysis();
                if (animator) animator.stopScan(false);
                if (storyProblemPanel) storyProblemPanel.classList.add("hidden");
                if (aiStoryAnalysisCard) aiStoryAnalysisCard.classList.add("hidden");
                if (storyQuotaCard) storyQuotaCard.classList.add("hidden");
            }
        };
    }

    App.AiStoryModeler = {
        parseMatrixScalar,
        normalizeAiMatrix,
        formatStandardEquationsFromMatrix,
        formatConciseStoryTitle,
        formatConciseVariableDesc,
        detectMethodFromStoryText,
        init
    };
})(typeof window !== "undefined" ? window : globalThis);
