/**
 * FRACTION.JS - Modul Inti Aritmatika Pecahan Eksak & Pemformatan Angka
 */
(function (global) {
    "use strict";

    const App = (global.AljabarApp = global.AljabarApp || {});

    function getGCD(a, b) {
        a = Math.abs(a);
        b = Math.abs(b);
        while (b > 0) {
            const temp = b;
            b = a % b;
            a = temp;
        }
        return a || 1;
    }

    class Frac {
        constructor(n, d = 1) {
            if (d === 0) throw new Error("Penyebut tidak boleh 0");
            if (d < 0) {
                n = -n;
                d = -d;
            }
            const g = getGCD(n, d);
            this.n = Math.round(n / g);
            this.d = Math.round(d / g);
            if (this.n === 0) this.n = 0;
        }

        add(o) {
            return new Frac(this.n * o.d + o.n * this.d, this.d * o.d);
        }
        sub(o) {
            return new Frac(this.n * o.d - o.n * this.d, this.d * o.d);
        }
        mul(o) {
            return new Frac(this.n * o.n, this.d * o.d);
        }
        div(o) {
            if (o.isZero()) throw new Error("Pembagian dengan pecahan bernilai 0 tidak terdefinisi");
            return new Frac(this.n * o.d, this.d * o.n);
        }

        isZero() {
            return this.n === 0;
        }
        isOne() {
            return this.n === 1 && this.d === 1;
        }
        isNegative() {
            return this.n < 0;
        }

        toString() {
            if (this.d === 1) return `${this.n}`;
            return `${this.n}/${this.d}`;
        }

        toHtml() {
            if (this.d === 1) return `<span>${this.n}</span>`;
            const sign = this.n < 0 ? "−" : "";
            return `
        <span class="matrix-frac" style="display:inline-flex;align-items:center;vertical-align:middle;">
          ${sign ? `<span class="frac-sign" style="font-size:1.1rem;font-weight:bold;margin-right:2px;">${sign}</span>` : ""}
          <span class="frac-stack" style="display:inline-flex;flex-direction:column;align-items:center;line-height:1;">
            <span class="frac-num" style="font-size:0.9rem;font-weight:bold;border-bottom:1.5px solid currentColor;padding:0 2px;">${Math.abs(this.n)}</span>
            <span class="frac-den" style="font-size:0.9rem;font-weight:bold;padding:0 2px;">${this.d}</span>
          </span>
        </span>
      `;
        }

        // Format pecahan vertikal bertumpuk untuk notasi matematika
        toMathDisplayHtml() {
            if (this.d === 1) return `<span>${this.n}</span>`;
            const sign = this.n < 0 ? "−" : "";
            const absN = Math.abs(this.n);
            return `
        <span class="inline-stacked-frac">
          ${sign ? `<span class="inline-frac-sign">${sign}</span>` : ""}
          <span class="inline-frac-stack">
            <span class="inline-frac-num">${absN}</span>
            <span class="inline-frac-bar" aria-hidden="true"></span>
            <span class="inline-frac-den">${this.d}</span>
          </span>
        </span>
      `;
        }
    }

    // Render pecahan pembagian bertingkat: angka atas, garis tengah, angka bawah
    function renderDivisionStackedHtml(topNum, bottomNum) {
        return `
      <span class="inline-stacked-frac division-step">
        <span class="inline-frac-stack">
          <span class="inline-frac-num">${topNum}</span>
          <span class="inline-frac-bar" aria-hidden="true"></span>
          <span class="inline-frac-den">${bottomNum}</span>
        </span>
      </span>
    `;
    }

    // Konversi bilangan desimal / float menjadi pecahan eksak Frac
    function floatToFrac(x, maxDen = 1000000) {
        if (isNaN(x) || !isFinite(x)) return null;
        const sign = x < 0 ? -1 : 1;
        x = Math.abs(x);
        if (Math.abs(x - Math.round(x)) < 1e-10) {
            return new Frac(sign * Math.round(x), 1);
        }

        const str = x.toString();
        if (str.includes(".") && !str.includes("e")) {
            const decDigits = str.split(".")[1].length;
            if (decDigits <= 6) {
                const scale = Math.pow(10, decDigits);
                const n = Math.round(x * scale);
                return new Frac(sign * n, scale);
            }
        }

        // Algoritma pecahan berlanjut (Continued Fractions) untuk desimal berulang
        let h1 = 1,
            h0 = 0,
            k1 = 0,
            k0 = 1;
        let b = x;
        let iter = 0;
        while (iter++ < 25 && isFinite(b)) {
            const a = Math.floor(b);
            const h2 = a * h1 + h0;
            const k2 = a * k1 + k0;
            h0 = h1;
            h1 = h2;
            k0 = k1;
            k1 = k2;
            if (Math.abs(x - h1 / k1) < 1e-9 || k1 > maxDen) break;
            if (Math.abs(b - a) < 1e-12) break;
            b = 1 / (b - a);
        }

        return new Frac(sign * h1, k1);
    }

    // Konversi aman angka atau string pecahan (misal "1/2", 0.5, 3) ke objek Frac
    function toFracSafe(v) {
        if (v instanceof Frac) return new Frac(v.n, v.d);
        if (typeof v === "string" && v.includes("/")) {
            const parts = v.split("/");
            const top = parseFloat(parts[0]);
            const bot = parseFloat(parts[1]);
            if (parts.length === 2 && !isNaN(top) && !isNaN(bot) && bot !== 0) {
                const fTop = floatToFrac(top);
                const fBot = floatToFrac(bot);
                if (fTop && fBot && !fBot.isZero()) return fTop.div(fBot);
            }
        }
        const num = Number(v);
        if (isNaN(num)) return new Frac(0, 1);
        return floatToFrac(num) || new Frac(0, 1);
    }

    // Format angka dengan pemisah ribuan koma (contoh: 3000 -> 3,000, 10457.575 -> 10,457.575)
    function formatNumberWithCommas(num) {
        if (num === null || num === undefined || isNaN(num) || !isFinite(num)) {
            return "0";
        }
        let str = Number.isInteger(num) ? num.toString() : parseFloat(num.toFixed(8)).toString();

        const isNegative = str.startsWith("-");
        if (isNegative) str = str.slice(1);

        const parts = str.split(".");
        const intPart = parts[0];
        const decPart = parts[1];

        const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
        const sign = isNegative ? "-" : "";

        return decPart !== undefined ? `${sign}${formattedInt}.${decPart}` : `${sign}${formattedInt}`;
    }

    App.Core = {
        getGCD,
        Frac,
        renderDivisionStackedHtml,
        floatToFrac,
        toFracSafe,
        formatNumberWithCommas
    };
})(typeof window !== "undefined" ? window : globalThis);
