/**
 * MAIN.JS - Titik Masuk Aplikasi, Navigasi Tab, & Penghubung Modul
 */
(function (global) {
    "use strict";

    document.addEventListener("DOMContentLoaded", () => {
        const App = global.AljabarApp || {};

        // 1. Navigasi Menu Tab Utama
        const tabBtnCalc = document.getElementById("tab-btn-calc");
        const tabBtnGauss = document.getElementById("tab-btn-gauss");
        const sectionCalc = document.getElementById("section-calc");
        const sectionGauss = document.getElementById("section-gauss");

        const navTabs = [
            { btn: tabBtnCalc, sec: sectionCalc },
            { btn: tabBtnGauss, sec: sectionGauss }
        ];

        function setActiveTab(index) {
            navTabs.forEach((tab, i) => {
                if (!tab.btn || !tab.sec) return;
                const isActive = i === index;
                tab.btn.classList.toggle("active", isActive);
                tab.btn.setAttribute("aria-selected", isActive ? "true" : "false");
                tab.sec.classList.toggle("hidden", !isActive);
            });

            if (index === 1) {
                const splContainer = document.querySelector(".augmented-input-container");
                if (splContainer) {
                    splContainer.scrollLeft = 0;
                }
            }
        }

        navTabs.forEach((tab, index) => {
            if (tab.btn) {
                tab.btn.addEventListener("click", () => setActiveTab(index));
            }
        });

        // 2. Inisialisasi Modul Kalkulator Cepat
        if (App.QuickCalc && typeof App.QuickCalc.init === "function") {
            App.QuickCalc.init();
        }

        // 3. Inisialisasi Modul Soal Cerita Gemini AI & Solver SPL / OBE
        const aiApi = App.AiStoryModeler && typeof App.AiStoryModeler.init === "function" ? App.AiStoryModeler.init() : null;

        const splApi =
            App.SplSolver && typeof App.SplSolver.init === "function"
                ? App.SplSolver.init({
                      onManualModeSelected: () => {
                          if (aiApi) aiApi.hideStoryUi();
                      }
                  })
                : null;

        if (aiApi && splApi) {
            aiApi.bindSplApi(splApi);
        }
    });
})(typeof window !== "undefined" ? window : globalThis);
