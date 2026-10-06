/* Portfolio · Trần Đặng Phước Vinh — script.js (ES2020) · PERFORMANCE-FIRST
   • Desktop (≥1024px + chuột + máy không yếu + không reduced-motion): cuộn dọc → ngang bằng GSAP + ScrollTrigger.
     GSAP chỉ được TẢI ĐỘNG ở chế độ này; mỗi lần vào/ra chế độ đều dọn sạch (không trùng trigger / listener).
   • Còn lại (điện thoại, tablet, máy yếu, reduced-motion, GSAP lỗi): cuộn ngang NATIVE + CSS Scroll Snap, không tải GSAP.
   • Không parallax, không hạt bụi, không đo FPS, không vòng lặp rAF liên tục. Mỗi frame cuộn chỉ cập nhật thanh tiến trình + nhãn trang.
   • Vòng lặp CSS (gợi ý cuộn, tim đập) chỉ chạy khi section đang nhìn thấy (.live) và tab đang mở (.paused).

   Mục lục: 1 DOM · 2 Tier · 3 Tiện ích · 4 Vừa chiều cao · 5 Trang/nhãn · 6 Reveal & hiệu ứng 1 lần
            7 Chế độ tĩnh · 8 Chế độ GSAP · 9 Khởi động */
(() => {
  "use strict";
  const root = document.documentElement;
  root.classList.add("booted");                       /* báo cho chốt an toàn trong <head> */

  /* ---------- 1. DOM ---------- */
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const noop = () => {};
  const pad2 = n => String(n).padStart(2, "0");
  const rand = (a, b) => a + Math.random() * (b - a);
  const safe = fn => { try { return fn(); } catch (err) { console.warn("[portfolio]", err); } };
  const dom = {
    world: $("#world"), track: $("#track"), loader: $("#loader"),
    label: $("#label"), count: $("#count"), bar: $("#bar"), toast: $("#toast"),
    code: $("#codebox"), hero: $(".hero"), thanks: $(".thanks"), heart: $(".heart"),
    num: $("#ldNum"), fill: $("#ldFill")
  };
  const pages = $$(".p");
  const codeFull = dom.code ? dom.code.textContent : "";
  const hasIO = "IntersectionObserver" in window;
  const reduceMq = matchMedia("(prefers-reduced-motion: reduce)");
  const desktopMq = matchMedia("(min-width: 1024px) and (hover: hover) and (pointer: fine)");
  const touch = matchMedia("(pointer:coarse)").matches;
  const touchDev = navigator.maxTouchPoints > 1 && !/Windows NT/.test(navigator.userAgent);   /* điện thoại, tablet, iPad desktop-class */
  const behavior = () => (reduceMq.matches ? "auto" : "smooth");

  /* Tab ẩn → dừng mọi animation CSS đang lặp (CSS: html.paused) */
  document.addEventListener("visibilitychange", () => root.classList.toggle("paused", document.hidden), { passive: true });

  /* ---------- 2. Phân cấp thiết bị (đọc thuộc tính, KHÔNG benchmark) ----------
     low: reduced-motion, saveData, 2G, RAM < 3GB, ≤ 2 nhân  → luôn chế độ tĩnh, không loader, không trang trí
     high: desktop ≥ 8 nhân (và RAM ≥ 8GB nếu trình duyệt báo)  ·  mid: mọi trường hợp còn lại / không xác định */
  const conn = navigator.connection || {};
  const detectTier = () => {
    const cores = navigator.hardwareConcurrency, mem = navigator.deviceMemory;
    if (reduceMq.matches || conn.saveData || /(^|-)2g$/.test(conn.effectiveType || "")) return "low";
    if ((mem && mem < 3) || (cores && cores <= 2)) return "low";
    if (!touch && cores >= 8 && (mem == null || mem >= 8)) return "high";
    return "mid";
  };
  let tier = "mid";
  const applyTier = () => {
    tier = detectTier();
    root.dataset.tier = tier;
    root.classList.toggle("lowfx", tier === "low");
  };
  const wantMotion = () => desktopMq.matches && !touchDev && !reduceMq.matches && tier !== "low";
  /* Reveal / đếm số / gõ code chỉ dành cho desktop thật. Mọi thiết bị khác: nội dung hiện đủ ngay từ đầu. */
  const revealOK = () => hasIO && !reduceMq.matches && !touchDev && desktopMq.matches && tier !== "low";

  /* ---------- 3. Tiện ích: state, toast, sao chép, ripple, tim, phím ---------- */
  const state = { phase: "LOADING", loaderDone: false };
  const setPhase = p => { state.phase = p; root.dataset.phase = p; };

  let toastTimer = 0;
  const showToast = msg => {
    if (!dom.toast) return;
    $("span", dom.toast).textContent = msg;
    dom.toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => dom.toast.classList.remove("show"), 1900);
  };
  const copy = async (text, msg) => {
    try { await navigator.clipboard.writeText(text); }
    catch (e) {
      const ta = document.createElement("textarea");
      ta.value = text; ta.setAttribute("readonly", "");
      ta.style.cssText = "position:fixed;top:0;left:0;opacity:0;font-size:16px";
      document.body.appendChild(ta); ta.select(); ta.setSelectionRange(0, text.length);
      try { document.execCommand("copy"); } catch (e) { /* bỏ qua */ }
      ta.remove();
    }
    showToast(msg);
  };

  /* Ripple ở pointerdown (phản hồi tức thì), tự xóa sau 0.7s, tối đa 3 node cùng lúc */
  const ripple = () => $$(".icons a, .icons button").forEach(el => el.addEventListener("pointerdown", e => {
    if (reduceMq.matches || el.querySelectorAll(".rp").length > 2) return;
    const r = el.getBoundingClientRect(), s = document.createElement("span");
    s.className = "rp";
    s.style.left = (e.clientX - r.left) + "px";
    s.style.top = (e.clientY - r.top) + "px";
    el.appendChild(s);
    setTimeout(() => s.remove(), 700);
  }, { passive: true }));

  /* Tim bay: chỉ khi người dùng bấm, tối đa 8 node, Web Animations API (compositor), tắt ở máy yếu / reduced-motion */
  const NS = "http://www.w3.org/2000/svg";
  const burst = () => {
    const th = dom.thanks, h = dom.heart;
    if (!th || !h || reduceMq.matches || tier === "low" || th.querySelectorAll(".fl").length > 12) return;
    const hr = h.getBoundingClientRect(), tr = th.getBoundingClientRect();
    const x0 = hr.left - tr.left + hr.width / 2 - 7, y0 = hr.top - tr.top + hr.height / 2 - 7;
    for (let i = 0; i < (touch ? 5 : 8); i++) {
      const s = document.createElementNS(NS, "svg"), u = document.createElementNS(NS, "use");
      s.setAttribute("class", "ic fl"); u.setAttribute("href", "#i-heart"); s.appendChild(u); th.appendChild(s);
      if (!s.animate) { s.remove(); return; }
      const sc = rand(.7, 1.5), dx = rand(-100, 100), dy = -rand(120, 240);
      s.animate([
        { transform: `translate(${x0}px,${y0}px) scale(${sc})`, opacity: 1 },
        { transform: `translate(${x0 + dx}px,${y0 + dy}px) scale(${sc})`, opacity: 0 }
      ], { duration: rand(1400, 2200), delay: i * 60, easing: "ease-out", fill: "both" }).onfinish = () => s.remove();
    }
  };

  const initCommon = () => {
    const on = (el, fn) => { if (el) el.addEventListener("click", fn); };
    on($("#phoneBtn"), () => copy("0919951334", "Đã sao chép số điện thoại"));
    on($("#mailBtn"), () => copy("vinhtrandangphuoc@gmail.com", "Đã sao chép email"));
    on(dom.heart, burst);
    ripple();
  };

  /* Phím ← → Home End dùng chung hai chế độ: go(1 | -1 | "home" | "end") */
  const keyNav = go => {
    const fn = e => {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || !state.loaderDone) return;
      if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
      const k = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : e.key === "Home" ? "home" : e.key === "End" ? "end" : 0;
      if (!k) return;
      e.preventDefault();
      go(k);
    };
    addEventListener("keydown", fn);
    return () => removeEventListener("keydown", fn);
  };

  /* ---------- 4. Vừa chiều cao: giảm cỡ chữ/khoảng cách theo mức 0–3 (chỉ chạy khi khởi tạo / đổi kích thước) ---------- */
  const fitSections = () => {
    const H = dom.world ? dom.world.clientHeight : 0;
    if (!H) return;
    let lvl = 0;
    for (; lvl <= 3; lvl++) {
      root.dataset.fit = String(lvl);
      if (!pages.some(p => p.offsetHeight > H + 1)) break;
    }
    if (lvl > 3) root.dataset.fit = "3";
  };

  /* ---------- 5. Trang & nhãn. Màu nền đổi tức thì (không tween biến CSS), chỉ ở chế độ GSAP ---------- */
  const tones = [
    ["Hành trình", "#dfeaf3", "#f5e6ea"], ["Giới thiệu", "#e8eef5", "#f3ebe3"],
    ["01 ·", "#e3edf5", "#e9f0e6"], ["02 ·", "#dbe6f2", "#f2e4e8"],
    ["03 ·", "#d8e4ee", "#e4e8f3"], ["04 ·", "#f1e4e8", "#e3ecf4"],
    ["Phía trước", "#e6eef5", "#f5e8e2"], ["05 ·", "#f6e6df", "#f2e1e7"], ["Cảm ơn", "#f7e8df", "#f3e2e6"]
  ];
  let current = -1;
  const setPage = (i, withTone) => {
    if (i === current || !pages[i]) return;            /* chỉ ghi DOM khi trang đổi */
    current = i;
    const name = pages[i].dataset.label || "";
    if (dom.label && name) dom.label.textContent = name;
    if (dom.count) dom.count.textContent = pad2(i + 1) + " / " + pad2(pages.length);
    const t = withTone && tones.find(x => name.startsWith(x[0]));
    if (t) { root.style.setProperty("--w1", t[1]); root.style.setProperty("--w2", t[2]); }
  };

  /* ---------- 6. Reveal chữ + hiệu ứng một lần (CSS + IntersectionObserver) ---------- */
  const initReveal = rootEl => {
    if (!revealOK()) { root.classList.remove("rvon"); return noop; }
    root.classList.add("rvon");
    pages.forEach(p => $$(".rv", p).forEach((e, i) => e.style.setProperty("--i", Math.min(i, 5))));
    const io = new IntersectionObserver(entries => entries.forEach(en => {
      if (!en.isIntersecting) return;
      en.target.classList.add("in");
      io.unobserve(en.target);                         /* chạy một lần rồi thôi theo dõi */
    }), { root: rootEl, threshold: .12, rootMargin: "0px -4% 0px 0px" });
    $$(".rv:not(.in)").forEach(e => io.observe(e));
    return () => io.disconnect();
  };

  /* Vòng lặp CSS chỉ chạy khi section nhìn thấy: IO bật/tắt class .live */
  const initLive = rootEl => {
    const els = $$(".live-watch");
    if (!hasIO) { els.forEach(e => e.classList.add("live")); return noop; }
    const io = new IntersectionObserver(es => es.forEach(en => en.target.classList.toggle("live", en.isIntersecting)), { root: rootEl });
    els.forEach(e => io.observe(e));
    return () => io.disconnect();
  };

  /* rAF hủy được; chỉ cập nhật DOM khi giá trị thực sự đổi */
  const animate = (ms, step, done) => {
    let id = 0, t0 = 0;
    const frame = t => {
      if (!t0) t0 = t;
      const p = Math.min(1, (t - t0) / ms);
      step(p);
      if (p < 1) id = requestAnimationFrame(frame); else if (done) done();
    };
    id = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(id);
  };

  /* Đếm số + gõ code: mỗi hiệu ứng chạy ĐÚNG MỘT LẦN khi vào khung nhìn; máy yếu / reduced-motion / không có IO → hiện kết quả ngay */
  const initEffects = rootEl => {
    const stops = [], observers = [];
    const fast = !revealOK();
    const canAnimate = () => !reduceMq.matches && tier !== "low";
    const watch = (el, fn, th) => {
      const io = new IntersectionObserver((es, o) => es.forEach(en => { if (en.isIntersecting) { o.disconnect(); fn(); } }), { root: rootEl, threshold: th });
      io.observe(el); observers.push(io);
    };

    $$(".cnt").forEach(el => {
      const to = +el.dataset.to || 0;
      if (el.dataset.done) return;
      if (fast) { el.textContent = to; el.dataset.done = "1"; return; }
      el.textContent = "0";
      watch(el, () => {
        el.dataset.done = "1";
        if (!canAnimate()) { el.textContent = to; return; }
        let shown = -1;
        stops.push(animate(1200, p => {
          const n = Math.round(to * (1 - Math.pow(1 - p, 3)));
          if (n !== shown) { shown = n; el.textContent = n; }
        }, () => { el.textContent = to; }));
      }, .4);
    });

    if (dom.code && codeFull && !dom.code.dataset.done) {
      if (fast) dom.code.dataset.done = "1";
      else {
        dom.code.textContent = "";
        watch(dom.code, () => {
          dom.code.dataset.done = "1";
          if (!canAnimate()) { dom.code.textContent = codeFull; return; }
          let shown = -1;
          stops.push(animate(Math.min(2000, codeFull.length * 55), p => {
            const n = Math.round(codeFull.length * p);
            if (n !== shown) { shown = n; dom.code.textContent = codeFull.slice(0, n) + (n < codeFull.length ? "▍" : ""); }
          }, () => { dom.code.textContent = codeFull; }));
        }, .5);
      }
    }

    return () => {                                      /* dọn: hủy rAF + observer, đưa nội dung dở dang về trạng thái cuối */
      stops.forEach(fn => fn());
      observers.forEach(io => io.disconnect());
      $$(".cnt").forEach(el => { el.textContent = el.dataset.to; el.dataset.done = "1"; });
      if (dom.code && codeFull) { dom.code.textContent = codeFull; dom.code.dataset.done = "1"; }
    };
  };

  /* ---------- 7. Chế độ tĩnh: cuộn ngang native + CSS Scroll Snap (không GSAP) ---------- */
  const staticMode = () => {
    root.classList.remove("ld", "ldgo", "lock", "fx", "rev");
    root.classList.add("static", "hero-go");
    setPhase("STATIC");
    state.loaderDone = true;
    const world = dom.world;
    if (!world) return noop;
    const cue = $(".cue span");
    if (cue && touch) cue.textContent = "Vuốt sang phải để khám phá";

    /* Layout được đo MỘT LẦN (và khi đổi kích thước), không đọc layout trong sự kiện scroll */
    let lefts = [], cw = 1, maxX = 1, raf = 0, rt = 0, lastW = innerWidth, lastH = innerHeight;
    const measure = () => {
      fitSections();
      lefts = pages.map(p => p.offsetLeft);
      cw = world.clientWidth;
      maxX = Math.max(1, world.scrollWidth - cw);
    };
    const thanks = $$(".thanks .rv");
    const update = () => {
      raf = 0;
      let p = world.scrollLeft / maxX;
      if (p > .997) p = 1;
      const mid = world.scrollLeft + cw * .6;
      let i = 0;
      while (i + 1 < lefts.length && lefts[i + 1] <= mid) i++;
      setPage(p === 1 ? pages.length - 1 : i, false);
      if (dom.bar) dom.bar.style.transform = "scaleX(" + p + ")";
      if (p === 1) thanks.forEach(e => e.classList.add("in"));   /* chạm đáy: màn cuối luôn hiện đủ */
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update); };
    /* Bánh xe dọc → cuộn ngang: chỉ gắn khi có chuột (touch không bị listener non-passive làm chậm) */
    const hasMouse = matchMedia("(hover: hover)").matches;
    const onWheel = e => {
      if (e.ctrlKey || Math.abs(e.deltaY) <= Math.abs(e.deltaX) || world.scrollHeight > world.clientHeight + 1) return;
      world.scrollLeft += e.deltaY * (e.deltaMode === 1 ? 32 : 1);
      e.preventDefault();
    };
    const onResize = () => {
      clearTimeout(rt);
      rt = setTimeout(() => {
        if (Math.abs(innerWidth - lastW) < 24 && Math.abs(innerHeight - lastH) < (touch ? 140 : 24)) return;
        lastW = innerWidth; lastH = innerHeight; measure(); update();
      }, 220);
    };
    world.addEventListener("scroll", onScroll, { passive: true });
    if (hasMouse) world.addEventListener("wheel", onWheel, { passive: false });
    addEventListener("resize", onResize, { passive: true });
    const offKeys = keyNav(k => {
      if (k === "home") world.scrollTo({ left: 0, behavior: behavior() });
      else if (k === "end") world.scrollTo({ left: world.scrollWidth, behavior: behavior() });
      else world.scrollBy({ left: k * cw * .7, behavior: behavior() });
    });

    measure();
    const offReveal = initReveal(world), offLive = initLive(world), offFx = initEffects(world);
    update();
    return () => {
      clearTimeout(rt); cancelAnimationFrame(raf);
      offKeys(); offReveal(); offLive(); offFx();
      world.removeEventListener("scroll", onScroll);
      world.removeEventListener("wheel", onWheel);
      removeEventListener("resize", onResize);
      root.classList.remove("static");
    };
  };

  /* ---------- 8. Chế độ GSAP (desktop): pin #world, cuộn dọc → track dịch ngang ----------
     MỘT ScrollTrigger duy nhất. Mỗi frame chỉ: thanh tiến trình (scaleX) + nhãn trang khi đổi. */
  const motion = () => {
    const { world, track } = dom;
    if (!world || !track || !pages.length) return staticMode();

    const cleanups = [];
    const on = (t, ev, fn, o) => { t.addEventListener(ev, fn, o); cleanups.push(() => t.removeEventListener(ev, fn, o)); };
    let dead = false, hs = null, loaderTl = null, guard = 0, rt = 0, offReveal = noop, offLive = noop, offFx = noop;
    const inputEvents = ["wheel", "touchstart", "pointerdown", "keydown"];
    const ts = tier === "high" ? 1 : .8;               /* loader ngắn hơn trên máy tầm trung */
    const toneOn = tier === "high";
    const setBar = dom.bar ? gsap.quickSetter(dom.bar, "scaleX") : null;

    /* Đo đạc có cache: chỉ đọc layout khi ScrollTrigger refresh */
    let vw = root.clientWidth, D = 0, lefts = [], widths = [];
    const measure = () => {
      fitSections();
      vw = root.clientWidth;
      lefts = pages.map(p => p.offsetLeft);
      widths = pages.map(p => p.offsetWidth);
      const padR = parseFloat(getComputedStyle(track).paddingRight) || 0, n = pages.length - 1;
      D = Math.max(0, lefts[n] + widths[n] / 2 - vw / 2, lefts[n] + widths[n] + padR - vw);   /* section cuối nằm trọn viewport */
    };
    const tick = p => {
      if (p > .997) p = 1;
      if (setBar) setBar(p);
      const mid = p * D + vw * .6;
      let i = 0;
      while (i + 1 < pages.length && lefts[i + 1] <= mid) i++;
      setPage(p === 1 ? pages.length - 1 : i, toneOn);
    };

    const cleanup = () => {
      dead = true;
      clearTimeout(rt); clearTimeout(guard);
      inputEvents.forEach(ev => removeEventListener(ev, skip));
      cleanups.forEach(fn => safe(fn));
      offReveal(); offLive(); offFx();
      safe(() => ScrollTrigger.removeEventListener("refreshInit", measure));
      safe(() => { if (loaderTl) loaderTl.kill(); });
      safe(() => { if (hs) { if (hs.scrollTrigger) hs.scrollTrigger.kill(true); hs.kill(); } });
      safe(() => gsap.set([track, "#loader", ".ld-core *"], { clearProps: "all" }));
      $$(".fl").forEach(n => n.remove());
      root.classList.remove("fx", "ld", "ldgo", "lock", "rev");
    };
    function skip() { if (!state.loaderDone && loaderTl) loaderTl.timeScale(3); }

    try {
      state.loaderDone = false;
      setPhase("LOADING");
      root.classList.add("fx");
      setPage(0, false);
      ScrollTrigger.addEventListener("refreshInit", measure);
      measure();

      hs = gsap.to(track, {
        x: () => -D, ease: "none",
        scrollTrigger: {
          trigger: world, start: "top top", end: () => "+=" + Math.max(1, Math.round(D * (innerWidth < 900 ? 1 : 1.15))),
          pin: true, scrub: tier === "high" ? .4 : .25, anticipatePin: 1, invalidateOnRefresh: true
        },
        onUpdate() { tick(this.progress()); }
      });
      const st = hs.scrollTrigger;

      /* Phím ← → Home End → cuộn dọc tương ứng */
      cleanups.push(keyNav(k => {
        if (!D) return;
        const range = st.end - st.start;
        if (k === "home") scrollTo({ top: st.start, behavior: behavior() });
        else if (k === "end") scrollTo({ top: st.end, behavior: behavior() });
        else scrollBy({ top: k * (vw * .7 / D) * range, behavior: behavior() });
      }));

      /* Tab tới phần tử ngoài màn hình → đưa đúng trang vào giữa viewport */
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

      /* Kết thúc loader (đúng 1 lần; gọi bởi timeline HOẶC chốt an toàn) */
      const finishLoader = () => {
        if (state.loaderDone) return;
        state.loaderDone = true;
        clearTimeout(guard);
        inputEvents.forEach(ev => removeEventListener(ev, skip));
        root.classList.remove("ld", "lock");
        root.classList.add("rev", "hero-go");
        setPhase("READY");
        safe(() => ScrollTrigger.refresh());
        tick(hs.progress());
        offReveal = initReveal(null);                  /* root = viewport: track bị transform vẫn được quan sát đúng */
        offLive = initLive(null);
        offFx = initEffects(null);
      };

      /* Loader ngắn (~1.6s), chỉ transform/opacity, mở màn bằng fade (không animate clip-path) */
      const runLoader = () => {
        if (dead) return;
        if (!root.classList.contains("ld") || !dom.loader) { finishLoader(); return; }
        root.classList.add("ldgo", "lock");
        setPhase("LOADER");
        inputEvents.forEach(ev => addEventListener(ev, skip, { passive: true }));
        const L = s => $$(s, dom.loader), t = v => v * ts, counter = { n: 0 };
        loaderTl = gsap.timeline({ defaults: { ease: "power2.out" } })
          .fromTo(L(".ld-dot"), { scale: 0 }, { scale: 1, duration: t(.25) }, 0)
          .fromTo(L(".ld-v"), { scaleY: 0 }, { scaleY: 1, duration: t(.3), ease: "power2.inOut" }, t(.1))
          .fromTo(L(".ld-mono, .ld-name"), { autoAlpha: 0, y: 8 }, { autoAlpha: 1, y: 0, duration: t(.35), stagger: t(.1) }, t(.3))
          .fromTo(L(".ld-h"), { scaleX: 0 }, { scaleX: 1, duration: t(.4), ease: "power2.inOut" }, t(.4))
          .fromTo(L(".ld-title .l1 > span"), { yPercent: 115 }, { yPercent: 0, duration: t(.5) }, t(.5))
          .fromTo(L(".ld-title .l2 > span"), { yPercent: 115 }, { yPercent: 0, duration: t(.5) }, t(.6))
          .to(counter, {
            n: 100, duration: t(1), ease: "power1.inOut",
            onUpdate: () => {
              const n = Math.round(counter.n);
              if (dom.num && dom.num.textContent !== pad2(n)) dom.num.textContent = pad2(n);
              if (dom.fill) dom.fill.style.transform = "scaleX(" + counter.n / 100 + ")";
            }
          }, t(.1))
          .to(dom.loader, { autoAlpha: 0, duration: t(.4), ease: "power1.in" }, t(1.2))
          .add(() => root.classList.add("hero-go"), t(1.3))
          .add(finishLoader, t(1.6));
      };

      /* Cổng khởi động: chờ font tối đa 900ms → đo lại → loader */
      Promise.race([document.fonts ? document.fonts.ready : 0, new Promise(r => setTimeout(r, 900))]).then(() => {
        if (dead) return;
        ScrollTrigger.refresh();
        runLoader();
      });
      /* Chốt an toàn bằng setTimeout thuần (không phụ thuộc ticker GSAP): sau 6s luôn mở khóa nội dung */
      guard = setTimeout(() => {
        if (state.loaderDone) return;
        safe(() => { if (loaderTl) loaderTl.kill(); });
        finishLoader();
      }, 6000);

      /* Font tải muộn / đổi kích thước → refresh gộp (debounce), chỉ khi thay đổi đáng kể */
      const soft = () => { clearTimeout(rt); rt = setTimeout(() => { if (!dead) ScrollTrigger.refresh(); }, 160); };
      if (document.fonts) { document.fonts.ready.then(soft); on(document.fonts, "loadingdone", soft); }
      let lastW = innerWidth, lastH = innerHeight;
      on(window, "resize", () => {
        clearTimeout(rt);
        rt = setTimeout(() => {
          if (dead || (Math.abs(innerWidth - lastW) < 24 && Math.abs(innerHeight - lastH) < 24)) return;
          lastW = innerWidth; lastH = innerHeight;
          ScrollTrigger.refresh();
        }, 220);
      }, { passive: true });

      tick(hs.progress());
      return cleanup;
    } catch (err) {
      console.error(err);
      cleanup();
      return staticMode();
    }
  };

  /* ---------- 9. Khởi động ----------
     Một bộ điều khiển duy nhất: mỗi lần điều kiện đổi (breakpoint / reduced-motion) → dọn chế độ cũ rồi dựng chế độ mới.
     GSAP chỉ được tải khi chế độ desktop thực sự cần; lỗi / quá 4s → chế độ tĩnh. */
  const ready = () => !!(window.gsap && window.ScrollTrigger);
  const loadScript = src => new Promise((ok, no) => {
    const s = document.createElement("script");
    s.src = src; s.async = true; s.onload = ok; s.onerror = no; document.head.appendChild(s);
  });
  const SRC = ["https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.7/gsap.min.js", "https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.7/ScrollTrigger.min.js"];
  const ALT = ["https://cdn.jsdelivr.net/npm/gsap@3.12.7/dist/gsap.min.js", "https://cdn.jsdelivr.net/npm/gsap@3.12.7/dist/ScrollTrigger.min.js"];
  const chain = list => list.reduce((p, s) => p.then(() => loadScript(s)), Promise.resolve());
  let gsapP = null, registered = false;
  const withGsap = () => gsapP || (gsapP = (ready() ? Promise.resolve(true) : Promise.race([
    chain(SRC).catch(() => chain(ALT)).then(ready, () => false),
    new Promise(r => setTimeout(() => r(false), 4000))
  ])).then(ok => { if (!ok) gsapP = null; return ok; }));

  let off = noop, token = 0;
  const start = async () => {
    const my = ++token;
    off(); off = noop;
    applyTier();
    if (wantMotion()) {
      const ok = await withGsap();
      if (my !== token) return;                        /* điều kiện đã đổi trong lúc chờ tải */
      if (ok) {
        if (!registered) {
          gsap.registerPlugin(ScrollTrigger);
          ScrollTrigger.config({ ignoreMobileResize: true, autoRefreshEvents: "visibilitychange,DOMContentLoaded,load" });
          registered = true;
        }
        off = motion();
        return;
      }
    }
    off = staticMode();
  };

  initCommon();
  start().catch(() => { off(); off = staticMode(); });
  const listen = (mq, fn) => { if (mq.addEventListener) mq.addEventListener("change", fn); else if (mq.addListener) mq.addListener(fn); };
  listen(desktopMq, start);
  listen(reduceMq, start);
})();
