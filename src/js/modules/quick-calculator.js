/**
 * QUICK-CALCULATOR.JS - Evaluator Ekspresi & Handler Keypad Kalkulator Cepat
 */
(function (global) {
    "use strict";

    const App = (global.AljabarApp = global.AljabarApp || {});

    // Parser ekspresi matematika fleksibel (mendukung x, perkalian kurung, persen, pangkat)
    function parseAndEvalCalculator(rawInput) {
        if (!rawInput || !rawInput.trim()) return null;

        const { Frac, floatToFrac } = App.Core;
        let s = rawInput.trim();

        // 1. Normalisasi simbol visual ke operator aritmatika standar
        s = s.replace(/[×✕·]/g, "*");
        s = s.replace(/[÷:]/g, "/");
        s = s.replace(/[−–—]/g, "-");
        s = s.replace(/,/g, ".");

        // Tangani persentase misal 50% -> (50/100) atau (10+5)% -> (10+5)/100
        s = s.replace(/\)\s*%/g, ")/100");
        s = s.replace(/(\d+(?:\.\d+)?)\s*%/g, "($1/100)");

        // 2. Tangani 'x' atau 'X' sebagai perkalian
        s = s.replace(/(\d|\))\s*[xX]\s*([\d(+\-.])/g, "$1 * $2");
        s = s.replace(/([xX])/g, "*");

        // 3. Tangani perkalian implisit kurung
        s = s.replace(/(\d)\s*\(/g, "$1 * (");
        s = s.replace(/\)\s*(\d)/g, ") * $1");
        s = s.replace(/\)\s*\(/g, ") * (");

        // 4. Pangkat (^ -> **) & penanganan unary minus sebelum pangkat (contoh -2^3 -> (-2)**3)
        s = s.replace(/\^/g, "**");
        s = s.replace(/(^|[+\-*/(])\s*-\s*(\d+(?:\.\d+)?)\s*\*\*/g, (m, p1, p2) => p1 + "(-" + p2 + ")**");

        // Tangani minus ganda atau plus ganda
        s = s.replace(/--/g, "- -");
        s = s.replace(/\+\+/g, "+ +");

        // Bersihkan spasi ganda
        s = s.replace(/\s+/g, " ");

        // Periksa karakter yang diizinkan
        if (!/^[0-9+\-*/().\s*]+$/.test(s)) {
            throw new Error("Terdapat simbol atau karakter yang tidak didukung.");
        }

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

        // Evaluasi ekspresi di sandbox terisolasi
        let numResult;
        try {
            const fn = new Function(`'use strict'; return (${s});`);
            numResult = fn();
        } catch (_) {
            throw new Error("Format ekspresi matematika belum lengkap atau tidak valid.");
        }

        if (typeof numResult !== "number" || isNaN(numResult)) {
            throw new Error("Ekspresi perhitungan belum selesai atau belum lengkap.");
        }
        if (!isFinite(numResult)) {
            throw new Error("Pembagian dengan nol tidak terdefinisi dalam matematika.");
        }

        // Prioritaskan pecahan eksak langsung jika ekspresi berupa pembagian dua bilangan bulat (A/B)
        let fracResult = null;
        const simpleDivMatch = s.match(/^\(?([+-]?\d+)\)?\s*\/\s*\(?([+-]?\d+)\)?$/);
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
            .replace(/\*\*/g, "^")
            .replace(/\*/g, " × ")
            .replace(/\//g, " ÷ ")
            .replace(/\+/g, " + ")
            .replace(/(^|[^0-9])-(?=\d)/g, "$1−")
            .replace(/(\d)\s*-\s*(\d)/g, "$1 − $2");

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
        const start = input.selectionStart;
        const end = input.selectionEnd;
        if (start === end && start > 0) {
            input.value = input.value.substring(0, start - 1) + input.value.substring(end);
            input.selectionStart = input.selectionEnd = start - 1;
        } else if (start !== end) {
            input.value = input.value.substring(0, start) + input.value.substring(end);
            input.selectionStart = input.selectionEnd = start;
        }
    }

    function init() {
        const { formatNumberWithCommas } = App.Core;
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
                if (showError && calcError) {
                    calcError.innerHTML = `
            <div class="error-title">Perhitungan Belum Sesuai</div>
            <div class="error-desc">${err.message || "Ekspresi matematika belum lengkap."}</div>
          `;
                    calcError.classList.remove("hidden");
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
            const ALLOWED_CALC_KEY = /^[0-9+\-*/xX^%×÷−().,\s]$/;

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

                if (e.key === "Enter") {
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
                const sanitized = origVal.replace(/[^0-9+\-*/xX^%×÷−().,\s]/g, "");
                if (origVal !== sanitized) {
                    const curPos = calcInput.selectionStart;
                    calcInput.value = sanitized;
                    if (curPos !== null) {
                        const newPos = Math.min(curPos, sanitized.length);
                        calcInput.setSelectionRange(newPos, newPos);
                    }
                }
                evaluateQuickCalc(false);
            });
        }

        if (calcPrimaryVal) {
            calcPrimaryVal.addEventListener("click", () => {
                const resVal = calcPrimaryVal.textContent.trim();
                if (resVal && navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(resVal).then(() => {
                        const originalTitle = calcPrimaryVal.title;
                        calcPrimaryVal.title = "Tersalin ke clipboard!";
                        setTimeout(() => {
                            calcPrimaryVal.title = originalTitle;
                        }, 1800);
                    });
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
