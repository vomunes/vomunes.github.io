/* Khi Tuổi Trẻ Còn Đang Viết — script.js
   Cuộn dọc → hành trình ngang (GSAP + ScrollTrigger), có fallback cuộn ngang gốc.

   Mục lục:
   1 DOM cache · 2 thiết bị & tier · 3 state · 4 liên hệ (toast/copy) · 5 chia section theo chiều cao
   6 trang/nhãn/tiến trình · 7 chế độ tĩnh (fallback) · 8 chế độ GSAP: đo đạc, controller ngang, focus,
   hero intro, loader, reveal, đếm số, gõ code, trái tim, bụi, resize, dọn dẹp · 9 khởi động */
(() => {
  "use strict";

  /* ---------- 1. DOM cache ---------- */
  const root = document.documentElement;
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const dom = {
    world: $("#world"), track: $("#track"), loader: $("#loader"),
    label: $("#label"), count: $("#count"), bar: $("#bar"), toast: $("#toast"),
    code: $("#codebox"), hero: $(".hero"), thanks: $(".thanks"), heart: $(".heart"),
    num: $("#ldNum"), fill: $("#ldFill")
  };
  const pages = $$(".p");
  const codeFull = dom.code ? dom.code.textContent : "";
  const noop = () => {};
  const pad2 = n => String(n).padStart(2, "0");
  const safe = fn => { try { return fn(); } catch (err) { console.warn("[ktt]", err); } };

  /* ---------- 2. Thiết bị & mức hiệu năng: high / mid / low ---------- */
  const touch = matchMedia("(pointer:coarse)").matches;
  const ios = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const tier = (() => {
    const cores = navigator.hardwareConcurrency || 4, mem = navigator.deviceMemory || 4, net = navigator.connection || {};
    if (net.saveData || /2g/.test(net.effectiveType || "") || mem <= 2 || (touch && !ios && cores <= 4)) return "low";
    return touch || cores <= 4 ? "mid" : "high";
  })();
  root.dataset.tier = tier;
  if (tier === "low") root.classList.add("lowfx");

  /* ---------- 3. State machine ----------
     LOADING → LOADER_READY → LOADER_EXIT → HERO_INTRO → HERO_READY → SCROLL_ENABLED
     Section sau Hero chỉ reveal khi allowSectionReveal === true (đặt duy nhất trong finishIntro). */
  const state = { phase: "LOADING", loaderComplete: false, introComplete: false, allowSectionReveal: false };
  const setPhase = p => { state.phase = p; root.dataset.phase = p; };
  const resetState = () => { state.loaderComplete = state.introComplete = state.allowSectionReveal = false; setPhase("LOADING"); };

  /* ---------- 4. Toast + sao chép (không phụ thuộc GSAP) ---------- */
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
      ta.style.cssText = "position:fixed;top:0;left:0;opacity:0;font-size:16px";
      document.body.appendChild(ta); ta.select(); ta.setSelectionRange(0, text.length);
      try { document.execCommand("copy"); } catch (e) { /* bỏ qua */ }
      ta.remove();
    }
    showToast(msg);
  }
  const phoneBtn = $("#phoneBtn"), mailBtn = $("#mailBtn");
  if (phoneBtn) phoneBtn.addEventListener("click", () => copy("0919951334", "Đã sao chép số điện thoại"));
  if (mailBtn) mailBtn.addEventListener("click", () => copy("vinhtrandangphuoc@gmail.com", "Đã sao chép email"));

  /* ---------- 5. Vừa chiều cao: không scale, chỉ giảm cỡ chữ/khoảng cách theo mức 0–3 ----------
     Section ngắn: căn giữa. Section dài: tăng mức thu gọn cho tới khi mọi section vừa viewport. */
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

  /* ---------- 6. Trang, nhãn chương, màu nền theo chương ---------- */
  const tones = [
    ["Mở đầu", "#dfeaf3", "#f5e6ea"], ["Lời mở", "#e8eef5", "#f3ebe3"],
    ["Chương I ·", "#e3edf5", "#e9f0e6"], ["Chương II ·", "#dbe6f2", "#f2e4e8"],
    ["Chương III ·", "#d8e4ee", "#e4e8f3"], ["Chương IV ·", "#f1e4e8", "#e3ecf4"],
    ["Nhìn về", "#e6eef5", "#f5e8e2"], ["Chương cuối", "#f6e6df", "#f2e1e7"], ["Cảm ơn", "#f7e8df", "#f3e2e6"]
  ];
  let current = -1;
  const setPage = (i, dur) => {
    if (i === current || !pages[i]) return;
    current = i;
    const name = pages[i].dataset.label || "";
    if (dom.label && name) dom.label.textContent = name;
    if (dom.count) dom.count.textContent = pad2(i + 1) + " / " + pad2(pages.length);
    const t = tones.find(t => name.startsWith(t[0]));
    if (!t) return;
    if (dur > 0 && window.gsap) gsap.to(root, { "--w1": t[1], "--w2": t[2], duration: dur, ease: "power2.out", overwrite: "auto" });
    else { root.style.setProperty("--w1", t[1]); root.style.setProperty("--w2", t[2]); }
  };

  /* ---------- 7. Chế độ tĩnh: reduced-motion hoặc GSAP không tải được ----------
     Hành trình ngang bằng cuộn ngang gốc (vuốt / bánh xe / thanh cuộn). Nội dung luôn hiển thị. */
  const staticMode = () => {
    root.classList.remove("ld", "ldgo", "lock", "fx", "rev");
    root.classList.add("static");
    setPhase("STATIC");
    state.loaderComplete = state.introComplete = state.allowSectionReveal = true;
    const world = dom.world;
    if (!world) return noop;
    let raf = 0, rt = 0, lastW = innerWidth, lastH = innerHeight;
    const update = () => {
      raf = 0;
      const max = Math.max(1, world.scrollWidth - world.clientWidth);
      let p = world.scrollLeft / max;
      if (p > .997) p = 1;
      const mid = world.scrollLeft + world.clientWidth * .6;
      let i = 0;
      while (i + 1 < pages.length && pages[i + 1].offsetLeft <= mid) i++;
      setPage(p === 1 ? pages.length - 1 : i, 0);
      if (dom.bar) dom.bar.style.transform = "scaleX(" + p + ")";
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update); };
    const onWheel = e => {
      if (e.ctrlKey || Math.abs(e.deltaY) <= Math.abs(e.deltaX) || world.scrollHeight > world.clientHeight + 1) return;
      world.scrollLeft += e.deltaY * (e.deltaMode === 1 ? 32 : 1);
      e.preventDefault();
    };
    const onResize = () => {
      clearTimeout(rt);
      rt = setTimeout(() => {
        if (Math.abs(innerWidth - lastW) < 24 && Math.abs(innerHeight - lastH) < (touch ? 140 : 24)) return;
        lastW = innerWidth; lastH = innerHeight; fitSections(); update();
      }, 220);
    };
    world.addEventListener("scroll", onScroll, { passive: true });
    world.addEventListener("wheel", onWheel, { passive: false });
    addEventListener("resize", onResize);
    addEventListener("orientationchange", onResize);
    fitSections();
    update();
    return () => {
      clearTimeout(rt); cancelAnimationFrame(raf);
      world.removeEventListener("scroll", onScroll);
      world.removeEventListener("wheel", onWheel);
      removeEventListener("resize", onResize);
      removeEventListener("orientationchange", onResize);
      root.classList.remove("static");
    };
  };

  /* ---------- 8. Chế độ đầy đủ: GSAP + ScrollTrigger ---------- */
  const motion = () => {
    const { world, track } = dom;
    if (!world || !track || !pages.length) return staticMode();

    const cleanups = [];
    const on = (t, ev, fn, o) => { t.addEventListener(ev, fn, o); cleanups.push(() => t.removeEventListener(ev, fn, o)); };
    let dead = false, hs = null, introTl = null, loaderTl = null, watchdog = null, rt = 0;
    const events = [];                                 /* mốc reveal chạy một lần */
    const inputEvents = ["wheel", "touchstart", "pointerdown", "keydown"];

    const ts = tier === "low" ? .6 : touch ? .75 : 1;               /* hệ số thời gian loader/intro */
    const toneDur = tier === "high" ? 1.6 : tier === "mid" ? 1 : 0; /* đổi màu nền theo chương */
    const dur = touch ? .85 : 1.1;
    const clamp01 = gsap.utils.clamp(0, 1);
    const heroI = pages.indexOf(dom.hero);

    /* Đo đạc có cache: chỉ đọc layout khi refresh, không đọc trong vòng lặp animation */
    let vw = root.clientWidth, D = 0, lefts = [], widths = [];
    const when = (el, f, fn) => events.push({ el, f, fn, at: 0, done: false });
    const measure = () => {
      fitSections();                                   /* có thể đổi layout → đo sau */
      vw = root.clientWidth;
      lefts = pages.map(p => p.offsetLeft);
      widths = pages.map(p => p.offsetWidth);
      const cs = getComputedStyle(track), padR = parseFloat(cs.paddingRight) || 0;
      const n = pages.length - 1, lastL = lefts[n], lastR = lastL + widths[n];
      /* Điểm cuối: section cuối được CĂN GIỮA, nhưng luôn đủ để cạnh phải + lề an toàn (safe-area, breathing room)
         nằm trọn trong viewport. Cạnh trái vào viewport vì width ≤ --inner (CSS). */
      D = Math.max(0, lastL + widths[n] / 2 - vw / 2, lastR + padR - vw);
      trackW = Math.max(1, track.scrollWidth);
      const tr = track.getBoundingClientRect().left;
      events.forEach(e => { e.at = e.el.getBoundingClientRect().left - tr; });
    };

    /* Parallax: một bộ điều khiển duy nhất thay cho hàng chục ScrollTrigger */
    const parallax = [];
    /* Parallax CÓ GIỚI HẠN: rings/orbs đung đưa quanh vị trí gốc (sin), bụi lặp tuần hoàn theo bề ngang màn hình.
       Nhờ vậy nền không bao giờ trôi hẳn ra ngoài và trang không trống dần về cuối. */
    const addPar = (sel, fn, d) => {
      const el = $(sel);
      if (el) parallax.push({ fn, to: d ? gsap.quickTo(el, "x", { duration: d, ease: "power3" }) : gsap.quickSetter(el, "x", "px") });
    };
    const sway = (f, a) => x => vw * a * Math.sin(x * f / vw * 1.6);
    const loop = f => x => -((x * f) % vw);
    const layers = [[".d1", .18, 2], [".d2", .4, 3], [".d3", .7, 5]];
    const counts = tier === "high" ? [7, 5, 3] : tier === "mid" ? (innerWidth < 768 ? [3, 2, 1] : [6, 4, 3]) : [0, 0, 0];
    const dustMoves = tier === "high";
    const nums = [], setBar = dom.bar ? gsap.quickSetter(dom.bar, "scaleX") : null;
    const inkEl = $(".ink"), setInk = inkEl ? gsap.quickSetter(inkEl, "scaleX") : null;
    let trackW = 1;
    const heroOp = dom.hero && gsap.quickSetter(dom.hero, "opacity"), heroX = dom.hero && gsap.quickSetter(dom.hero, "x", "px");
    let heroT = -1;

    /* Một hàm cập nhật duy nhất theo tiến trình p (0..1) */
    const tick = p => {
      const x = p * D;
      if (p > .997) p = 1;
      if (setBar) setBar(p);
      let i = 0;
      const mid = x + vw * .6;
      while (i + 1 < pages.length && lefts[i + 1] <= mid) i++;
      setPage(p === 1 ? pages.length - 1 : i, toneDur);
      /* Reveal chỉ khi: Hero đã xong VÀ người dùng thực sự đã cuộn (x > 0) */
      if (state.allowSectionReveal && x > 1) {
        for (const e of events) if (!e.done && e.at - x <= vw * e.f) { e.done = true; safe(e.fn); }
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

    /* Bụi: số lượng theo thiết bị (máy yếu: tắt hẳn) */
    let lastW = innerWidth, lastH = innerHeight, lastLand = innerWidth > innerHeight;
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
          d.style.cssText = `left:${x + c * vw}px;top:${y}vh;opacity:${o};` +
            (line ? `width:${z * 6}px;height:1px;transform:rotate(${rot}deg)` : `width:${z}px;height:${z}px;border-radius:50%`);
          fr.appendChild(d);
        }
      }
      g.appendChild(fr);
    });
    const hasDust = counts.some(Boolean);
    let dustW = innerWidth;
    const onInit = () => {
      measure();
      if (hasDust && Math.abs(innerWidth - dustW) > 50) { dustW = innerWidth; build(); }
    };

    /* Dọn dẹp toàn bộ (dùng cho lỗi, đổi chế độ, kết thúc) */
    const cleanup = () => {
      dead = true;
      clearTimeout(rt);
      inputEvents.forEach(ev => removeEventListener(ev, skip));
      cleanups.forEach(fn => safe(fn));
      safe(() => ScrollTrigger.removeEventListener("refreshInit", onInit));
      safe(() => { if (watchdog) watchdog.kill(); });
      safe(() => { if (loaderTl) loaderTl.kill(); if (introTl) introTl.kill(); });
      safe(() => { if (hs) { if (hs.scrollTrigger) hs.scrollTrigger.kill(true); hs.kill(); } });
      safe(() => gsap.set(".hi, .rv, .hero .w > span, .p h2 .w > span, .hline, .fl, .ld-core *, .ink", { clearProps: "all" }));
      safe(() => gsap.set([track, ".hero", "#loader"], { clearProps: "all" }));
      $$(".fl").forEach(n => n.remove());
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
      setPage(0, 0);

      /* Parallax layers */
      addPar(".rings", sway(.28, .05), touch ? .5 : .9);
      if (tier !== "low") [[".o1", .12, .06], [".o2", .5, .12], [".o3", .85, .1]].forEach(([s, f, a]) => addPar(s, sway(f, a), touch ? .7 : 1.1));
      if (dustMoves) layers.forEach(([s, f]) => addPar(s, loop(f), 0));
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

      /* Tiêu đề chạy từng từ (mask reveal ngang, blur nhẹ trên máy mạnh) */
      const blur = tier === "high";
      $$(".p:not(.hero) h2").forEach(h => {
        h.classList.remove("rv");
        splitWords(h);
        const ws = $$(".w > span", h);
        if (!ws.length) return;
        gsap.set(ws, blur ? { xPercent: 105, autoAlpha: 0, filter: "blur(4px)" } : { xPercent: 105, autoAlpha: 0 });
        const to = { xPercent: 0, autoAlpha: 1, duration: dur, stagger: .08, ease: "power3.out" };
        if (blur) { to.filter = "blur(0px)"; to.clearProps = "filter"; }
        when(h, .85, () => gsap.to(ws, to));
      });

      /* Nội dung mỗi trang: thứ bậc theo thứ tự DOM (tiêu đề → đoạn → thành tích → số liệu) */
      pages.forEach(p => {
        const items = $$(".rv", p);
        if (!items.length) return;
        when(p, .82, () => {
          p.classList.add("on");
          gsap.fromTo(items, { autoAlpha: 0, x: 60 }, { autoAlpha: 1, x: 0, duration: dur, stagger: .11, ease: "power3.out" });
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
      const burst = (n = touch ? 8 : 14) => {
        const th = dom.thanks, heart = dom.heart;
        if (!th || !heart || th.querySelectorAll(".fl").length > 40) return;
        const hx = heart.getBoundingClientRect(), tr = th.getBoundingClientRect();
        for (let i = 0; i < n; i++) {
          const s = document.createElementNS(NS, "svg"), u = document.createElementNS(NS, "use");
          s.setAttribute("class", "ic fl"); u.setAttribute("href", "#i-heart"); s.appendChild(u); th.appendChild(s);
          gsap.set(s, { x: hx.left - tr.left + 10, y: hx.top - tr.top + 10, scale: gsap.utils.random(.6, 1.6), opacity: 1 });
          gsap.to(s, { x: "+=" + gsap.utils.random(-110, 110), y: "-=" + gsap.utils.random(120, 280), rotate: gsap.utils.random(-40, 40),
            opacity: 0, duration: gsap.utils.random(1.6, 2.8), delay: i * .07, ease: "power2.out", onComplete: () => s.remove() });
        }
      };
      if (dom.heart && dom.thanks) {
        when(dom.thanks, .6, () => gsap.delayedCall(1.1, () => burst()));
        on(dom.heart, "click", () => burst(touch ? 6 : 10));
      }

      /* --- Đo trước khi tạo controller --- */
      ScrollTrigger.addEventListener("refreshInit", onInit);
      measure();

      /* --- Controller ngang duy nhất: pin #world, cuộn dọc → track dịch ngang --- */
      hs = gsap.to(track, {
        x: () => -D, ease: "none",
        scrollTrigger: {
          trigger: world, start: "top top", end: () => "+=" + Math.max(1, Math.round(D * (innerWidth < 900 ? 1 : 1.15))),
          pin: true, scrub: tier === "low" ? true : touch ? .3 : .9,
          anticipatePin: touch ? 0 : 1, fastScrollEnd: touch, invalidateOnRefresh: true
        },
        onUpdate() { tick(this.progress()); }
      });
      const st = hs.scrollTrigger;

      /* Bàn phím: Tab tới phần tử ngoài màn hình → đưa đúng trang vào giữa viewport */
      const keepLeft = () => { if (world.scrollLeft) world.scrollLeft = 0; };
      on(world, "scroll", keepLeft, { passive: true });
      on(track, "focusin", e => {
        const i = pages.indexOf(e.target.closest && e.target.closest(".p"));
        if (i < 0 || !D) return;
        keepLeft();
        const target = Math.min(D, Math.max(0, lefts[i] + widths[i] / 2 - vw / 2));
        if (Math.abs(target - st.progress * D) < vw * .12) return;
        scrollTo({ top: st.start + (target / D) * (st.end - st.start), behavior: "auto" });
      });

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

      /* --- Loader mới: điểm → nét → TV/TRẦN VINH → tiêu đề → 00…100 → nét quét → mở màn clip-path --- */
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
        runLoader();
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
      const soft = () => { clearTimeout(rt); rt = setTimeout(() => { if (!dead) ScrollTrigger.refresh(); }, 160); };
      if (document.fonts) { document.fonts.ready.then(soft); on(document.fonts, "loadingdone", soft); }

      /* Resize / xoay màn hình: chỉ refresh khi thay đổi đáng kể (thanh địa chỉ mobile không tính) */
      const onResize = () => {
        clearTimeout(rt);
        rt = setTimeout(() => {
          if (dead) return;
          const w = innerWidth, h = innerHeight, land = w > h;
          if (Math.abs(w - lastW) < 24 && Math.abs(h - lastH) < (touch ? 140 : 24) && land === lastLand) return;
          lastW = w; lastH = h; lastLand = land;
          ScrollTrigger.refresh();
        }, 220);
      };
      on(window, "resize", onResize);
      on(window, "orientationchange", onResize);

      tick(hs.progress());
      return cleanup;
    } catch (err) {
      console.error(err);
      cleanup();
      return staticMode();
    }
  };

  /* ---------- 9. Khởi động: GSAP từ CDN chính → CDN dự phòng → chế độ tĩnh ---------- */
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
    mm.add("(prefers-reduced-motion: no-preference)", motion);
    mm.add("(prefers-reduced-motion: reduce)", staticMode);
  };

  withGsap().then(ok => (ok ? boot() : staticMode())).catch(() => staticMode());
})();
