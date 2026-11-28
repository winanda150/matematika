/**
 * SPL-SOLVER.JS - Algoritma Eliminasi Gauss, Gauss-Jordan, Grid Input & Renderer Langkah OBE
 */
(function (global) {
    "use strict";

    const App = (global.AljabarApp = global.AljabarApp || {});

    function renderAugmentedTableHtml(matFrac) {
        const m = matFrac.length;
        const n = matFrac[0].length - 1;

        let html = `
      <div class="augmented-table-wrapper">
        <div class="augmented-bracket-box">
          <table class="augmented-table">
            <tbody>
    `;

        for (let r = 0; r < m; r++) {
            html += "<tr>";
            for (let c = 0; c < n; c++) {
                html += `<td>${matFrac[r][c].toHtml()}</td>`;
            }
            html += `<td class="const-cell">${matFrac[r][n].toHtml()}</td>`;
            html += "</tr>";
        }

        html += `
            </tbody>
          </table>
        </div>
      </div>
    `;
        return html;
    }

    function cloneFracMatrix(mat) {
        const { Frac } = App.Core;
        return mat.map((row) => row.map((cell) => new Frac(cell.n, cell.d)));
    }

    // Format rumus OBE agar pecahan dirender vertikal bertumpuk
    function formatObeFormulaHtml(str) {
        if (!str) return "";
        return str.replace(
            /\(\s*([+-]?\d+)\s*\/\s*(\d+)\s*\)|(?<![bB]\d*)(?<=[+\-·*÷\s]|(?:\/\s*))([+-]?\d+)\/(\d+)(?![0-9/])/g,
            (match, n1, d1, n2, d2) => {
                const n = n1 !== undefined ? n1 : n2;
                const d = d1 !== undefined ? d1 : d2;
                return `<span class="formula-frac"><span class="formula-frac-num">${n}</span><span class="formula-frac-bar" aria-hidden="true"></span><span class="formula-frac-den">${d}</span></span>`;
            }
        );
    }

    function solveSPL(matrixData, method = "gauss") {
        const { Frac, renderDivisionStackedHtml, toFracSafe } = App.Core;
        const m = matrixData.length;
        const n = matrixData[0].length - 1;
        const mat = matrixData.map((row) => row.map((v) => toFracSafe(v)));
        const steps = [];

        steps.push({
            type: "initial",
            title: "Matriks Augmented Awal [ A | k ]",
            operations: [],
            formula: "Sistem Persamaan Linier Awal",
            desc: `Matriks disusun dari koefisien variabel x₁ sampai x_${n} dan kolom konstanta k:`,
            mat: cloneFracMatrix(mat)
        });

        let row = 0;
        for (let col = 0; col < n && row < m; col++) {
            let pivotRow = row;
            while (pivotRow < m && mat[pivotRow][col].isZero()) {
                pivotRow++;
            }

            if (pivotRow === m) continue;

            if (pivotRow !== row) {
                const temp = mat[row];
                mat[row] = mat[pivotRow];
                mat[pivotRow] = temp;
                steps.push({
                    type: "pivot_swap",
                    title: `Pertukaran Baris (Pivot Kolom ${col + 1})`,
                    operations: [
                        {
                            formula: `B${row + 1} ↔ B${pivotRow + 1}`,
                            desc: `Tukar posisi Baris ${row + 1} dengan Baris ${pivotRow + 1} agar elemen pivot ≠ 0`
                        }
                    ],
                    formula: `B${row + 1} ↔ B${pivotRow + 1}`,
                    desc: `Karena elemen pivot pada baris ${row + 1} adalah 0, tukar baris ${row + 1} dengan baris ${pivotRow + 1}:`,
                    mat: cloneFracMatrix(mat)
                });
            }

            const pivotVal = mat[row][col];
            if (!pivotVal.isOne()) {
                for (let c = col; c <= n; c++) {
                    mat[row][c] = mat[row][c].div(pivotVal);
                }
                const opStr = pivotVal.isNegative() ? `B${row + 1} / (${pivotVal.toString()})` : `B${row + 1} / ${pivotVal.toString()}`;
                steps.push({
                    type: "pivot_norm",
                    title: `Normalisasi Pivot Utama Baris ${row + 1}`,
                    operations: [
                        { formula: opStr, desc: `Bagi seluruh elemen Baris ${row + 1} dengan ${pivotVal.toString()} agar pivot menjadi 1` }
                    ],
                    formula: opStr,
                    desc: `Jadikan elemen utama (pivot) pada baris ${row + 1} kolom ${col + 1} menjadi 1 utama:`,
                    mat: cloneFracMatrix(mat)
                });
            }

            const colOps = [];
            if (method === "gauss") {
                for (let r = row + 1; r < m; r++) {
                    const factor = mat[r][col];
                    if (!factor.isZero()) {
                        for (let c = col; c <= n; c++) {
                            mat[r][c] = mat[r][c].sub(factor.mul(mat[row][c]));
                        }
                        let opStr = "";
                        if (factor.isOne()) {
                            opStr = `- B${row + 1}`;
                        } else if (factor.mul(new Frac(-1)).isOne()) {
                            opStr = `+ B${row + 1}`;
                        } else if (factor.isNegative()) {
                            opStr = `+ ${factor.mul(new Frac(-1)).toString()}·B${row + 1}`;
                        } else {
                            opStr = `- ${factor.toString()}·B${row + 1}`;
                        }
                        colOps.push({
                            formula: `B${r + 1} ${opStr}`,
                            desc: `Kurangkan Baris ${r + 1} dengan (${factor.toString()}) kali Baris ${row + 1}`
                        });
                    }
                }
            } else {
                for (let r = 0; r < m; r++) {
                    if (r !== row) {
                        const factor = mat[r][col];
                        if (!factor.isZero()) {
                            for (let c = col; c <= n; c++) {
                                mat[r][c] = mat[r][c].sub(factor.mul(mat[row][c]));
                            }
                            let opStr = "";
                            if (factor.isOne()) {
                                opStr = `- B${row + 1}`;
                            } else if (factor.mul(new Frac(-1)).isOne()) {
                                opStr = `+ B${row + 1}`;
                            } else if (factor.isNegative()) {
                                opStr = `+ ${factor.mul(new Frac(-1)).toString()}·B${row + 1}`;
                            } else {
                                opStr = `- ${factor.toString()}·B${row + 1}`;
                            }
                            colOps.push({
                                formula: `B${r + 1} ${opStr}`,
                                desc: `Eliminasi elemen Baris ${r + 1} menggunakan (${factor.toString()}) × Baris ${row + 1}`
                            });
                        }
                    }
                }
            }

            if (colOps.length > 0) {
                steps.push({
                    type: "eliminate_col",
                    title: `Eliminasi Kolom ${col + 1}`,
                    operations: colOps,
                    formula: colOps.map((op) => op.formula).join(" & "),
                    desc:
                        method === "gauss"
                            ? `Lakukan operasi baris elementer untuk menghasilkan nol di bawah pivot kolom ${col + 1}:`
                            : `Lakukan operasi baris elementer untuk menghasilkan nol pada kolom ${col + 1} di luar pivot:`,
                    mat: cloneFracMatrix(mat)
                });
            }

            row++;
        }

        let isInconsistent = false;

        for (let r = 0; r < m; r++) {
            let allZerosA = true;
            for (let c = 0; c < n; c++) {
                if (!mat[r][c].isZero()) {
                    allZerosA = false;
                    break;
                }
            }
            if (allZerosA && !mat[r][n].isZero()) isInconsistent = true;
        }

        if (isInconsistent) {
            return {
                status: "inconsistent",
                message:
                    "Ditemukan kontradiksi baris di mana seluruh koefisien bernilai 0 namun nilai konstanta bukan nol (0 = k). Sistem persamaan ini tidak memiliki solusi konsisten.",
                steps
            };
        }

        const solutions = new Array(n).fill(null);
        const backSubSteps = [];
        let backSubCounter = 1;

        const pivotCols = new Set();
        for (let r = 0; r < m; r++) {
            for (let c = 0; c < n; c++) {
                if (!mat[r][c].isZero()) {
                    pivotCols.add(c);
                    break;
                }
            }
        }

        const hasFreeVars = pivotCols.size < n;

        for (let c = n - 1; c >= 0; c--) {
            if (!pivotCols.has(c)) {
                solutions[c] = new Frac(0);
                backSubSteps.push({
                    stepNum: backSubCounter++,
                    rowName: "Variabel Bebas",
                    varIdx: c + 1,
                    initialEqHtml: `Kolom x<sub>${c + 1}</sub> tidak memiliki satu utama (variabel bebas)`,
                    substEqHtml: null,
                    isolateLineHtml: `Dimisalkan nilai parameter bebas: x<sub>${c + 1}</sub> = 0 (atau parameter <em>t</em>)`,
                    resultVal: solutions[c]
                });
            }
        }

        for (let r = m - 1; r >= 0; r--) {
            let leadCol = -1;
            for (let c = 0; c < n; c++) {
                if (!mat[r][c].isZero()) {
                    leadCol = c;
                    break;
                }
            }
            if (leadCol === -1) continue;

            const leadCoef = mat[r][leadCol];
            const constVal = mat[r][n];
            const varIdx = leadCol + 1;

            const leadStr = leadCoef.isOne()
                ? `x<sub>${varIdx}</sub>`
                : leadCoef.toString() === "-1"
                  ? `−x<sub>${varIdx}</sub>`
                  : `${leadCoef.toMathDisplayHtml(false)}x<sub>${varIdx}</sub>`;
            const initTerms = [leadStr];
            const substTerms = [leadStr];
            let otherTermsCount = 0;
            let sumKnown = new Frac(0);

            for (let c = leadCol + 1; c < n; c++) {
                const coef = mat[r][c];
                if (!coef.isZero()) {
                    otherTermsCount++;
                    const isNeg = coef.isNegative();
                    const absCoef = isNeg ? coef.mul(new Frac(-1)) : coef;
                    const sign = isNeg ? "−" : "+";
                    const otherVarStr = `x<sub>${c + 1}</sub>`;
                    const coefPrefix = absCoef.isOne() ? "" : `${absCoef.toMathDisplayHtml(false)}`;

                    initTerms.push(`${sign} ${coefPrefix}${otherVarStr}`);

                    const solVal = solutions[c] || new Frac(0);
                    const solValStr = `(${solVal.toMathDisplayHtml(false)})`;
                    const substCoefStr = absCoef.isOne()
                        ? ""
                        : absCoef.d !== 1
                          ? `(${absCoef.toMathDisplayHtml(false)})`
                          : `${absCoef.toMathDisplayHtml(false)}`;
                    substTerms.push(`${sign} ${substCoefStr}${solValStr}`);

                    sumKnown = sumKnown.add(coef.mul(solVal));
                }
            }

            const initialEqHtml = `${initTerms.join(" ")} = ${constVal.toMathDisplayHtml(false)}`;
            let substEqHtml = null;
            let simpLineHtml = null;
            let isolateLineHtml = null;
            let solveLineHtml = null;

            if (otherTermsCount > 0) {
                substEqHtml = `${substTerms.join(" ")} = ${constVal.toMathDisplayHtml(false)}`;

                const sumSign = sumKnown.isNegative() ? "−" : "+";
                const absSum = sumKnown.isNegative() ? sumKnown.mul(new Frac(-1)) : sumKnown;
                simpLineHtml = `${leadStr} ${sumSign} ${absSum.toMathDisplayHtml(false)} = ${constVal.toMathDisplayHtml(false)}`;

                const moveSign = sumKnown.isNegative() ? "+" : "−";
                const remVal = constVal.sub(sumKnown);
                isolateLineHtml = `${leadStr} = ${constVal.toMathDisplayHtml(false)} ${moveSign} ${absSum.toMathDisplayHtml(false)} = ${remVal.toMathDisplayHtml(false)}`;

                if (!leadCoef.isOne()) {
                    const topVal = remVal.d === 1 ? `${remVal.n}` : remVal.toMathDisplayHtml(false);
                    const bottomVal = leadCoef.d === 1 ? `${leadCoef.n}` : leadCoef.toMathDisplayHtml(false);
                    const divFracHtml = renderDivisionStackedHtml(topVal, bottomVal);
                    const finalValHtml = remVal.div(leadCoef).toMathDisplayHtml(false);
                    solveLineHtml = `x<sub>${varIdx}</sub> = ${divFracHtml} = <strong>${finalValHtml}</strong>`;
                }

                solutions[leadCol] = remVal.div(leadCoef);
            } else {
                if (!leadCoef.isOne()) {
                    const topVal = constVal.d === 1 ? `${constVal.n}` : constVal.toMathDisplayHtml(false);
                    const bottomVal = leadCoef.d === 1 ? `${leadCoef.n}` : leadCoef.toMathDisplayHtml(false);
                    const divFracHtml = renderDivisionStackedHtml(topVal, bottomVal);
                    const finalValHtml = constVal.div(leadCoef).toMathDisplayHtml(false);
                    solveLineHtml = `x<sub>${varIdx}</sub> = ${divFracHtml} = <strong>${finalValHtml}</strong>`;
                }
                solutions[leadCol] = constVal.div(leadCoef);
            }

            backSubSteps.push({
                stepNum: backSubCounter++,
                rowName: `Baris ${r + 1}`,
                varIdx,
                initialEqHtml,
                substEqHtml,
                simpLineHtml,
                isolateLineHtml,
                solveLineHtml,
                resultVal: solutions[leadCol]
            });
        }

        return {
            status: hasFreeVars ? "infinite" : "unique",
            solutions: solutions.map((s) => (s !== null ? s : new Frac(0))),
            steps,
            backSubSteps,
            finalMat: cloneFracMatrix(mat),
            method
        };
    }

    function init(options = {}) {
        const splForm = document.getElementById("spl-form");
        const splGridContainer = document.getElementById("spl-grid-inputs");
        const splResultArea = document.getElementById("spl-result-area");
        const splErrorBox = document.getElementById("spl-error-box");
        const splManualTips = document.getElementById("spl-manual-tips");
        const splManualInputSection = document.getElementById("spl-manual-input-section");
        const splMethodPills = document.querySelectorAll(".spl-method-pill");
        const splSizePills = document.querySelectorAll(".spl-size-pill");
        const storyAppBtn = document.getElementById("btn-story-app");

        let currentSplDim = 3;
        let currentSplMethod = "gauss";

        function createMatrixCellInput(id, name, ariaLabel, row, col, initialVal, isConstant = false) {
            const lbl = document.createElement("label");
            lbl.htmlFor = id;
            lbl.className = "sr-only";
            lbl.textContent = ariaLabel;

            const inp = document.createElement("input");
            inp.type = "text";
            inp.inputMode = "decimal";
            inp.id = id;
            inp.name = name;
            inp.setAttribute("aria-label", ariaLabel);
            inp.className = "augmented-cell-input";
            if (isConstant) {
                inp.style.borderColor = "#2563eb";
                inp.style.backgroundColor = "#eff6ff";
            }
            inp.dataset.row = row;
            inp.dataset.col = col;
            inp.value = initialVal;
            inp.autocomplete = "off";
            inp.spellcheck = false;

            inp.addEventListener("wheel", () => inp.blur());
            inp.addEventListener("focus", () => inp.select());
            inp.addEventListener("blur", () => {
                const val = inp.value.trim();
                if (val === "" || val === "-" || val === "." || val === "/") {
                    inp.value = "0";
                }
            });
            inp.addEventListener("input", () => {
                inp.value = inp.value.replace(/[^0-9.\-/]/g, "");
            });

            return { lbl, inp };
        }

        function renderSplInputs(dim, initialData = null) {
            currentSplDim = dim;
            if (!splGridContainer) return;
            splGridContainer.innerHTML = "";

            const headerRow = document.createElement("div");
            headerRow.className = "augmented-header-row";
            for (let c = 0; c < dim; c++) {
                const lbl = document.createElement("span");
                lbl.className = "augmented-header-cell";
                lbl.textContent = `x${c + 1}`;
                headerRow.appendChild(lbl);
            }
            const divHeader = document.createElement("div");
            divHeader.className = "augmented-divider-header";
            headerRow.appendChild(divHeader);

            const constHeader = document.createElement("span");
            constHeader.className = "augmented-header-cell";
            constHeader.textContent = "k";
            headerRow.appendChild(constHeader);
            splGridContainer.appendChild(headerRow);

            for (let r = 0; r < dim; r++) {
                const rowDiv = document.createElement("div");
                rowDiv.className = "augmented-input-row";

                for (let c = 0; c < dim; c++) {
                    const val = initialData ? initialData[r][c] : 0;
                    const cell = createMatrixCellInput(
                        `spl-matrix-cell-${r}-${c}`,
                        `matrix_cell_${r}_${c}`,
                        `Koefisien Baris ${r + 1} Kolom x${c + 1}`,
                        r,
                        c,
                        val,
                        false
                    );
                    rowDiv.appendChild(cell.lbl);
                    rowDiv.appendChild(cell.inp);
                }

                const divBar = document.createElement("div");
                divBar.className = "augmented-divider-bar";
                rowDiv.appendChild(divBar);

                const valB = initialData ? initialData[r][dim] : 0;
                const constCell = createMatrixCellInput(
                    `spl-matrix-const-${r}`,
                    `matrix_const_${r}`,
                    `Nilai Konstanta k Baris ${r + 1}`,
                    r,
                    dim,
                    valB,
                    true
                );
                rowDiv.appendChild(constCell.lbl);
                rowDiv.appendChild(constCell.inp);

                splGridContainer.appendChild(rowDiv);
            }

            if (splGridContainer.parentElement) {
                splGridContainer.parentElement.scrollLeft = 0;
            }
        }

        function showSplError(msg) {
            if (!splErrorBox) return;
            splErrorBox.innerHTML = msg;
            splErrorBox.classList.remove("hidden");
        }

        function hideSplMessages() {
            if (splErrorBox) splErrorBox.classList.add("hidden");
            if (splResultArea) splResultArea.classList.add("hidden");
        }

        function executeSplResolution(matrixData, method) {
            const res = solveSPL(matrixData, method);

            if (res.status === "inconsistent") {
                showSplError(`
          <div class="error-title">Sistem Persamaan Tidak Memiliki Solusi (Inkonsisten)</div>
          <div class="error-desc">${res.message}</div>
        `);
                return;
            }

            const solutionValuesDiv = document.getElementById("spl-solution-values");
            solutionValuesDiv.innerHTML = "";
            const numVars = res.solutions.length;

            for (let i = 0; i < numVars; i++) {
                const solFrac = res.solutions[i];
                const varBox = document.createElement("div");
                varBox.className = "spl-var-item";
                varBox.innerHTML = `<span>x<sub>${i + 1}</sub> =</span> <strong>${solFrac.toMathDisplayHtml ? solFrac.toMathDisplayHtml(false) : solFrac.toHtml()}</strong>`;
                solutionValuesDiv.appendChild(varBox);
            }

            if (res.status === "infinite") {
                const noticeBox = document.createElement("div");
                noticeBox.className = "spl-infinite-notice";
                noticeBox.style.cssText = "grid-column: 1 / -1; margin-top: 0.5rem; font-size: 0.85rem; color: #b45309; background: #fffbeb; border: 1px solid #fde68a; border-radius: 6px; padding: 0.5rem 0.75rem;";
                noticeBox.innerHTML = "<strong>Catatan:</strong> Sistem memiliki tak hingga banyak solusi (terdapat variabel bebas). Nilai di atas adalah salah satu solusi partikular dengan parameter bebas = 0.";
                solutionValuesDiv.appendChild(noticeBox);
            }

            const stepsListContainer = document.getElementById("obe-steps-list");
            stepsListContainer.innerHTML = "";

            res.steps.forEach((step, idx) => {
                const card = document.createElement("div");
                const isInitial = step.type === "initial";
                card.className = isInitial ? "obe-step-card obe-initial-step" : "obe-step-card";

                let transformVisualHtml = "";

                if (step.type === "initial") {
                    transformVisualHtml = `
            <div class="obe-step-header">
              <div class="obe-header-left">
                <span class="step-num-badge">Langkah ${idx + 1}</span>
                <h4 class="obe-step-title">${step.title}</h4>
              </div>
              <span class="obe-type-badge">Matriks Awal</span>
            </div>
            <p class="obe-step-desc">${formatObeFormulaHtml(step.desc)}</p>
          `;
                } else if (step.operations && step.operations.length > 0) {
                    const isSwap = step.type === "pivot_swap";
                    const isNorm = step.type === "pivot_norm";
                    let innerContentHtml = "";

                    if (step.operations.length === 1) {
                        const op = step.operations[0];
                        innerContentHtml = `
              <div class="obe-op-row">
                <span class="obe-op-formula ${isSwap ? "formula-swap" : isNorm ? "formula-norm" : ""}">${formatObeFormulaHtml(op.formula)}</span>
                <span class="obe-op-explanation">${formatObeFormulaHtml(op.desc)}</span>
              </div>
            `;
                    } else {
                        innerContentHtml = step.operations
                            .map((op, opIdx) => {
                                const rowHtml = `
                <div class="obe-op-row">
                  <span class="obe-op-formula">${formatObeFormulaHtml(op.formula)}</span>
                  <span class="obe-op-explanation">${formatObeFormulaHtml(op.desc)}</span>
                </div>
              `;
                                const arrowHtml =
                                    opIdx < step.operations.length - 1
                                        ? `
                <div class="obe-long-arrow-connector" aria-hidden="true">
                  <div class="arrow-shaft"></div>
                  <div class="arrow-head"></div>
                </div>
              `
                                        : "";
                                return rowHtml + arrowHtml;
                            })
                            .join("");
                    }

                    transformVisualHtml = `
            <div class="obe-step-header">
              <div class="obe-header-left">
                <span class="step-num-badge">Langkah ${idx + 1}</span>
                <h4 class="obe-step-title">${step.title}</h4>
              </div>
              <div class="obe-multi-badges">
                ${step.operations.map((op) => `<span class="obe-formula-pill-sm">${formatObeFormulaHtml(op.formula)}</span>`).join("")}
              </div>
            </div>
            <p class="obe-step-desc">${formatObeFormulaHtml(step.desc)}</p>
            <div class="obe-transform-box ${isSwap ? "single-action-swap" : isNorm ? "single-action-norm" : ""}">
              ${innerContentHtml}
            </div>
          `;
                }

                const matrixCaption = isInitial ? "Matriks Augmented [ A | k ]:" : "Matriks Hasil Operasi Baris:";

                card.innerHTML = `
          ${transformVisualHtml}
          <div class="obe-matrix-wrapper-card">
            <div class="obe-matrix-caption">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
              <span>${matrixCaption}</span>
            </div>
            ${renderAugmentedTableHtml(step.mat)}
          </div>
        `;
                stepsListContainer.appendChild(card);
            });

            const backSubCard = document.getElementById("back-sub-section");
            const backSubList = document.getElementById("back-sub-steps-list");
            backSubList.innerHTML = "";

            if (method === "gauss") {
                backSubCard.classList.remove("hidden");
                document.getElementById("back-sub-title").innerHTML = "<strong>Tahap Substitusi Balik (Back-Substitution):</strong>";
                res.backSubSteps.forEach((s) => {
                    const item = document.createElement("div");
                    item.className = "back-sub-step-card";
                    item.innerHTML = `
            <div class="back-sub-step-header">
              <div class="back-sub-phase-group">
                <span class="back-sub-num-pill">Tahap ${s.stepNum}</span>
                <span class="back-sub-source-pill">${s.rowName}</span>
              </div>
              <span class="back-sub-var-pill">Mencari Nilai <strong>x<sub>${s.varIdx}</sub></strong></span>
            </div>
            <div class="back-sub-calc-flow">
              <div class="back-sub-line">
                <span class="back-sub-step-label">1. Persamaan Baris:</span>
                <span class="back-sub-math-expr">${s.initialEqHtml}</span>
              </div>
              ${
                  s.substEqHtml
                      ? `
                <div class="back-sub-line">
                  <span class="back-sub-step-label">2. Masukkan Nilai:</span>
                  <span class="back-sub-math-expr">${s.substEqHtml}</span>
                </div>
              `
                      : ""
              }
              ${
                  s.simpLineHtml
                      ? `
                <div class="back-sub-line">
                  <span class="back-sub-step-label">3. Sederhanakan Ruas:</span>
                  <span class="back-sub-math-expr">${s.simpLineHtml}</span>
                </div>
              `
                      : ""
              }
              ${
                  s.isolateLineHtml
                      ? `
                <div class="back-sub-line">
                  <span class="back-sub-step-label">4. Pindah Ruas:</span>
                  <span class="back-sub-math-expr">${s.isolateLineHtml}</span>
                </div>
              `
                      : ""
              }
              ${
                  s.solveLineHtml
                      ? `
                <div class="back-sub-line">
                  <span class="back-sub-step-label">${s.isolateLineHtml ? "5. Bagi Koefisien:" : "2. Hitung Variabel:"}</span>
                  <span class="back-sub-math-expr highlight-math">${s.solveLineHtml}</span>
                </div>
              `
                      : ""
              }
              <div class="back-sub-line result-line">
                <span class="back-sub-step-label">Nilai Diperoleh:</span>
                <span class="back-sub-solution-badge">
                  x<sub>${s.varIdx}</sub> = <strong>${s.resultVal.toMathDisplayHtml ? s.resultVal.toMathDisplayHtml(false) : s.resultVal.toString()}</strong>
                </span>
              </div>
            </div>
          `;
                    backSubList.appendChild(item);
                });
            } else {
                backSubCard.classList.add("hidden");
            }

            splResultArea.classList.remove("hidden");
            splResultArea.scrollIntoView({ behavior: "smooth", block: "nearest" });
        }

        splMethodPills.forEach((pill) => {
            pill.addEventListener("click", () => {
                splMethodPills.forEach((p) => p.classList.remove("active"));
                if (storyAppBtn) storyAppBtn.classList.remove("active");
                if (typeof options.onManualModeSelected === "function") {
                    options.onManualModeSelected();
                }
                if (splManualTips) splManualTips.classList.remove("hidden");
                if (splManualInputSection) splManualInputSection.classList.remove("hidden");
                pill.classList.add("active");
                currentSplMethod = pill.dataset.method;
                hideSplMessages();
            });
        });

        splSizePills.forEach((pill) => {
            pill.addEventListener("click", () => {
                splSizePills.forEach((p) => p.classList.remove("active"));
                pill.classList.add("active");
                const dim = parseInt(pill.dataset.dim, 10);
                renderSplInputs(dim);
                hideSplMessages();
            });
        });

        if (splForm) {
            splForm.addEventListener("submit", (e) => {
                e.preventDefault();
                hideSplMessages();

                const dim = currentSplDim;
                const matrixData = [];
                const rows = splGridContainer.querySelectorAll(".augmented-input-row");

                for (let r = 0; r < dim; r++) {
                    const rowInputs = rows[r].querySelectorAll(".augmented-cell-input");
                    const rowVals = [];
                    for (let c = 0; c <= dim; c++) {
                        const rawCell = rowInputs[c].value.trim();
                        let val;
                        if (rawCell.includes("/")) {
                            const parts = rawCell.split("/");
                            const top = parseFloat(parts[0]);
                            const bot = parseFloat(parts[1]);
                            val = parts.length === 2 && !isNaN(top) && !isNaN(bot) && bot !== 0 ? top / bot : NaN;
                        } else {
                            val = parseFloat(rawCell);
                        }

                        if (isNaN(val)) {
                            showSplError(`Nilai pada Baris ${r + 1} Kolom ${c < dim ? "x" + (c + 1) : "k"} tidak valid.`);
                            return;
                        }
                        rowVals.push(val);
                    }
                    matrixData.push(rowVals);
                }

                const isAllZero = matrixData.every((row) => row.every((val) => val === 0));
                if (isAllZero) {
                    showSplError(`
            <div class="error-title">Matriks Belum Diisi</div>
            <div class="error-desc">Seluruh elemen matriks masih bernilai nol. Masukkan nilai koefisien variabel dan konstanta (k) terlebih dahulu sebelum menyelesaikan eliminasi.</div>
          `);
                    return;
                }

                const isAllCoeffZero = matrixData.every((row) => row.slice(0, dim).every((val) => val === 0));
                if (isAllCoeffZero) {
                    showSplError(`
            <div class="error-title">Koefisien Variabel Tidak Valid</div>
            <div class="error-desc">Seluruh koefisien variabel bernilai nol sehingga tidak ada variabel yang dapat diselesaikan atau dieliminasi.</div>
          `);
                    return;
                }

                const methodToUse = currentSplMethod === "story" || !currentSplMethod ? "gauss_jordan" : currentSplMethod;
                executeSplResolution(matrixData, methodToUse);
            });
        }

        renderSplInputs(3);

        return {
            setCurrentMethod: (method) => {
                currentSplMethod = method;
            },
            setActiveSizePill: (dim) => {
                splSizePills.forEach((p) => {
                    p.classList.toggle("active", parseInt(p.dataset.dim, 10) === dim);
                });
            },
            clearMethodPills: () => {
                splMethodPills.forEach((p) => p.classList.remove("active"));
            },
            hideManualSections: () => {
                if (splManualTips) splManualTips.classList.add("hidden");
                if (splManualInputSection) splManualInputSection.classList.add("hidden");
            },
            hideMessages: hideSplMessages,
            renderSplInputs,
            executeSplResolution,
            showSplError
        };
    }

    App.SplSolver = {
        renderAugmentedTableHtml,
        cloneFracMatrix,
        formatObeFormulaHtml,
        solveSPL,
        init
    };
})(typeof window !== "undefined" ? window : globalThis);
