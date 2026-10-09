/* Khi Tuổi Trẻ Còn Đang Viết — script.js
   Cuộn dọc → hành trình ngang (GSAP + ScrollTrigger), có fallback cuộn ngang gốc.

   Mục lục:
   1 DOM cache & tiện ích · 2 thiết bị & tier · 3 state · 4 liên hệ (toast/copy) · 5 đo viewport & vừa chiều cao
   6 chuẩn hóa bánh xe · 7 trang/nhãn/nền theo chương · 8 chế độ tĩnh (fallback)
   9 chế độ GSAP: đo đạc, snap, cuộn mượt, focus/bàn phím, hero intro, loader, reveal, đếm số, gõ code,
     trái tim, bụi, giám sát FPS, resize, dọn dẹp · 10 khởi động */
(() => {
  "use strict";

  /* ---------- 1. DOM cache & tiện ích ---------- */
  const root = document.documentElement;
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const dom = {
    world: $("#world"), track: $("#track"), loader: $("#loader"),
    label: $("#label"), count: $("#count"), bar: $("#bar"), toast: $("#toast"),
    code: $("#codebox"), hero: $(".hero"), thanks: $(".thanks"),
    heartBtn: $("#heartBtn"), heart: $("#heartBtn .heart"),
    num: $("#ldNum"), fill: $("#ldFill")
  };
  const pages = $$(".p");
  const codeFull = dom.code ? dom.code.textContent : "";
  const noop = () => {};
  const pad2 = n => String(n).padStart(2, "0");
  const safe = fn => { try { return fn(); } catch (err) { console.warn("[ktt]", err); } };
  const clamp = (a, b, v) => Math.min(b, Math.max(a, v));
  const debounce = (fn, ms) => {
    let t = 0;
    const d = (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
    d.cancel = () => clearTimeout(t);
    return d;
  };
  /* "Túi dọn dẹp": mọi listener/timer đăng ký qua đây, run() gỡ sạch theo thứ tự ngược */
  const bag = () => {
    const fns = [];
    return {
      add(fn) { fns.push(fn); return fn; },
      on(t, ev, fn, o) { t.addEventListener(ev, fn, o); fns.push(() => t.removeEventListener(ev, fn, o)); },
      run() { while (fns.length) safe(fns.pop()); }
    };
  };

  /* ---------- 2. Thiết bị & mức hiệu năng: high / mid / low ----------
     Chấm theo tín hiệu phần cứng + mạng; sau đó chế độ GSAP còn giám sát FPS thật và tự hạ tier. */
  const touch = matchMedia("(pointer:coarse)").matches;
  const ios = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const tier = (() => {
    const n = navigator, net = n.connection || {};
    const cores = n.hardwareConcurrency || 4;
    const mem = n.deviceMemory || (touch ? 4 : 8);          /* Safari/Firefox không có deviceMemory */
    const saver = net.saveData || /(^|-)2g$/.test(net.effectiveType || "") || matchMedia("(prefers-reduced-data:reduce)").matches;
    if (saver || mem <= 2 || cores <= 2) return "low";
    if (touch) return !ios && (cores <= 4 || mem <= 3) ? "low" : "mid";
    return cores <= 4 || mem <= 4 ? "mid" : "high";
  })();
  root.dataset.tier = tier;
  if (tier === "low") root.classList.add("lowfx");

  /* ---------- 3. State machine ----------
     LOADING → LOADER_READY → LOADER_EXIT → HERO_INTRO → HERO_READY → SCROLL_ENABLED
     Section sau Hero chỉ reveal khi allowSectionReveal === true (đặt duy nhất trong finishIntro). */
  const state = { phase: "LOADING", loaderComplete: false, introComplete: false, allowSectionReveal: false };
  const setPhase = p => { state.phase = p; root.dataset.phase = p; };
  const resetState = () => { state.loaderComplete = state.introComplete = state.allowSectionReveal = false; setPhase("LOADING"); };

  /* ---------- 4. Toast + sao chép + skip link (không phụ thuộc GSAP) ---------- */
  let toastTimer = 0;
  const showToast = msg => {
    if (!dom.toast) return;
    dom.toast.querySelector("span").textContent = msg;
    dom.toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => dom.toast.classList.remove("show"), 1900);
  };
  async function copy(text, msg) {
    try { await navigator.clipboard.writeText(text); }
    catch {
      const ta = document.createElement("textarea");
      ta.value = text; ta.setAttribute("readonly", "");
      ta.style.cssText = "position:fixed;top:0;left:0;opacity:0;font-size:16px";   /* 16px: iOS không tự zoom */
      document.body.appendChild(ta); ta.select(); ta.setSelectionRange(0, text.length);
      try { document.execCommand("copy"); } catch (e) { /* bỏ qua */ }
      ta.remove();
    }
    showToast(msg);
  }
  const phoneBtn = $("#phoneBtn"), mailBtn = $("#mailBtn"), skipLink = $(".skip-link");
  if (phoneBtn) phoneBtn.addEventListener("click", () => copy("0919951334", "Đã sao chép số điện thoại"));
  if (mailBtn) mailBtn.addEventListener("click", () => copy("vinhtrandangphuoc@gmail.com", "Đã sao chép email"));
  /* Skip link: chỉ chuyển focus, không để trình duyệt cuộn tới #world (đang bị pin) */
  if (skipLink && dom.world) skipLink.addEventListener("click", e => { e.preventDefault(); dom.world.focus({ preventScroll: true }); });

  /* ---------- 5. Đo viewport & vừa chiều cao ----------
     --vw = bề ngang thật (đã trừ thanh cuộn desktop) để 100vw không làm tràn.
     Không scale: chỉ giảm cỡ chữ/khoảng cách theo mức 0–3 cho tới khi mọi section vừa viewport. */
  const syncVw = () => root.style.setProperty("--vw", root.clientWidth + "px");
  const fitSections = () => {
    const world = dom.world;
    if (!world) return;
    const H = world.clientHeight;
    if (!H) return;
    let lvl = 0;
    for (; lvl <= 3; lvl++) {
      root.dataset.fit = String(lvl);
      if (!pages.some(p => p.offsetHeight > H + 1)) break;
    }
    if (lvl > 3) root.dataset.fit = "3";
  };

  /* ---------- 6. Chuẩn hóa bánh xe / trackpad ----------
     Windows: nấc rời rạc (~100px/nấc, Firefox tính theo dòng). macOS: trackpad quán tính, nhiều sự kiện nhỏ.
     Quy về một thang: deltaMode → px, mỗi sự kiện bị chặn ±WHEEL_CAP để cú vuốt mạnh không "bay" quá xa. */
  const WHEEL_CAP = 120;
  const wheelInfo = e => {
    const horiz = Math.abs(e.deltaX) > Math.abs(e.deltaY);
    let d = horiz ? e.deltaX : e.deltaY;
    if (e.deltaMode === 1) d *= 32; else if (e.deltaMode === 2) d *= innerHeight;
    return { d, horiz };
  };

  /* ---------- Tách chữ ---------- */
  function splitWords(el) {
    if (!el || el.dataset.split) return;
    el.dataset.split = "1";
    el.setAttribute("aria-label", el.textContent.replace(/\s+/g, " ").trim());
    (function walk(n) {
      Array.from(n.childNodes).forEach(c => {
        if (c.nodeType === 3) {
          const fr = document.createDocumentFragment();
          c.textContent.split(/(\s+)/).forEach(t => {
            if (!t) return;
            if (/^\s+$/.test(t)) return fr.appendChild(document.createTextNode(" "));
            const w = document.createElement("span"), i = document.createElement("span");
            w.className = "w"; w.setAttribute("aria-hidden", "true"); i.textContent = t; w.appendChild(i); fr.appendChild(w);
          });
          c.replaceWith(fr);
        } else if (c.nodeType === 1) walk(c);
      });
    })(el);
  }

  /* ---------- 7. Trang, nhãn chương, nền theo chương ----------
     Nền = 2 lớp .bg i; đổi chương → đặt màu cho lớp đang ẩn rồi crossfade opacity bằng CSS (compositor). */
  const tones = [
    ["Mở đầu", "#dfeaf3", "#f5e6ea"], ["Lời mở", "#e8eef5", "#f3ebe3"],
    ["Chương I ·", "#e3edf5", "#e9f0e6"], ["Chương II ·", "#dbe6f2", "#f2e4e8"],
    ["Chương III ·", "#d8e4ee", "#e4e8f3"], ["Chương IV ·", "#f1e4e8", "#e3ecf4"],
    ["Nhìn về", "#e6eef5", "#f5e8e2"], ["Chương cuối", "#f6e6df", "#f2e1e7"], ["Cảm ơn", "#f7e8df", "#f3e2e6"]
  ];
  const toneLayers = $$(".bg i");
  let toneIdx = 0, toneNow = null, current = -1;
  const applyTone = t => {
    if (t === toneNow) return;
    const first = toneNow === null;
    toneNow = t;
    if (toneLayers.length < 2) { root.style.setProperty("--w1", t[1]); root.style.setProperty("--w2", t[2]); return; }
    if (first) {                                        /* lần đầu: ghi thẳng vào lớp đang hiện */
      toneLayers[toneIdx].style.setProperty("--w1", t[1]); toneLayers[toneIdx].style.setProperty("--w2", t[2]);
      return;
    }
    const prev = toneLayers[toneIdx], next = toneLayers[toneIdx ^= 1];
    next.style.setProperty("--w1", t[1]); next.style.setProperty("--w2", t[2]);
    next.classList.add("on"); prev.classList.remove("on");
  };
  const setPage = i => {
    if (i === current || !pages[i]) return;
    current = i;
    const name = pages[i].dataset.label || "";
    if (dom.label && name) dom.label.textContent = name;
    if (dom.count) dom.count.textContent = pad2(i + 1) + " / " + pad2(pages.length);
    const t = tones.find(t => name.startsWith(t[0]));
    if (t) applyTone(t);
  };

  /* ---------- 8. Chế độ tĩnh: reduced-motion hoặc GSAP không tải được ----------
     Hành trình ngang bằng cuộn ngang gốc (vuốt / bánh xe / thanh cuộn) + scroll-snap. Nội dung luôn hiển thị. */
  const staticMode = () => {
    root.classList.remove("ld", "ldgo", "lock", "fx", "rev");
    root.classList.add("static");
    setPhase("STATIC");
    state.loaderComplete = state.introComplete = state.allowSectionReveal = true;
    const world = dom.world;
    if (!world) return noop;
    const B = bag();
    let raf = 0, lefts = [], maxX = 1, lastW = innerWidth, lastH = innerHeight;

    const measure = () => {                            /* đo một lần, cache — không đọc layout trong lúc cuộn */
      syncVw(); fitSections();
      lefts = pages.map(p => p.offsetLeft);
      maxX = Math.max(1, world.scrollWidth - world.clientWidth);
    };
    const update = () => {
      raf = 0;
      const sl = world.scrollLeft;
      let p = sl / maxX;
      if (p > .997) p = 1;
      const mid = sl + world.clientWidth * .6;
      let i = 0;
      while (i + 1 < pages.length && lefts[i + 1] <= mid) i++;
      setPage(p === 1 ? pages.length - 1 : i);
      if (dom.bar) dom.bar.style.transform = "scaleX(" + p + ")";
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update); };

    /* Lăn chuột dọc → cuộn ngang. Tạm tắt snap trong lúc lăn (nếu không, snap proximity "hút" ngược lại), nhả sau 150ms. */
    const releaseSnap = debounce(() => world.classList.remove("nosnap"), 150);
    B.add(releaseSnap.cancel);
    const onWheel = e => {
      if (e.ctrlKey || e.defaultPrevented) return;
      const w = wheelInfo(e);
      if (!w.d || w.horiz || world.scrollHeight > world.clientHeight + 1) return;   /* ngang: để trình duyệt tự xử lý */
      e.preventDefault();
      world.classList.add("nosnap");
      world.scrollLeft += clamp(-WHEEL_CAP, WHEEL_CAP, w.d);
      releaseSnap();
    };

    /* Tab / focus: đưa nguyên trang chứa phần tử vào giữa khung nhìn */
    const onFocusIn = e => {
      const p = e.target.closest && e.target.closest(".p");
      if (!p) return;
      requestAnimationFrame(() => {
        const L = p.offsetLeft, W = p.offsetWidth, vw = world.clientWidth;
        if (L >= world.scrollLeft && L + W <= world.scrollLeft + vw) return;       /* đã nằm trọn */
        world.scrollTo({ left: clamp(0, maxX, L + W / 2 - vw / 2), behavior: "auto" });
      });
    };

    const onResize = debounce(() => {
      if (Math.abs(innerWidth - lastW) < 24 && Math.abs(innerHeight - lastH) < (touch ? 140 : 24)) return;
      lastW = innerWidth; lastH = innerHeight; measure(); update();
    }, 220);
    B.add(onResize.cancel);

    B.on(world, "scroll", onScroll, { passive: true });
    B.on(world, "wheel", onWheel, { passive: false });          /* bắt buộc non-passive: cần preventDefault */
    B.on(world, "focusin", onFocusIn);
    B.on(window, "resize", onResize, { passive: true });
    B.on(window, "orientationchange", onResize, { passive: true });
    B.add(() => cancelAnimationFrame(raf));
    B.add(() => { root.classList.remove("static"); world.classList.remove("nosnap"); });
    measure();
    update();
    return () => B.run();
  };

  /* ---------- 9. Chế độ đầy đủ: GSAP + ScrollTrigger ---------- */
  const motion = ctx => {
    const { world, track } = dom;
    if (!world || !track || !pages.length) return staticMode();

    const B = bag();
    const run = fn => ctx.add(fn);                      /* tween tạo trong callback bất đồng bộ vẫn thuộc context → revert sạch */
    const inputEvents = ["wheel", "touchstart", "pointerdown", "keydown"];
    const events = [];                                  /* mốc reveal chạy một lần */
    let pending = 0, dead = false, hs = null, st = null, introTl = null, loaderTl = null, watchdog = null, glide = null, wTarget = 0;
    let curTier = tier, maxY = 0;

    const ts = tier === "low" ? .6 : touch ? .75 : 1;   /* hệ số thời gian loader/intro */
    const dur = touch ? .85 : 1.1;
    const clamp01 = gsap.utils.clamp(0, 1);
    const heroI = pages.indexOf(dom.hero);
    const when = (el, f, fn) => { events.push({ el, f, fn, at: 0, done: false }); pending++; };

    /* ----- Đo đạc có cache: chỉ đọc layout khi refresh, không đọc trong vòng lặp animation ----- */
    let vw = root.clientWidth, D = 0, trackW = 1, lefts = [], widths = [], snapP = [], snapOn = false, dir = 1;
    const measure = () => {
      syncVw();
      fitSections();                                    /* có thể đổi layout → đo sau */
      vw = root.clientWidth;
      lefts = pages.map(p => p.offsetLeft);
      widths = pages.map(p => p.offsetWidth);
      const n = pages.length - 1, padR = parseFloat(getComputedStyle(track).paddingRight) || 0;
      /* Điểm cuối: section cuối được CĂN GIỮA nhưng luôn đủ để cạnh phải + lề an toàn nằm trọn trong viewport. */
      D = Math.max(0, lefts[n] + widths[n] / 2 - vw / 2, lefts[n] + widths[n] + padR - vw);
      trackW = Math.max(1, track.scrollWidth);
      const tr = track.getBoundingClientRect().left;
      events.forEach(e => { e.at = e.el.getBoundingClientRect().left - tr; });
      /* Điểm snap = từng trang được căn giữa (hero → 0, trang cuối → D) */
      const xs = pages.map((p, i) => i === 0 ? 0 : clamp(0, D, lefts[i] + widths[i] / 2 - vw / 2)).filter((v, i, a) => !i || v - a[i - 1] > 2);
      snapP = D ? xs.map(v => v / D) : [0];
      snapOn = touch || vw < 760;                       /* màn hình hẹp: mỗi lần vuốt = một trang */
    };
    /* progress → vị trí cuộn dọc thật */
    const scrollForX = x => st.start + (D ? x / D : 0) * (st.end - st.start);

    /* Snap có hướng: vuốt nhẹ (>16% quãng) → sang trang kế; vuốt mạnh cũng chỉ sang đúng một trang, không trôi xa */
    const snapTo = v => {
      const n = snapP.length;
      if (!snapOn || n < 2) return v;
      let j = 0;
      while (j + 1 < n && snapP[j + 1] <= v + 1e-6) j++;
      if (j >= n - 1) return snapP[n - 1];
      const a = snapP[j], b = snapP[j + 1], f = (v - a) / (b - a);
      return dir > 0 ? (f > .16 ? b : a) : (f < .84 ? a : b);
    };

    /* ----- Cuộn mượt bằng JS cho bánh xe/trackpad & điều hướng bàn phím ----- */
    const glideTo = (y, d, ease) => {
      y = clamp(0, maxY || ScrollTrigger.maxScroll(window), y);
      if (glide) glide.kill();
      const o = { v: scrollY };
      glide = gsap.to(o, {
        v: y, duration: d, ease: ease || "power3.inOut", overwrite: true,
        onUpdate: () => scrollTo(0, o.v),
        onComplete: () => { glide = null; }
      });
      wTarget = y;
    };
    const killGlide = () => { if (glide) { glide.kill(); glide = null; } };
    const focusPage = i => {
      if (i < 0 || i >= pages.length || !D) return;
      const x = i === 0 ? 0 : clamp(0, D, lefts[i] + widths[i] / 2 - vw / 2);
      glideTo(scrollForX(x), .6);
    };

    /* ----- Parallax: một bộ điều khiển duy nhất thay cho hàng chục ScrollTrigger ----- */
    let parallax = [];
    const addPar = (sel, fn, d, tag) => {
      const el = $(sel);
      if (el) parallax.push({ fn, tag, to: d ? gsap.quickTo(el, "x", { duration: d, ease: "power3" }) : gsap.quickSetter(el, "x", "px") });
    };
    const sway = (f, a) => x => vw * a * Math.sin(x * f / vw * 1.6);   /* đung đưa có giới hạn quanh vị trí gốc */
    const loop = f => x => -((x * f) % vw);                            /* bụi lặp tuần hoàn theo bề ngang màn hình */
    const layers = [[".d1", .18, 2], [".d2", .4, 3], [".d3", .7, 5]];
    const counts = tier === "high" ? [7, 5, 3] : tier === "mid" ? (innerWidth < 768 ? [3, 2, 1] : [6, 4, 3]) : [0, 0, 0];
    const dustMoves = tier === "high";
    const nums = [], setBar = dom.bar ? gsap.quickSetter(dom.bar, "scaleX") : null;
    const inkEl = $(".ink"), setInk = inkEl ? gsap.quickSetter(inkEl, "scaleX") : null;
    const heroOp = dom.hero && gsap.quickSetter(dom.hero, "opacity"), heroX = dom.hero && gsap.quickSetter(dom.hero, "x", "px");
    let heroT = -1;

    /* ----- Giám sát FPS thật khi đang cuộn: tụt thì tự hạ tier (chỉ hạ, không nâng lại) ----- */
    let lastT = 0, fpsN = 0, fpsSum = 0, perfDone = tier === "low";
    const downgrade = lvl => {
      if (dead || lvl === curTier) return;
      curTier = lvl; root.dataset.tier = lvl;
      parallax = parallax.filter(o => lvl === "low" ? o.tag === "rings" : o.tag !== "dust");
      if (lvl === "low") {
        root.classList.add("lowfx");
        $$(".dust > div").forEach(g => { g.textContent = ""; });
        perfDone = true;
      }
      gsap.set($$(".p h2 .w > span"), { clearProps: "filter" });
    };
    const watchPerf = () => {
      const now = performance.now(), dt = now - lastT;
      lastT = now;
      if (perfDone || dt > 120 || dt < 4) return;       /* bỏ qua khoảng nghỉ giữa các lần cuộn */
      fpsSum += dt;
      if (++fpsN < 40) return;
      const avg = fpsSum / fpsN;
      fpsN = 0; fpsSum = 0;
      if (avg > 28) downgrade("low");                   /* < ~36fps */
      else if (avg > 21 && curTier === "high") downgrade("mid");
    };

    /* ----- Một hàm cập nhật duy nhất theo tiến trình p (0..1) ----- */
    const tick = p => {
      const x = p * D;
      if (p > .997) p = 1;
      watchPerf();
      if (setBar) setBar(p);
      let i = 0;
      const mid = x + vw * .6;
      while (i + 1 < pages.length && lefts[i + 1] <= mid) i++;
      setPage(p === 1 ? pages.length - 1 : i);
      /* Reveal chỉ khi: Hero đã xong VÀ người dùng thực sự đã cuộn (x > 0) */
      if (pending && state.allowSectionReveal && x > 1) {
        for (const e of events) if (!e.done && e.at - x <= vw * e.f) { e.done = true; pending--; safe(() => run(e.fn)); }
      }
      for (const o of parallax) o.to(o.fn(x));
      if (setInk) setInk(clamp01((x + vw) / trackW));
      for (const n of nums) {
        const t = (vw - (lefts[n.i] - x)) / (vw + widths[n.i]);
        if (t > -.1 && t < 1.1) n.set(90 - 180 * clamp01(t));
      }
      if (heroOp) {
        const t = clamp01(1 - (lefts[heroI] + widths[heroI] - x) / (vw * .45));
        if (t !== heroT) { heroT = t; heroOp(1 - .85 * t); heroX(80 * t); }
      }
    };

    /* ----- Bụi: số lượng theo thiết bị (máy yếu: tắt hẳn). top theo % của lớp fixed → không phụ thuộc thanh địa chỉ ----- */
    let lastW = innerWidth, lastH = innerHeight, lastLand = innerWidth > innerHeight, dustW = innerWidth, rt = 0;
    const build = () => layers.forEach(([s, f, r], k) => {
      const g = $(s);
      if (!g) return;
      g.textContent = "";
      const fr = document.createDocumentFragment();
      for (let i = 0; i < counts[k]; i++) {
        const z = r * (.6 + Math.random() * .8), x = Math.random() * vw, y = 6 + Math.random() * 88, o = .25 + Math.random() * .35;
        const rot = Math.random() * 180, line = i % 2;
        /* Mẫu tuần hoàn chu kỳ = bề ngang màn hình: bản sao ở +vw giúp vòng lặp liền mạch */
        for (let c = 0; c < (dustMoves ? 2 : 1); c++) {
          const d = document.createElement("i");
          d.style.cssText = `left:${x + c * vw}px;top:${y}%;opacity:${o};` +
            (line ? `width:${z * 6}px;height:1px;transform:rotate(${rot}deg)` : `width:${z}px;height:${z}px;border-radius:50%`);
          fr.appendChild(d);
        }
      }
      g.appendChild(fr);
    });
    const hasDust = counts.some(Boolean);
    const onInit = () => {
      measure();
      if (hasDust && curTier !== "low" && Math.abs(innerWidth - dustW) > 50) { dustW = innerWidth; build(); }
    };
    const onRefresh = () => { maxY = ScrollTrigger.maxScroll(window); };

    /* ----- Dọn dẹp toàn bộ (lỗi, đổi chế độ, kết thúc). Idempotent. ----- */
    const cleanup = () => {
      if (dead) return;
      dead = true;
      clearTimeout(rt);
      inputEvents.forEach(ev => removeEventListener(ev, skip));
      B.run();                                          /* gỡ listener + debounce timer */
      safe(() => ScrollTrigger.removeEventListener("refreshInit", onInit));
      safe(() => ScrollTrigger.removeEventListener("refresh", onRefresh));
      safe(() => { if (watchdog) watchdog.kill(); });
      safe(() => { if (loaderTl) loaderTl.kill(); if (introTl) introTl.kill(); if (glide) glide.kill(); });
      safe(() => { if (hs) { if (hs.scrollTrigger) hs.scrollTrigger.kill(true); hs.kill(); } });
      safe(() => gsap.set([".hi", ".rv", ".hero .w > span", ".p h2 .w > span", ".hline", ".fl", ".ld-core *", ".ink", ".bar", ".rings", ".o1", ".o2", ".o3", ".d1", ".d2", ".d3"], { clearProps: "all" }));
      safe(() => gsap.set([track, ".hero", "#loader", world], { clearProps: "all" }));
      $$(".fl").forEach(n => n.remove());
      $$(".dust > div").forEach(g => { g.textContent = ""; });
      $$(".cnt").forEach(el => { el.textContent = el.dataset.to; });
      if (dom.code && codeFull) dom.code.textContent = codeFull;
      root.classList.remove("fx", "ld", "ldgo", "lock", "rev");
    };

    /* Bỏ qua / tua nhanh khi người dùng chạm, cuộn, nhấn phím trong lúc loader hoặc intro */
    function skip() {
      if (state.phase === "HERO_INTRO" && introTl) introTl.timeScale(5);
      else if (!state.loaderComplete && loaderTl) loaderTl.timeScale(3);
    }

    try {
      resetState();
      root.classList.add("fx");
      setPage(0);

      /* Parallax layers */
      addPar(".rings", sway(.28, .05), touch ? .5 : .9, "rings");
      if (tier !== "low") [[".o1", .12, .06], [".o2", .5, .12], [".o3", .85, .1]].forEach(([s, f, a]) => addPar(s, sway(f, a), touch ? .7 : 1.1, "orb"));
      if (dustMoves) layers.forEach(([s, f]) => addPar(s, loop(f), 0, "dust"));
      $$(".grade .num").forEach(n => nums.push({ i: pages.indexOf(n.parentElement), set: gsap.quickSetter(n, "x", "px") }));
      if (hasDust) build();

      /* --- Reveal: chuẩn bị trạng thái đầu (ẩn theo state + opacity) --- */
      splitWords($("#h1"));
      const words = $$(".hero .w > span");
      gsap.set(words, { yPercent: 115, autoAlpha: 0 });
      gsap.set(".hero .hi", { autoAlpha: 0, y: 16 });
      gsap.set(".hline", { scaleX: 0, autoAlpha: 0 });
      const cue = $(".cue span");
      if (cue && touch) cue.textContent = "Vuốt lên, trang sẽ lật sang phải";

      /* Tiêu đề chạy từng từ (mask reveal ngang; blur nhẹ chỉ trên máy mạnh, không cảm ứng) */
      const useBlur = () => curTier === "high" && !touch;
      $$(".p:not(.hero) h2").forEach(h => {
        h.classList.remove("rv");
        splitWords(h);
        const ws = $$(".w > span", h);
        if (!ws.length) return;
        gsap.set(ws, useBlur() ? { xPercent: 105, autoAlpha: 0, filter: "blur(4px)" } : { xPercent: 105, autoAlpha: 0 });
        when(h, .85, () => {
          const to = { xPercent: 0, autoAlpha: 1, duration: dur, stagger: .08, ease: "power3.out" };
          if (useBlur()) { to.filter = "blur(0px)"; to.clearProps = "filter"; }
          else gsap.set(ws, { clearProps: "filter" });
          gsap.to(ws, to);
        });
      });

      /* Nội dung mỗi trang: thứ bậc theo thứ tự DOM (tiêu đề → đoạn → thành tích → số liệu) */
      pages.forEach(p => {
        const items = $$(".rv", p);
        if (!items.length) return;
        when(p, .82, () => {
          p.classList.add("on");
          gsap.fromTo(items, { autoAlpha: 0, x: 60 }, {
            autoAlpha: 1, x: 0, duration: dur, stagger: .11, ease: "power3.out",
            onComplete: () => gsap.set(items, { clearProps: "transform" })   /* thả transform → bớt layer GPU */
          });
        });
      });

      /* Đếm số: chạy một lần, không reset khi refresh */
      $$(".cnt").forEach(el => {
        const to = +el.dataset.to, o = { n: 0 };
        el.textContent = "0";
        when(el, .85, () => gsap.to(o, { n: to, duration: touch ? 1.1 : 1.6, delay: .3, ease: "power2.out", onUpdate: () => { el.textContent = Math.round(o.n); } }));
      });

      /* Gõ code */
      if (dom.code && codeFull) {
        dom.code.textContent = "";
        const typed = { n: 0 };
        let shown = -1;
        when(dom.code, .75, () => gsap.to(typed, {
          n: codeFull.length, duration: touch ? 1.4 : 2, ease: "none", delay: .4,
          onUpdate: () => { const n = Math.round(typed.n); if (n !== shown) { shown = n; dom.code.textContent = codeFull.slice(0, n) + "▍"; } },
          onComplete: () => { dom.code.textContent = codeFull; }
        }));
      }

      /* Trái tim */
      const NS = "http://www.w3.org/2000/svg";
      const burst = (n = touch ? 8 : 14) => run(() => {
        const th = dom.thanks, heart = dom.heart;
        if (dead || !th || !heart || th.querySelectorAll(".fl").length > 40) return;
        const hx = heart.getBoundingClientRect(), tr = th.getBoundingClientRect();
        for (let i = 0; i < n; i++) {
          const s = document.createElementNS(NS, "svg"), u = document.createElementNS(NS, "use");
          s.setAttribute("class", "ic fl"); s.setAttribute("aria-hidden", "true"); u.setAttribute("href", "#i-heart"); s.appendChild(u); th.appendChild(s);
          gsap.set(s, { x: hx.left - tr.left + 10, y: hx.top - tr.top + 10, scale: gsap.utils.random(.6, 1.6), opacity: 1 });
          gsap.to(s, { x: "+=" + gsap.utils.random(-110, 110), y: "-=" + gsap.utils.random(120, 280), rotate: gsap.utils.random(-40, 40),
            opacity: 0, duration: gsap.utils.random(1.6, 2.8), delay: i * .07, ease: "power2.out", onComplete: () => s.remove() });
        }
      });
      if (dom.heartBtn && dom.heart && dom.thanks) {
        when(dom.thanks, .6, () => gsap.delayedCall(1.1, () => burst()));
        B.on(dom.heartBtn, "click", () => burst(touch ? 6 : 10));
      }

      /* --- Đo trước khi tạo controller --- */
      ScrollTrigger.addEventListener("refreshInit", onInit);
      ScrollTrigger.addEventListener("refresh", onRefresh);
      measure();

      /* --- Controller ngang duy nhất: pin #world, cuộn dọc → track dịch ngang ---
         #world cao theo svh (ổn định) nên thanh địa chỉ iOS/Android ẩn/hiện không làm pin nhảy. */
      hs = gsap.to(track, {
        x: () => -D, ease: "none",
        scrollTrigger: {
          trigger: world, start: "top top", end: () => "+=" + Math.max(1, Math.round(D * (vw < 900 ? 1 : 1.15))),
          pin: true, pinSpacing: true,
          scrub: tier === "low" ? true : touch ? .15 : .3,             /* cảm ứng: gần như bám sát ngón tay; chuột: mượt nhẹ */
          snap: { snapTo, duration: { min: .25, max: .7 }, delay: .08, ease: "power2.out", inertia: false },
          fastScrollEnd: touch || innerWidth < 760,                    /* vuốt mạnh: chốt snap sớm, không trôi quá trang kế */
          invalidateOnRefresh: true,
          onUpdate: self => { dir = self.direction || dir; }
        },
        onUpdate() { tick(this.progress()); }
      });
      st = hs.scrollTrigger;
      onRefresh();

      /* --- Bàn phím & focus --- */
      const keepLeft = () => { if (world.scrollLeft) world.scrollLeft = 0; };
      B.on(world, "scroll", keepLeft, { passive: true });
      /* Tab tới phần tử ngoài màn hình → đưa đúng trang vào giữa viewport (qua ScrollTrigger, không phá pin) */
      B.on(track, "focusin", e => {
        const p = e.target.closest && e.target.closest(".p"), i = pages.indexOf(p);
        if (i < 0 || !D) return;
        keepLeft();
        const x = i === 0 ? 0 : clamp(0, D, lefts[i] + widths[i] / 2 - vw / 2);
        if (Math.abs(x - st.progress * D) < vw * .12) return;
        glideTo(scrollForX(x), .5);
      });
      /* ← → chuyển trang; Home/End/PageUp/PageDown dùng cuộn gốc (đã ánh xạ sang hành trình) */
      B.on(window, "keydown", e => {
        killGlide();
        if (!state.introComplete || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
        if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
        if (e.target.closest && e.target.closest(".codebox")) return;   /* codebox tự cuộn ngang */
        e.preventDefault();
        focusPage(clamp(0, pages.length - 1, current + (e.key === "ArrowRight" ? 1 : -1)));
      });

      /* --- Bánh xe / trackpad: chuẩn hóa + cuộn mượt. Bắt buộc { passive:false } vì cần preventDefault. ---
         Sự kiện nhỏ (trackpad) → đuổi theo rất nhanh (.18s) để giữ cảm giác 1:1; nấc lớn (chuột) → trượt êm (.6s). */
      B.on(window, "wheel", e => {
        if (e.ctrlKey || e.defaultPrevented || !state.introComplete) return;   /* ctrl+wheel = zoom của trình duyệt */
        const w = wheelInfo(e);
        if (!w.d) return;
        if (w.horiz && e.target.closest && e.target.closest(".codebox")) return;
        e.preventDefault();
        const px = clamp(-WHEEL_CAP, WHEEL_CAP, w.d);
        glideTo((glide ? wTarget : scrollY) + px, Math.abs(px) >= 50 ? .6 : .18, "power3.out");
      }, { passive: false });
      B.on(window, "pointerdown", killGlide, { passive: true });   /* kéo thanh cuộn / chạm: dừng ngay cuộn mượt */
      B.on(window, "touchstart", killGlide, { passive: true });
      B.add(killGlide);

      /* --- Hero intro: metadata → nét nhỏ → 2 dòng tiêu đề → phụ đề → tác giả → gợi ý cuộn --- */
      const finishIntro = () => {
        if (state.introComplete) return;
        state.introComplete = true;
        setPhase("HERO_READY");
        inputEvents.forEach(ev => removeEventListener(ev, skip));
        if (introTl) introTl.timeScale(1);
        root.classList.remove("lock");
        state.allowSectionReveal = true;                 /* chỉ tới đây section 2 mới được phép reveal */
        root.classList.add("rev");
        setPhase("SCROLL_ENABLED");
        ScrollTrigger.refresh();                         /* đo lại sau khi mở khóa cuộn (thanh cuộn desktop) */
        tick(hs.progress());
      };
      introTl = gsap.timeline({ paused: true, defaults: { ease: "power3.out" }, onComplete: finishIntro })
        .to(".kick", { autoAlpha: 1, y: 0, duration: .7 * ts })
        .to(".hline", { scaleX: 1, autoAlpha: 1, duration: .7 * ts, ease: "power2.inOut" }, "-=" + .45 * ts)
        .to(words, { yPercent: 0, autoAlpha: 1, duration: .95 * ts, stagger: .09 * ts }, "-=" + .3 * ts)
        .to(".sub", { autoAlpha: 1, y: 0, duration: .8 * ts }, "-=" + .45 * ts)
        .to(".by", { autoAlpha: 1, y: 0, duration: .8 * ts }, "-=" + .55 * ts)
        .to(".cue", { autoAlpha: 1, y: 0, duration: .8 * ts }, "-=" + .45 * ts);
      const startIntro = () => {
        state.loaderComplete = true;
        setPhase("HERO_INTRO");
        introTl.play(0);
      };

      /* --- Loader: điểm → nét → TV/TRẦN VINH → tiêu đề → 00…100 → nét quét → mở màn clip-path --- */
      const runLoader = () => {
        if (dead) return;
        if (!root.classList.contains("ld") || !dom.loader) { startIntro(); return; }
        root.classList.add("ldgo", "lock");
        setPhase("LOADER_READY");
        inputEvents.forEach(ev => addEventListener(ev, skip, { passive: true }));
        const L = s => $$(s, dom.loader), t = v => v * ts, counter = { n: 0 };
        loaderTl = gsap.timeline({ defaults: { ease: "power2.out" } })
          .fromTo(L(".ld-dot"), { scale: 0 }, { scale: 1, duration: t(.3) }, 0)
          .fromTo(L(".ld-v"), { scaleY: 0 }, { scaleY: 1, duration: t(.4), ease: "power2.inOut" }, t(.15))
          .fromTo(L(".ld-mono, .ld-name"), { autoAlpha: 0, y: 8 }, { autoAlpha: 1, y: 0, duration: t(.45), stagger: t(.12) }, t(.4))
          .fromTo(L(".ld-h"), { scaleX: 0 }, { scaleX: 1, duration: t(.5), ease: "power2.inOut" }, t(.55))
          .fromTo(L(".ld-title .l1 > span"), { yPercent: 115 }, { yPercent: 0, duration: t(.65) }, t(.7))
          .fromTo(L(".ld-title .l2 > span"), { yPercent: 115 }, { yPercent: 0, duration: t(.65) }, t(.82))
          .to(counter, {
            n: 100, duration: t(1.4), ease: "power1.inOut",
            onUpdate: () => {
              if (dom.num) dom.num.textContent = pad2(Math.round(counter.n));
              if (dom.fill) dom.fill.style.transform = "scaleX(" + counter.n / 100 + ")";
            }
          }, t(.15))
          .fromTo(L(".ld-sweep"), { xPercent: -100, autoAlpha: 1 }, { xPercent: 100, duration: t(.55), ease: "power2.inOut" }, t(1.25))
          .add(() => setPhase("LOADER_EXIT"), t(1.7))
          .to(L(".ld-core"), { y: -24, autoAlpha: 0, duration: t(.35), ease: "power2.in" }, t(1.7))
          .fromTo(dom.loader, { clipPath: "inset(0% 0% 0% 0%)" }, { clipPath: "inset(0% 0% 100% 0%)", duration: t(.6), ease: "power3.inOut" }, t(1.75))
          .add(() => { state.loaderComplete = true; root.classList.remove("ld"); startIntro(); }, t(2.35));
      };

      /* Cổng khởi động: chờ font (tối đa 900ms) → đo lại → loader. Không bao giờ kẹt vì có timeout. */
      Promise.race([document.fonts ? document.fonts.ready : 0, new Promise(r => setTimeout(r, 900))]).then(() => {
        if (dead) return;
        ScrollTrigger.refresh();
        run(runLoader);
      });

      /* Chốt an toàn: nếu chuỗi loader/intro không kết thúc sau 10s thì hoàn tất cưỡng bức, nội dung không bao giờ bị khóa */
      watchdog = gsap.delayedCall(10, () => {
        if (state.introComplete) return;
        safe(() => { if (loaderTl) loaderTl.kill(); if (introTl) introTl.kill(); });
        gsap.set([".hero .hi", ".hline", words], { autoAlpha: 1, y: 0, yPercent: 0, scaleX: 1 });
        state.loaderComplete = true;
        root.classList.remove("ld");
        finishIntro();
      });

      /* Font tải muộn → refresh có kiểm soát (gộp, debounce) */
      const soft = debounce(() => { if (!dead) ScrollTrigger.refresh(); }, 160);
      B.add(soft.cancel);
      if (document.fonts) { document.fonts.ready.then(soft); B.on(document.fonts, "loadingdone", soft); }

      /* Resize / xoay màn hình: chỉ refresh khi thay đổi đáng kể (thanh địa chỉ mobile không tính) */
      const onResize = debounce(() => {
        if (dead) return;
        const w = innerWidth, h = innerHeight, land = w > h;
        if (Math.abs(w - lastW) < 24 && Math.abs(h - lastH) < (touch ? 140 : 24) && land === lastLand) return;
        lastW = w; lastH = h; lastLand = land;
        ScrollTrigger.refresh();
      }, 220);
      B.add(onResize.cancel);
      B.on(window, "resize", onResize, { passive: true });
      B.on(window, "orientationchange", onResize, { passive: true });
      /* Quay lại từ bfcache (Safari/Firefox): đo lại để pin không lệch */
      B.on(window, "pageshow", e => { if (e.persisted) ScrollTrigger.refresh(); });

      tick(hs.progress());
      return cleanup;
    } catch (err) {
      console.error(err);
      cleanup();
      safe(() => ctx.revert());
      return staticMode();
    }
  };

  /* ---------- 10. Khởi động: GSAP từ CDN chính → CDN dự phòng → chế độ tĩnh ---------- */
  const ready = () => !!(window.gsap && window.ScrollTrigger);
  const loadScript = src => new Promise((ok, no) => {
    const s = document.createElement("script");
    s.src = src; s.onload = ok; s.onerror = no; document.head.appendChild(s);
  });
  const FALLBACK = [
    "https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.7/gsap.min.js",
    "https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.7/ScrollTrigger.min.js"
  ];
  const withGsap = () => ready() ? Promise.resolve(true) : Promise.race([
    FALLBACK.reduce((p, src) => p.then(() => loadScript(src)), Promise.resolve()).then(ready, () => false),
    new Promise(r => setTimeout(() => r(false), 3500))
  ]);

  const boot = () => {
    gsap.registerPlugin(ScrollTrigger);
    /* Không để ScrollTrigger tự refresh theo resize: ta tự xử lý (debounce + ngưỡng) để Safari mobile không giật */
    ScrollTrigger.config({ ignoreMobileResize: true, autoRefreshEvents: "visibilitychange,DOMContentLoaded,load" });
    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", ctx => motion(ctx));
    mm.add("(prefers-reduced-motion: reduce)", () => staticMode());
  };

  withGsap().then(ok => (ok ? boot() : staticMode())).catch(() => staticMode());
})();
