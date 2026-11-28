/**
 * QUICK-CALCULATOR.JS - Evaluator Ekspresi & Handler Keypad Kalkulator Cepat
 */
(function (global) {
    "use strict";

    const App = (global.AljabarApp = global.AljabarApp || {});

    function tokenizeMathExpression(expr) {
        const tokens = [];
        let i = 0;
        const len = expr.length;

        while (i < len) {
            const ch = expr[i];
            if (/\s/.test(ch)) {
                i++;
                continue;
            }
            if ("+-*/^%()".includes(ch)) {
                tokens.push({ type: ch === "(" ? "LPAREN" : ch === ")" ? "RPAREN" : "OP", value: ch });
                i++;
                continue;
            }
            if ((ch >= "0" && ch <= "9") || ch === ".") {
                const start = i;
                let hasDot = false;
                let hasDigit = false;
                while (i < len) {
                    const c = expr[i];
                    if (c >= "0" && c <= "9") {
                        hasDigit = true;
                        i++;
                    } else if (c === ".") {
                        if (hasDot) {
                            throw new Error("Format ekspresi matematika belum lengkap atau tidak valid.");
                        }
                        hasDot = true;
                        i++;
                    } else {
                        break;
                    }
                }
                if (!hasDigit) {
                    throw new Error("Format ekspresi matematika belum lengkap atau tidak valid.");
                }
                tokens.push({ type: "NUM", value: Number(expr.slice(start, i)) });
                continue;
            }
            throw new Error("Terdapat simbol atau karakter yang tidak didukung.");
        }

        return tokens;
    }

    function evaluateMathTokens(tokens) {
        let pos = 0;
        const peek = () => tokens[pos] || null;
        const consume = () => tokens[pos++];

        function parseExpression() {
            let left = parseTerm();
            while (peek() && peek().type === "OP" && (peek().value === "+" || peek().value === "-")) {
                const op = consume().value;
                const right = parseTerm();
                left = op === "+" ? left + right : left - right;
            }
            return left;
        }

        function isImplicitMulStart(prevTok, nextTok) {
            if (!nextTok) return false;
            if (nextTok.type === "LPAREN") {
                return prevTok.type === "NUM" || prevTok.type === "RPAREN" || (prevTok.type === "OP" && prevTok.value === "%");
            }
            if (nextTok.type === "NUM") {
                return prevTok.type === "RPAREN" || (prevTok.type === "OP" && prevTok.value === "%");
            }
            return false;
        }

        function parseTerm() {
            const firstStart = parseUnaryWithEnd();
            let left = firstStart.val;
            let lastTok = firstStart.endTok;

            while (peek()) {
                const next = peek();
                if (next.type === "OP" && (next.value === "*" || next.value === "/")) {
                    const op = consume().value;
                    const rhs = parseUnaryWithEnd();
                    if (op === "/") {
                        if (rhs.val === 0) {
                            throw new Error("Pembagian dengan nol tidak terdefinisi dalam matematika.");
                        }
                        left = left / rhs.val;
                    } else {
                        left = left * rhs.val;
                    }
                    lastTok = rhs.endTok;
                } else if (isImplicitMulStart(lastTok, next)) {
                    const rhs = parseUnaryWithEnd();
                    left = left * rhs.val;
                    lastTok = rhs.endTok;
                } else {
                    break;
                }
            }
            return left;
        }

        function parseUnaryWithEnd() {
            const t = peek();
            if (t && t.type === "OP" && (t.value === "+" || t.value === "-")) {
                const op = consume().value;
                const inner = parseUnaryWithEnd();
                return {
                    val: op === "-" ? -inner.val : inner.val,
                    endTok: inner.endTok
                };
            }
            return parsePowerWithEnd();
        }

        function parsePowerWithEnd() {
            const base = parsePostfixWithEnd();
            if (peek() && peek().type === "OP" && peek().value === "^") {
                consume();
                const exp = parseUnaryWithEnd();
                return {
                    val: Math.pow(base.val, exp.val),
                    endTok: exp.endTok
                };
            }
            return base;
        }

        function parsePostfixWithEnd() {
            let res = parsePrimaryWithEnd();
            while (peek() && peek().type === "OP" && peek().value === "%") {
                const pctTok = consume();
                res = { val: res.val / 100, endTok: pctTok };
            }
            return res;
        }

        function parsePrimaryWithEnd() {
            const t = peek();
            if (!t) {
                throw new Error("Ekspresi perhitungan belum selesai atau belum lengkap.");
            }
            if (t.type === "NUM") {
                consume();
                return { val: t.value, endTok: t };
            }
            if (t.type === "LPAREN") {
                consume();
                const val = parseExpression();
                const closing = peek();
                if (!closing || closing.type !== "RPAREN") {
                    throw new Error("Struktur tanda kurung belum seimbang atau tidak valid.");
                }
                consume();
                return { val, endTok: closing };
            }
            throw new Error("Format ekspresi matematika belum lengkap atau tidak valid.");
        }

        if (tokens.length === 0) {
            throw new Error("Ekspresi perhitungan belum selesai atau belum lengkap.");
        }
        const value = parseExpression();
        if (pos < tokens.length) {
            throw new Error("Format ekspresi matematika belum lengkap atau tidak valid.");
        }
        return value;
    }

    // Parser ekspresi matematika fleksibel (mendukung x, perkalian kurung, persen, pangkat, angka nol di depan)
    function parseAndEvalCalculator(rawInput) {
        if (!rawInput || !rawInput.trim()) return null;

        const { Frac, floatToFrac } = App.Core;
        let s = rawInput.trim();

        // 1. Normalisasi simbol visual & koma desimal ke operator aritmatika standar
        s = s.replace(/[×✕·xX]/g, "*");
        s = s.replace(/[÷:]/g, "/");
        s = s.replace(/[−–—]/g, "-");
        s = s.replace(/,/g, ".");
        s = s.replace(/\s+/g, " ");

        // Cek keseimbangan kurung & auto-tutup kurung saat masih mengetik
        let openParen = 0;
        for (const ch of s) {
            if (ch === "(") openParen++;
            if (ch === ")") openParen--;
            if (openParen < 0) throw new Error("Struktur tanda kurung belum seimbang atau tidak valid.");
        }
        if (openParen > 0) {
            s += ")".repeat(openParen);
        }

        const tokens = tokenizeMathExpression(s);
        let numResult = evaluateMathTokens(tokens);

        if (typeof numResult !== "number" || isNaN(numResult)) {
            throw new Error("Ekspresi perhitungan belum selesai atau belum lengkap.");
        }
        if (!isFinite(numResult)) {
            throw new Error("Pembagian dengan nol tidak terdefinisi dalam matematika.");
        }
        if (numResult === 0) numResult = 0;

        // Prioritaskan pecahan eksak langsung jika ekspresi berupa pembagian dua bilangan bulat (A/B)
        let fracResult = null;
        const simpleDivMatch = s.match(/^\(?\s*([+-]?\d+)\s*\)?\s*\/\s*\(?\s*([+-]?\d+)\s*\)?$/);
        if (simpleDivMatch) {
            const topN = parseInt(simpleDivMatch[1], 10);
            const botD = parseInt(simpleDivMatch[2], 10);
            if (botD !== 0) {
                fracResult = new Frac(topN, botD);
            }
        }
        if (!fracResult) {
            fracResult = floatToFrac(numResult);
        }

        let readableExpr = s
            .replace(/\*/g, " × ")
            .replace(/\//g, " ÷ ")
            .replace(/\+/g, " + ")
            .replace(/(^|[^0-9)])-(?=\d|\()/g, "$1−")
            .replace(/(\d|\))\s*-\s*(\d|\()/g, "$1 − $2");

        readableExpr = readableExpr
            .replace(/([×÷+])\s*−\s*(\d+(?:\.\d+)?)/g, "$1 (−$2)")
            .replace(/\s+/g, " ")
            .trim();

        return {
            rawInput,
            evalExpr: s,
            readableExpr,
            numResult,
            fracResult
        };
    }

    function insertTextAtCursor(input, text) {
        if (!input) return;
        input.focus();
        const start = input.selectionStart ?? input.value.length;
        const end = input.selectionEnd ?? input.value.length;
        const before = input.value.substring(0, start);
        const after = input.value.substring(end);
        input.value = before + text + after;
        input.selectionStart = input.selectionEnd = start + text.length;
    }

    function backspaceAtCursor(input) {
        if (!input) return;
        input.focus();
        const start = input.selectionStart ?? input.value.length;
        const end = input.selectionEnd ?? input.value.length;
        if (start === end && start > 0) {
            input.value = input.value.substring(0, start - 1) + input.value.substring(end);
            input.selectionStart = input.selectionEnd = start - 1;
        } else if (start !== end) {
            input.value = input.value.substring(0, start) + input.value.substring(end);
            input.selectionStart = input.selectionEnd = start;
        }
    }

    function init() {
        const { formatNumberWithCommas, escapeHtml } = App.Core;
        const calcInput = document.getElementById("quick-calc-input");
        const calcPrimaryVal = document.getElementById("quick-calc-primary-val");
        const calcFracWrap = document.getElementById("quick-calc-frac-wrap");
        const calcFracDisplay = document.getElementById("quick-calc-frac-display");
        const calcError = document.getElementById("quick-calc-error");
        const calcScreen = document.getElementById("calculator-screen");

        function evaluateQuickCalc(showError = false) {
            if (!calcInput) return;
            const raw = calcInput.value.trim();
            if (!raw) {
                if (calcPrimaryVal) calcPrimaryVal.textContent = "0";
                if (calcFracWrap) calcFracWrap.classList.add("hidden");
                if (calcError) calcError.classList.add("hidden");
                return;
            }

            try {
                const res = parseAndEvalCalculator(raw);
                if (!res) return;

                if (calcError) calcError.classList.add("hidden");

                const formattedNumStr = formatNumberWithCommas(res.numResult);
                if (calcPrimaryVal) calcPrimaryVal.textContent = formattedNumStr;

                if (res.fracResult && res.fracResult.d > 1) {
                    if (calcFracWrap) calcFracWrap.classList.remove("hidden");
                    if (calcFracDisplay) calcFracDisplay.innerHTML = res.fracResult.toMathDisplayHtml(false);
                } else {
                    if (calcFracWrap) calcFracWrap.classList.add("hidden");
                }
            } catch (err) {
                if (calcError) {
                    if (showError) {
                        const safeMsg = escapeHtml ? escapeHtml(err.message || "Ekspresi matematika belum lengkap.") : err.message;
                        calcError.innerHTML = `
            <div class="error-title">Perhitungan Belum Sesuai</div>
            <div class="error-desc">${safeMsg}</div>
          `;
                        calcError.classList.remove("hidden");
                    } else {
                        calcError.classList.add("hidden");
                    }
                }
            }
        }

        document.querySelectorAll(".calc-btn").forEach((btn) => {
            btn.addEventListener("click", () => {
                const insert = btn.dataset.insert;
                const action = btn.dataset.action;

                if (insert) {
                    insertTextAtCursor(calcInput, insert);
                    evaluateQuickCalc(false);
                } else if (action === "clear") {
                    calcInput.value = "";
                    evaluateQuickCalc(false);
                    calcInput.focus();
                } else if (action === "backspace") {
                    backspaceAtCursor(calcInput);
                    evaluateQuickCalc(false);
                }
            });
        });

        if (calcInput) {
            const ALLOWED_CALC_KEY = /^[0-9+\-*/xX^%×✕·÷:−–—().,\s]$/;

            calcInput.addEventListener("keydown", (e) => {
                if (e.ctrlKey || e.metaKey || e.altKey) return;

                if (
                    ["Backspace", "Delete", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End", "Tab", "Escape"].includes(
                        e.key
                    )
                ) {
                    if (e.key === "Escape") {
                        calcInput.value = "";
                        evaluateQuickCalc(false);
                    }
                    return;
                }

                if (e.key === "Enter" || e.key === "=") {
                    e.preventDefault();
                    evaluateQuickCalc(true);
                    return;
                }

                if (e.key.length === 1 && !ALLOWED_CALC_KEY.test(e.key)) {
                    e.preventDefault();
                }
            });

            calcInput.addEventListener("input", () => {
                const origVal = calcInput.value;
                const sanitized = origVal.replace(/[^0-9+\-*/xX^%×✕·÷:−–—().,\s]/g, "");
                if (origVal !== sanitized) {
                    const curPos = calcInput.selectionStart;
                    calcInput.value = sanitized;
                    if (curPos !== null) {
                        const removedBefore = origVal.slice(0, curPos).length - origVal.slice(0, curPos).replace(/[^0-9+\-*/xX^%×✕·÷:−–—().,\s]/g, "").length;
                        const newPos = Math.max(0, Math.min(curPos - removedBefore, sanitized.length));
                        calcInput.setSelectionRange(newPos, newPos);
                    }
                }
                evaluateQuickCalc(false);
            });
        }

        if (calcPrimaryVal) {
            const defaultCopyTitle = calcPrimaryVal.title || "Klik angka untuk menyalin";
            let copyTitleTimer = null;
            calcPrimaryVal.addEventListener("click", () => {
                const resVal = calcPrimaryVal.textContent.trim();
                if (resVal && navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard
                        .writeText(resVal)
                        .then(() => {
                            calcPrimaryVal.title = "Tersalin ke clipboard!";
                            if (copyTitleTimer) clearTimeout(copyTitleTimer);
                            copyTitleTimer = setTimeout(() => {
                                calcPrimaryVal.title = defaultCopyTitle;
                            }, 1800);
                        })
                        .catch(() => {});
                }
            });
        }

        if (calcScreen && calcInput) {
            calcScreen.addEventListener("click", (e) => {
                if (e.target !== calcPrimaryVal && !calcPrimaryVal.contains(e.target)) {
                    calcInput.focus();
                }
            });
        }

        evaluateQuickCalc(false);
    }

    App.QuickCalc = {
        parseAndEvalCalculator,
        init
    };
})(typeof window !== "undefined" ? window : globalThis);
