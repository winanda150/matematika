/**
 * UPLOAD-ANIMATOR.JS - Koreografi Animasi & Progress Upload Foto Berbasis GSAP 3
 * Mengelola hover/drag magnetis, pipeline progress 0-100% (SVG Progress Ring, <progress>
 * semantik, counter langsung, blurry-to-sharp reveal), centang SVG, laser scanner AI,
 * serta lightbox pratinjau native dialog.
 */
(function (global) {
    "use strict";

    const App = (global.AljabarApp = global.AljabarApp || {});

    function createFallbackAnimator() {
        let fallbackSession = 0;
        return {
            setDragActive: () => {},
            startUploadProgress: (_file, opts = {}) => {
                const sid = ++fallbackSession;
                return {
                    sessionId: sid,
                    markPayloadReady: () => {
                        if (typeof opts.onReady === "function") opts.onReady();
                    },
                    abort: () => {}
                };
            },
            animateFileRemove: (onDone) => {
                if (typeof onDone === "function") onDone();
            },
            startScan: () => {},
            stopScan: () => {},
            animateAnalysisReveal: () => {}
        };
    }

    function init() {
        const dropzone = document.getElementById("story-dropzone");
        const idleLabel = document.getElementById("dropzone-idle-label");
        const idleContent = document.getElementById("dropzone-idle-content");
        const previewCard = document.getElementById("story-file-preview");
        if (!dropzone || !idleLabel || !previewCard) {
            return createFallbackAnimator();
        }

        const liveRegion = document.getElementById("upload-live-region");
        const arrowGroup = dropzone.querySelector(".svg-arrow");

        const shimmerEl = previewCard.querySelector(".preview-shimmer");
        const thumbWrap = document.getElementById("preview-thumb-btn");
        const thumbImg = document.getElementById("preview-thumb-img");
        const pdfBadge = document.getElementById("preview-pdf-badge");
        const thumbVeil = document.getElementById("thumb-uploading-veil");
        const thumbRingSvg = document.getElementById("thumb-progress-ring");
        const thumbRingFill = document.getElementById("thumb-ring-fill");
        const zoomHint = document.getElementById("preview-zoom-hint");
        const scanBeam = document.getElementById("preview-scan-beam");

        const statusPill = document.getElementById("preview-status-pill");
        const statusText = document.getElementById("preview-status-text");
        const checkSvg = document.getElementById("preview-check-svg");
        const statusDot = document.getElementById("preview-status-dot");
        const checkPath = previewCard.querySelector(".preview-check-path");
        const percentBadge = document.getElementById("upload-percent-badge");
        const fileNameEl = document.getElementById("story-file-name");
        const fileSizeEl = document.getElementById("story-file-size");

        const progressPanel = document.getElementById("upload-progress-panel");
        const progressTrackWrap = document.getElementById("upload-progress-track-wrap");
        const progressBar = document.getElementById("upload-progress-bar");
        const progressSheen = document.getElementById("upload-progress-sheen");
        const progressTip = document.getElementById("upload-progress-tip");

        const previewDialog = document.getElementById("image-preview-dialog");
        const previewDialogImg = document.getElementById("image-dialog-full-img");
        const previewDialogPanel = previewDialog ? previewDialog.querySelector(".image-dialog-panel") : null;

        const ringRadius = thumbRingFill ? parseFloat(thumbRingFill.getAttribute("r")) || 24 : 24;
        const ringCircumference = 2 * Math.PI * ringRadius;
        if (thumbRingFill) {
            thumbRingFill.style.strokeDasharray = String(ringCircumference.toFixed(2));
            thumbRingFill.style.strokeDashoffset = String(ringCircumference.toFixed(2));
        }

        const hasGsap = typeof global.gsap !== "undefined";
        let motionAllowed = !global.matchMedia || !global.matchMedia("(prefers-reduced-motion: reduce)").matches;
        if (hasGsap && typeof global.gsap.matchMedia === "function") {
            const mm = global.gsap.matchMedia();
            mm.add("(prefers-reduced-motion: no-preference)", () => {
                motionAllowed = true;
                return () => {
                    motionAllowed = false;
                };
            });
        }

        const canAnimate = () => hasGsap && motionAllowed;

        let currentObjectUrl = null;
        let currentIsImage = false;
        let currentFileMeta = { name: "soal", extLabel: "FILE", sizeKb: 0, sizeKbStr: "0.0" };
        let dragPulseTween = null;
        let scanTween = null;
        let sheenTween = null;
        let holdPulseTween = null;
        let activeTimeline = null;
        let activeSession = null;
        let sessionCounter = 0;

        function announceStatus(text) {
            if (!liveRegion) return;
            liveRegion.textContent = "";
            global.requestAnimationFrame(() => {
                if (liveRegion) liveRegion.textContent = text;
            });
        }

        function clearObjectUrl() {
            if (currentObjectUrl) {
                try {
                    URL.revokeObjectURL(currentObjectUrl);
                } catch (_) {
                    // Abaikan bila URL sudah dilepas
                }
                currentObjectUrl = null;
            }
            currentIsImage = false;
            if (thumbImg) {
                thumbImg.removeAttribute("src");
                thumbImg.classList.add("hidden");
                thumbImg.style.filter = "";
                thumbImg.style.transform = "";
                thumbImg.style.opacity = "";
            }
            if (previewDialogImg) {
                previewDialogImg.removeAttribute("src");
            }
            if (pdfBadge) pdfBadge.classList.add("hidden");
        }

        function killAllMotion() {
            if (dragPulseTween) {
                dragPulseTween.kill();
                dragPulseTween = null;
            }
            if (activeTimeline) {
                activeTimeline.kill();
                activeTimeline = null;
            }
            if (sheenTween) {
                sheenTween.kill();
                sheenTween = null;
            }
            if (holdPulseTween) {
                holdPulseTween.kill();
                holdPulseTween = null;
            }
            if (hasGsap) {
                const targets = [
                    dropzone,
                    idleContent,
                    previewCard,
                    thumbWrap,
                    thumbImg,
                    thumbVeil,
                    thumbRingSvg,
                    progressPanel,
                    progressSheen,
                    progressTip,
                    percentBadge,
                    statusPill,
                    statusText,
                    checkPath,
                    shimmerEl,
                    arrowGroup
                ].filter(Boolean);
                global.gsap.killTweensOf(targets);
            }
        }

        function resetUploadUiProps(keepDoneClass = false) {
            previewCard.classList.remove("is-uploading");
            if (!keepDoneClass) {
                previewCard.classList.remove("is-upload-done");
            }
            if (progressPanel) {
                progressPanel.classList.add("hidden");
                if (hasGsap) global.gsap.set(progressPanel, { clearProps: "height,opacity,marginTop" });
            }
            if (percentBadge) {
                percentBadge.classList.add("hidden");
                percentBadge.textContent = "0%";
                if (hasGsap) global.gsap.set(percentBadge, { clearProps: "opacity,scale,transform" });
            }
            if (thumbRingSvg) {
                thumbRingSvg.classList.add("hidden");
                if (hasGsap) global.gsap.set(thumbRingSvg, { clearProps: "opacity,scale,transform" });
            }
            if (thumbRingFill) {
                thumbRingFill.style.strokeDashoffset = ringCircumference.toFixed(2);
            }
            if (thumbVeil) {
                thumbVeil.classList.add("hidden");
                if (hasGsap) global.gsap.set(thumbVeil, { clearProps: "opacity" });
            }
            if (thumbImg) {
                thumbImg.style.filter = "";
                thumbImg.style.transform = "";
                thumbImg.style.opacity = "";
            }
            if (progressTip) {
                progressTip.style.opacity = "0";
                if (hasGsap) global.gsap.set(progressTip, { clearProps: "transform,opacity,scale" });
            }
            if (progressSheen && hasGsap) {
                global.gsap.set(progressSheen, { clearProps: "transform,opacity" });
            }
            if (progressTrackWrap) {
                progressTrackWrap.style.setProperty("--upload-pct", "0%");
                progressTrackWrap.style.setProperty("--upload-clip-right", "100%");
            }
            if (progressBar) {
                progressBar.value = 0;
                progressBar.removeAttribute("aria-valuetext");
            }
            if (statusDot) statusDot.classList.add("hidden");
            if (checkSvg) checkSvg.classList.remove("hidden");
            if (statusPill) {
                statusPill.classList.remove("is-uploading");
                if (hasGsap) global.gsap.set(statusPill, { clearProps: "transform,opacity,scale" });
            }
        }

        function populateFileMeta(file) {
            clearObjectUrl();

            const fileName = file.name || "soal";
            const extMatch = fileName.match(/\.([a-zA-Z0-9]+)$/);
            const extLabel = extMatch ? extMatch[1].toUpperCase() : "FILE";
            const sizeKb = Math.max(0.1, file.size / 1024);
            const sizeKbStr = sizeKb.toFixed(1);

            currentFileMeta = { name: fileName, extLabel, sizeKb, sizeKbStr };

            if (fileNameEl) fileNameEl.textContent = fileName;
            if (fileSizeEl) fileSizeEl.textContent = `${sizeKbStr} KB • ${extLabel}`;

            const isImage = Boolean(file.type && file.type.startsWith("image/"));
            currentIsImage = isImage;

            if (isImage) {
                currentObjectUrl = URL.createObjectURL(file);
                if (thumbImg) {
                    thumbImg.src = currentObjectUrl;
                    thumbImg.classList.remove("hidden");
                }
                if (previewDialogImg) {
                    previewDialogImg.src = currentObjectUrl;
                }
                if (pdfBadge) pdfBadge.classList.add("hidden");
                if (zoomHint) zoomHint.classList.remove("hidden");
                if (thumbWrap) {
                    thumbWrap.disabled = false;
                    thumbWrap.title = "Klik untuk perbesar pratinjau gambar";
                }
            } else {
                if (pdfBadge) {
                    pdfBadge.textContent = extLabel;
                    pdfBadge.classList.remove("hidden");
                }
                if (zoomHint) zoomHint.classList.add("hidden");
                if (thumbWrap) {
                    thumbWrap.disabled = true;
                    thumbWrap.title = "Dokumen PDF siap dianalisis";
                }
            }

            if (statusPill) {
                statusPill.classList.remove("is-scanning", "is-uploading");
            }
            if (statusText) {
                statusText.textContent = "Siap Dianalisis";
            }
        }

        function enableReadyInteraction() {
            if (currentIsImage) {
                if (zoomHint) zoomHint.classList.remove("hidden");
                if (thumbWrap) {
                    thumbWrap.disabled = false;
                    thumbWrap.title = "Klik untuk perbesar pratinjau gambar";
                }
            }
            if (fileSizeEl) {
                fileSizeEl.textContent = `${currentFileMeta.sizeKbStr} KB • ${currentFileMeta.extLabel}`;
            }
        }

        function getStageInfo(pct) {
            if (pct < 36) {
                return {
                    idx: 0,
                    text: currentIsImage ? "Membaca berkas gambar..." : "Membaca berkas soal..."
                };
            }
            if (pct < 76) {
                return {
                    idx: 1,
                    text: currentIsImage ? "Mengoptimalkan pratinjau soal..." : "Memproses dokumen soal..."
                };
            }
            if (pct < 100) {
                return { idx: 2, text: "Memverifikasi kesiapan analisis..." };
            }
            return { idx: 3, text: "Siap Dianalisis" };
        }

        function renderUploadFrame(session, rawPct) {
            if (!session || session.aborted || session.id !== sessionCounter) return;
            const pct = Math.max(0, Math.min(100, rawPct));
            const rounded = Math.round(pct);
            const stage = getStageInfo(pct);

            if (stage.idx !== session.lastStageIdx) {
                if (statusText) {
                    statusText.textContent = stage.text;
                    if (session.lastStageIdx !== -1 && canAnimate() && pct < 100) {
                        global.gsap.fromTo(
                            statusText,
                            { y: 4, opacity: 0.4 },
                            { y: 0, opacity: 1, duration: 0.22, ease: "power2.out", clearProps: "transform,opacity" }
                        );
                    }
                }
                session.lastStageIdx = stage.idx;
            }

            if (progressBar) {
                progressBar.value = pct;
                progressBar.setAttribute("aria-valuetext", `${rounded}% — ${stage.text}`);
            }
            if (progressTrackWrap) {
                progressTrackWrap.style.setProperty("--upload-pct", `${pct.toFixed(2)}%`);
                progressTrackWrap.style.setProperty("--upload-clip-right", `${(100 - pct).toFixed(2)}%`);
            }
            if (progressTip) {
                const showTip = pct > 2 && pct < 99.5;
                progressTip.style.opacity = showTip ? "1" : "0";
            }
            if (percentBadge) {
                percentBadge.textContent = `${rounded}%`;
            }
            if (fileSizeEl) {
                if (pct < 100) {
                    const uploadedKb = (currentFileMeta.sizeKb * (pct / 100)).toFixed(1);
                    fileSizeEl.textContent = `${uploadedKb} / ${currentFileMeta.sizeKbStr} KB • ${currentFileMeta.extLabel}`;
                } else {
                    fileSizeEl.textContent = `${currentFileMeta.sizeKbStr} KB • ${currentFileMeta.extLabel}`;
                }
            }
            if (thumbRingFill) {
                const offset = ringCircumference * (1 - pct / 100);
                thumbRingFill.style.strokeDashoffset = offset.toFixed(2);
            }

            if (currentIsImage) {
                const remain = 1 - pct / 100;
                if (thumbImg) {
                    if (canAnimate() && remain > 0.01) {
                        thumbImg.style.filter = `blur(${(7.5 * remain).toFixed(2)}px)`;
                        thumbImg.style.transform = `scale(${(1 + 0.08 * remain).toFixed(4)})`;
                        thumbImg.style.opacity = (0.48 + 0.52 * (pct / 100)).toFixed(3);
                    } else {
                        thumbImg.style.filter = "";
                        thumbImg.style.transform = "";
                        thumbImg.style.opacity = "";
                    }
                }
                if (thumbVeil) {
                    thumbVeil.style.opacity = (remain > 0.01 ? 0.56 * remain : 0).toFixed(3);
                }
            }
        }

        function getCheckPathLength() {
            if (checkPath && typeof checkPath.getTotalLength === "function") {
                try {
                    return Math.ceil(checkPath.getTotalLength());
                } catch (_) {
                    return 24;
                }
            }
            return 24;
        }

        function runCompletionMorph(session) {
            if (!session || session.aborted || session.completed || session.id !== sessionCounter) return;
            session.completed = true;

            if (sheenTween) {
                sheenTween.kill();
                sheenTween = null;
            }
            if (holdPulseTween) {
                holdPulseTween.kill();
                holdPulseTween = null;
            }

            renderUploadFrame(session, 100);
            previewCard.classList.remove("is-uploading");
            previewCard.classList.add("is-upload-done");

            if (statusPill) statusPill.classList.remove("is-uploading");
            if (statusDot) statusDot.classList.add("hidden");
            if (checkSvg) checkSvg.classList.remove("hidden");

            enableReadyInteraction();

            if (!canAnimate()) {
                resetUploadUiProps(false);
                announceStatus(`Berkas ${currentFileMeta.name} selesai diunggah dan siap dianalisis.`);
                if (typeof session.onReady === "function") session.onReady();
                return;
            }

            const g = global.gsap;
            const pathLen = getCheckPathLength();
            const actionItems = previewCard.querySelectorAll(".preview-action-btn");

            if (checkPath) {
                g.set(checkPath, { strokeDasharray: pathLen, strokeDashoffset: pathLen });
            }
            if (shimmerEl) {
                g.set(shimmerEl, { xPercent: -120, opacity: 0.92 });
            }

            const compTl = g.timeline({
                onComplete: () => {
                    if (session.aborted || session.id !== sessionCounter) return;
                    resetUploadUiProps(false);
                    g.set([dropzone, previewCard, thumbWrap, statusPill, ...actionItems].filter(Boolean), {
                        clearProps: "transform,opacity,filter"
                    });
                    announceStatus(`Berkas ${currentFileMeta.name} selesai diunggah dan siap dianalisis.`);
                    if (typeof session.onReady === "function") session.onReady();
                }
            });
            activeTimeline = compTl;

            if (progressSheen) {
                compTl.fromTo(
                    progressSheen,
                    { xPercent: -110, opacity: 0.95 },
                    { xPercent: 270, opacity: 0, duration: 0.28, ease: "power2.out" },
                    0
                );
            }

            if (thumbRingSvg && !thumbRingSvg.classList.contains("hidden")) {
                compTl.to(thumbRingSvg, { scale: 1.15, opacity: 0, duration: 0.34, ease: "power2.out" }, 0.02);
            }

            if (thumbVeil && !thumbVeil.classList.contains("hidden")) {
                compTl.to(thumbVeil, { opacity: 0, duration: 0.24, ease: "power2.out" }, 0);
            }

            if (thumbWrap) {
                compTl.fromTo(thumbWrap, { scale: 1.045 }, { scale: 1, duration: 0.38, ease: "back.out(2)" }, 0.04);
            }

            if (percentBadge) {
                compTl.to(percentBadge, { opacity: 0, scale: 0.84, duration: 0.22, ease: "power2.in" }, 0.08);
            }

            if (progressPanel) {
                compTl.to(progressPanel, { height: 0, marginTop: 0, opacity: 0, duration: 0.28, ease: "power2.inOut" }, 0.1);
            }

            if (statusPill) {
                compTl.fromTo(statusPill, { scale: 0.88 }, { scale: 1, duration: 0.38, ease: "back.out(2.3)" }, 0.08);
            }

            if (checkPath) {
                compTl.to(checkPath, { strokeDashoffset: 0, duration: 0.36, ease: "power2.out" }, 0.12);
            }

            if (shimmerEl) {
                compTl.to(shimmerEl, { xPercent: 260, opacity: 0, duration: 0.68, ease: "power2.inOut" }, 0.14);
            }

            if (actionItems.length) {
                compTl.fromTo(actionItems, { scale: 0.94 }, { scale: 1, duration: 0.28, stagger: 0.05, ease: "back.out(1.8)" }, 0.16);
            }
        }

        function advanceTo100AndComplete(session) {
            if (!session || session.aborted || session.completed || session.id !== sessionCounter) return;
            if (holdPulseTween) {
                holdPulseTween.kill();
                holdPulseTween = null;
            }

            if (!canAnimate()) {
                runCompletionMorph(session);
                return;
            }

            activeTimeline = global.gsap.to(session.pctObj, {
                val: 100,
                duration: 0.22,
                ease: "power2.out",
                onUpdate: () => renderUploadFrame(session, session.pctObj.val),
                onComplete: () => runCompletionMorph(session)
            });
        }

        // --- 1. DRAG-OVER MICRO-INTERACTION ---
        function setDragActive(isActive) {
            dropzone.classList.toggle("drag-over", isActive);
            if (!canAnimate()) return;
            const g = global.gsap;

            if (isActive) {
                if (arrowGroup && !dragPulseTween) {
                    dragPulseTween = g.fromTo(arrowGroup, { y: 1 }, { y: -4, duration: 0.45, repeat: -1, yoyo: true, ease: "sine.inOut" });
                }
            } else {
                if (dragPulseTween) {
                    dragPulseTween.kill();
                    dragPulseTween = null;
                }
                if (arrowGroup) g.to(arrowGroup, { y: 0, duration: 0.2, ease: "power2.out", clearProps: "transform" });
            }
        }

        // --- 2. PIPELINE PROGRESS UPLOAD 0-100% + GATING PAYLOAD ---
        function startUploadProgress(file, options = {}) {
            if (!file) return null;

            if (activeSession && !activeSession.aborted) {
                activeSession.aborted = true;
            }

            stopScan(false);
            setDragActive(false);
            killAllMotion();
            resetUploadUiProps(false);

            const wasIdleVisible = !idleLabel.classList.contains("hidden");
            const sessionId = ++sessionCounter;
            const session = {
                id: sessionId,
                file,
                aborted: false,
                completed: false,
                payloadReady: false,
                minVisualReached: false,
                pctObj: { val: 0 },
                lastStageIdx: -1,
                onReady: options.onReady
            };
            activeSession = session;

            populateFileMeta(file);

            // Masuk mode uploading (terkunci dari zoom sebelum 100%)
            previewCard.classList.add("is-uploading");
            previewCard.classList.remove("is-upload-done");
            if (thumbWrap) {
                thumbWrap.disabled = true;
                thumbWrap.title = "Menyiapkan pratinjau gambar...";
            }
            if (zoomHint) zoomHint.classList.add("hidden");
            if (progressPanel) progressPanel.classList.remove("hidden");
            if (percentBadge) percentBadge.classList.remove("hidden");
            if (thumbRingSvg) thumbRingSvg.classList.remove("hidden");
            if (currentIsImage && thumbVeil) thumbVeil.classList.remove("hidden");
            if (statusPill) statusPill.classList.add("is-uploading");
            if (checkSvg) checkSvg.classList.add("hidden");
            if (statusDot) statusDot.classList.remove("hidden");

            renderUploadFrame(session, 0);
            announceStatus(`Mengunggah ${currentFileMeta.name}`);

            if (!canAnimate()) {
                idleLabel.classList.add("hidden");
                previewCard.classList.remove("hidden");
                renderUploadFrame(session, 40);
            } else {
                const g = global.gsap;
                const metaRow = [
                    previewCard.querySelector(".preview-status-row"),
                    fileNameEl,
                    fileSizeEl,
                    progressPanel,
                    previewCard.querySelector(".preview-actions")
                ].filter(Boolean);

                const tl = g.timeline();
                activeTimeline = tl;

                if (wasIdleVisible && idleContent) {
                    tl.to(idleContent, { y: -12, opacity: 0, duration: 0.15, ease: "power2.in" });
                }

                tl.add(() => {
                    if (session.aborted || session.id !== sessionCounter) return;
                    idleLabel.classList.add("hidden");
                    if (idleContent) g.set(idleContent, { clearProps: "transform,opacity" });
                    previewCard.classList.remove("hidden");
                    g.set(previewCard, { opacity: 1 });
                    if (thumbWrap) g.set(thumbWrap, { opacity: 0, scale: 0.85 });
                    if (metaRow.length) g.set(metaRow, { opacity: 0, y: 10 });

                    if (progressSheen) {
                        sheenTween = g.fromTo(
                            progressSheen,
                            { xPercent: -110 },
                            { xPercent: 270, duration: 0.85, repeat: -1, ease: "power1.inOut" }
                        );
                    }
                });

                tl.fromTo(dropzone, { scale: 0.985 }, { scale: 1, duration: 0.36, ease: "back.out(2)", clearProps: "transform" });

                if (thumbWrap) {
                    tl.to(thumbWrap, { opacity: 1, scale: 1, duration: 0.34, ease: "back.out(1.7)", clearProps: "transform,opacity" }, "<");
                }

                if (metaRow.length) {
                    tl.to(
                        metaRow,
                        { opacity: 1, y: 0, duration: 0.28, stagger: 0.04, ease: "power3.out", clearProps: "transform,opacity" },
                        "<0.04"
                    );
                }

                // Tahap progress bertingkat: 0% -> 38% -> 74% -> 88% (total ~0.78s)
                tl.to(
                    session.pctObj,
                    {
                        val: 38,
                        duration: 0.26,
                        ease: "power2.out",
                        onUpdate: () => renderUploadFrame(session, session.pctObj.val)
                    },
                    "<0.02"
                );

                tl.to(session.pctObj, {
                    val: 74,
                    duration: 0.28,
                    ease: "power1.inOut",
                    onUpdate: () => renderUploadFrame(session, session.pctObj.val)
                });

                tl.to(session.pctObj, {
                    val: 88,
                    duration: 0.24,
                    ease: "power1.out",
                    onUpdate: () => renderUploadFrame(session, session.pctObj.val)
                });

                tl.add(() => {
                    if (session.aborted || session.id !== sessionCounter) return;
                    session.minVisualReached = true;
                    if (session.payloadReady) {
                        advanceTo100AndComplete(session);
                    } else {
                        holdPulseTween = g.to(session.pctObj, {
                            val: 94,
                            duration: 1.4,
                            ease: "sine.out",
                            onUpdate: () => renderUploadFrame(session, session.pctObj.val)
                        });
                    }
                });
            }

            return {
                sessionId,
                markPayloadReady: () => {
                    if (session.aborted || session.id !== sessionCounter) return;
                    session.payloadReady = true;
                    if (!canAnimate() || session.minVisualReached) {
                        advanceTo100AndComplete(session);
                    }
                },
                abort: () => {
                    if (session.aborted || session.id !== sessionCounter) return;
                    session.aborted = true;
                    killAllMotion();
                }
            };
        }

        // --- 3. AI LASER SCANNER SAAT PROSES ANALISIS ---
        function startScan() {
            if (previewCard.classList.contains("hidden")) return;

            if (statusDot) statusDot.classList.remove("hidden");
            if (checkSvg) checkSvg.classList.add("hidden");
            if (statusPill) statusPill.classList.add("is-scanning");
            if (statusText) statusText.textContent = "Memindai Soal...";

            if (!scanBeam) return;
            scanBeam.classList.remove("hidden");

            if (!canAnimate()) return;
            const g = global.gsap;

            if (scanTween) {
                scanTween.kill();
                scanTween = null;
            }

            const travelY = Math.max(46, (thumbWrap ? thumbWrap.clientHeight : 76) - 14);
            scanTween = g.fromTo(
                scanBeam,
                { y: -20, opacity: 0.9 },
                {
                    y: travelY,
                    opacity: 1,
                    duration: 0.92,
                    repeat: -1,
                    yoyo: true,
                    ease: "sine.inOut"
                }
            );
        }

        function stopScan(isSuccess = false) {
            if (scanTween) {
                scanTween.kill();
                scanTween = null;
            }
            if (scanBeam) {
                if (hasGsap) global.gsap.set(scanBeam, { clearProps: "transform,opacity" });
                scanBeam.classList.add("hidden");
            }
            if (statusPill) {
                statusPill.classList.remove("is-scanning");
            }
            if (!previewCard.classList.contains("is-uploading")) {
                if (statusDot) statusDot.classList.add("hidden");
                if (checkSvg) checkSvg.classList.remove("hidden");
                if (statusText) {
                    statusText.textContent = isSuccess ? "Berhasil Diekstrak" : "Siap Dianalisis";
                }
            }
            if (isSuccess && canAnimate() && statusPill && !previewCard.classList.contains("hidden")) {
                global.gsap.fromTo(
                    statusPill,
                    { scale: 0.9 },
                    { scale: 1, duration: 0.36, ease: "back.out(2.2)", clearProps: "transform" }
                );
            }
        }

        // --- 4. TRANSISI HAPUS / BATAL & RESET KE STATE IDLE ---
        function animateFileRemove(onAfterHide) {
            if (activeSession) {
                activeSession.aborted = true;
                activeSession = null;
            }
            sessionCounter += 1;

            stopScan(false);
            killAllMotion();

            const finishReset = () => {
                resetUploadUiProps(false);
                previewCard.classList.add("hidden");
                clearObjectUrl();
                if (typeof onAfterHide === "function") onAfterHide();
                idleLabel.classList.remove("hidden");

                if (canAnimate() && idleContent) {
                    global.gsap.fromTo(
                        idleContent,
                        { y: -8, opacity: 0 },
                        { y: 0, opacity: 1, duration: 0.3, ease: "power3.out", clearProps: "transform,opacity" }
                    );
                }
            };

            if (!canAnimate() || previewCard.classList.contains("hidden")) {
                finishReset();
                return;
            }

            const g = global.gsap;
            activeTimeline = g.timeline({
                onComplete: () => {
                    g.set(previewCard, { clearProps: "transform,opacity" });
                    finishReset();
                }
            });

            activeTimeline.to(previewCard, {
                opacity: 0,
                y: 8,
                scale: 0.95,
                duration: 0.22,
                ease: "power2.in"
            });
        }

        // --- 5. REVEAL BERTINGKAT HASIL ANALISIS & OBE ---
        function animateAnalysisReveal(analysisCard, resultArea) {
            if (!canAnimate()) return;
            const g = global.gsap;

            if (analysisCard && !analysisCard.classList.contains("hidden")) {
                const blocks = [
                    analysisCard.querySelector(".ai-story-card-header"),
                    analysisCard.querySelector(".ai-story-grid"),
                    analysisCard.querySelector(".ai-story-footer")
                ].filter(Boolean);

                g.fromTo(
                    analysisCard,
                    { opacity: 0, y: 14 },
                    { opacity: 1, y: 0, duration: 0.38, ease: "power3.out", clearProps: "transform,opacity" }
                );
                if (blocks.length) {
                    g.fromTo(
                        blocks,
                        { opacity: 0, y: 10 },
                        { opacity: 1, y: 0, duration: 0.34, stagger: 0.06, ease: "power2.out", clearProps: "transform,opacity" }
                    );
                }
            }

            if (resultArea && !resultArea.classList.contains("hidden")) {
                const solCard = resultArea.querySelector(".spl-solution-card");
                if (solCard) {
                    g.fromTo(
                        solCard,
                        { opacity: 0, scale: 0.97, y: 12 },
                        { opacity: 1, scale: 1, y: 0, duration: 0.42, delay: 0.08, ease: "back.out(1.4)", clearProps: "transform,opacity" }
                    );
                }
            }
        }

        // --- 6. NATIVE LIGHTBOX PREVIEW DIALOG + FALLBACK LIGHT-DISMISS ---
        function bindPreviewDialog() {
            if (!previewDialog || !thumbWrap) return;

            thumbWrap.addEventListener("click", (e) => {
                e.preventDefault();
                if (thumbWrap.disabled || !currentIsImage || !currentObjectUrl) return;
                if (typeof previewDialog.showModal === "function") {
                    previewDialog.showModal();
                    if (canAnimate() && previewDialogPanel) {
                        global.gsap.fromTo(
                            previewDialogPanel,
                            { opacity: 0, scale: 0.9, y: 14 },
                            { opacity: 1, scale: 1, y: 0, duration: 0.3, ease: "back.out(1.5)", clearProps: "transform,opacity" }
                        );
                    }
                }
            });

            previewDialog.addEventListener("close", () => {
                previewDialog.returnValue = "";
            });

            // Fallback light-dismiss bagi peramban yang belum mendukung atribut closedby="any"
            if (!("closedBy" in HTMLDialogElement.prototype)) {
                const isOutside = (e) => {
                    const r = previewDialog.getBoundingClientRect();
                    return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
                };
                let pressedOutside = false;
                previewDialog.addEventListener("pointerdown", (e) => {
                    pressedOutside = isOutside(e);
                });
                previewDialog.addEventListener("pointerup", (e) => {
                    if (pressedOutside && isOutside(e)) {
                        previewDialog.close();
                    }
                });
            }
        }

        bindPreviewDialog();

        return {
            setDragActive,
            startUploadProgress,
            animateFileRemove,
            startScan,
            stopScan,
            animateAnalysisReveal
        };
    }

    App.UploadAnimator = {
        init
    };
})(typeof window !== "undefined" ? window : globalThis);
