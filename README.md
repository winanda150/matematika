# Kalkulator Aljabar Linier

Aplikasi web interaktif berbasis HTML, CSS, dan JavaScript murni untuk perhitungan aritmatika cepat pecahan eksak serta penyelesaian **Sistem Persamaan Linear (SPL)** menggunakan **Operasi Baris Elementer (OBE)** dengan metode **Eliminasi Gauss** dan **Eliminasi Gauss-Jordan**, dilengkapi fitur **AI Matrix Modeler** berbasis Google Gemini API.

## Fitur Utama

1. **Kalkulator Aritmatika & Aljabar Cepat**
   - Mendukung perkalian implisit kurung bertingkat, persentase, pangkat, serta evaluasi otomatis ke angka desimal dan pecahan paling sederhana secara presisi.
2. **Penyelesaian Sistem Persamaan Linear (2x2, 3x3, 4x4)**
   - Mendukung input koefisien bilangan bulat, desimal, maupun pecahan (`a/b`).
   - Menampilkan langkah demi langkah **Operasi Baris Elementer (OBE)** secara berurutan (pertukaran baris, normalisasi pivot, eliminasi kolom) lengkap dengan notasi pecahan vertikal bertumpuk.
   - Menyertakan **Tahap Substitusi Balik** terstruktur untuk metode Eliminasi Gauss.
3. **AI Matrix Modeler (Soal Cerita)**
   - Ekstraksi otomatis variabel, model persamaan linear standar lengkap, dan matriks augmented `[ A | k ]` dari teks cerita maupun unggahan foto/tangkapan layar soal.
   - Dilengkapi **Smart Cache** lokal (`localStorage`) untuk menghemat penggunaan kuota API.
4. **Desain Responsif Penuh**
   - Dioptimalkan untuk layar ultra-kecil (`320px`), ponsel pintar, tablet, hingga layar desktop resolusi tinggi (`1200px+`).

## Struktur Folder Proyek

```text
web-matematika/
├── index.html                         # Halaman utama (root untuk GitHub Pages)
├── README.md                          # Dokumentasi proyek
├── .gitignore                         # Daftar berkas yang diabaikan Git
├── .vscode/
│   └── settings.json                  # Konfigurasi port Live Server (5501)
├── assets/
│   └── icons/
│       └── favicon.svg                # Ikon tab browser SVG
├── src/
│   ├── css/
│   │   ├── variables.css              # Design tokens & variabel ukuran matriks
│   │   ├── base.css                   # Reset CSS, background, & utilitas (.hidden, .sr-only)
│   │   ├── components.css             # Header, navigasi tab, kartu, tombol, & notasi pecahan
│   │   ├── calculator.css             # Layar & keypad Kalkulator Cepat
│   │   ├── spl-obe.css                # Grid matriks, kurung siku, langkah OBE & substitusi balik
│   │   ├── ai-modeler.css             # Panel soal cerita AI, dropzone & banner kuota
│   │   └── responsive.css             # Breakpoint responsif 320px hingga 1200px+
│   └── js/
│       ├── core/
│       │   └── fraction.js            # Kelas aritmatika pecahan eksak & pemformatan angka
│       ├── modules/
│       │   ├── quick-calculator.js    # Parser ekspresi & kontrol keypad
│       │   ├── spl-solver.js          # Solver Eliminasi Gauss, Gauss-Jordan & UI OBE
│       │   ├── upload-animator.js     # Animasi upload GSAP 3, laser scan & lightbox pratinjau
│       │   └── ai-story-modeler.js    # Integrasi Gemini AI, Smart Cache & normalisasi
│       └── main.js                    # Inisialisasi aplikasi & navigasi tab
└── docs/
    └── materi-aljabar/                # Materi referensi kuliah (PDF)
```

## Cara Menjalankan Secara Lokal

1. Buka folder proyek di Visual Studio Code.
2. Jalankan ekstensi **Live Server** (`index.html` akan terbuka di `http://127.0.0.1:5501`) atau buka berkas `index.html` langsung di peramban web.
