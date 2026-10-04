gsap.registerPlugin(ScrollTrigger);
ScrollTrigger.config({ ignoreMobileResize: true });
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

/* ===== Liên hệ (luôn hoạt động) ===== */
const toast = $("#toast");
function showToast(msg) {
  toast.querySelector("span").textContent = msg;
  gsap.killTweensOf(toast);
  gsap.timeline()
    .fromTo(toast, { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.35, ease: "power3.out" })
    .to(toast, { y: 20, opacity: 0, duration: 0.4, ease: "power2.in" }, "+=1.5");
}
async function copy(text, msg) {
  try { await navigator.clipboard.writeText(text); }
  catch {
    const ta = document.createElement("textarea");
    ta.value = text; ta.style.cssText = "position:fixed;opacity:0";
    document.body.appendChild(ta); ta.select(); document.execCommand("copy"); ta.remove();
  }
  showToast(msg);
}
$("#phoneBtn").addEventListener("click", () => copy("0919951334", "Đã sao chép số điện thoại"));
$("#mailBtn").addEventListener("click", () => copy("vinhtrandangphuoc@gmail.com", "Đã sao chép email"));
if (matchMedia("(hover:hover)").matches) $$(".icons a, .icons button").forEach(el => {
  el.addEventListener("pointerenter", () => gsap.to(el, { y: -4, duration: 0.3, ease: "power2.out", overwrite: true }));
  el.addEventListener("pointerleave", () => gsap.to(el, { y: 0, duration: 0.3, ease: "power2.out", overwrite: true }));
});

/* ===== Tách từ cho tiêu đề hero (giữ <br>, giữ nhãn cho trình đọc màn hình) ===== */
function splitWords(el) {
  el.setAttribute("aria-label", el.textContent.replace(/\s+/g, " ").trim());
  (function walk(n) {
    [...n.childNodes].forEach(c => {
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

const code = $("#codebox"), full = code.textContent;
const mm = gsap.matchMedia();

/* ===== Đầy đủ hiệu ứng: cuộn dọc → trang trôi ngang ===== */
mm.add("(prefers-reduced-motion: no-preference)", () => {
  try {
  document.documentElement.classList.add("fx");
  const track = $("#track"), ink = $("#ink"), bar = $("#bar");
  // Đo theo bố cục thật (offsetLeft/offsetWidth không tính transform, khác scrollWidth bị cộng phần đang lệch x:100).
  // Cuộn tới khi TRANG CUỐI nằm đúng giữa màn hình (không dồn sát trái, không chừa trống bên phải).
  const dist = () => {
    const last = track.lastElementChild;
    return Math.max(0, last.offsetLeft + last.offsetWidth / 2 - document.documentElement.clientWidth / 2);
  };
  const k = () => (innerWidth < 900 ? 1 : 1.15);        // màn nhỏ: cuộn dọc ngắn hơn cho dễ vuốt
  const len = () => "+=" + Math.round(dist() * k());
  // Nét mực chỉ "viết" một lần lúc mở trang, không vẽ lại theo từng khung hình cuộn → cuộn mượt
  const inkTw = ink ? gsap.fromTo(ink, { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 3.2, ease: "power2.inOut", paused: true })
                    : gsap.timeline({ paused: true });   // không có nét mực trong HTML thì bỏ qua
  const cue = $(".cue");
  if (cue && matchMedia("(pointer:coarse)").matches) cue.lastChild.textContent = "Vuốt lên, trang sẽ lật sang phải";

  // Chuyển động chính: ghim thế giới, kéo track sang trái theo cuộn dọc
  const hs = gsap.to(track, {
    x: () => -dist(), ease: "none",
    scrollTrigger: {
      trigger: "#world", start: "top top", end: len, pin: true, scrub: 1,
      anticipatePin: 1, invalidateOnRefresh: true,
      onUpdate: self => { bar.style.transform = `scaleX(${self.progress})`; }
    }
  });
  // Chữ nền trôi chậm hơn nội dung → tạo chiều sâu
  gsap.to(".rings", { x: () => -dist() * 0.28, ease: "none",
    scrollTrigger: { trigger: "#world", start: "top top", end: len, scrub: 1.4, invalidateOnRefresh: true } });

  // Mở màn: một khoảnh khắc duy nhất, có chủ đích
  splitWords($("#h1"));
  // ẩn hẳn (không chỉ đẩy lên) để không lộ đuôi chữ "g" của "Đang" qua mép che khi màn đang kéo
  gsap.set(".hero .w > span", { yPercent: -130, autoAlpha: 0 });
  gsap.set(".hi", { y: -28 });

  // Trang hiện tại: nhãn chương, số trang, tông nền đổi dần theo từng chương
  const root = document.documentElement, pages = $$(".p");
  const tones = [
    ["Mở đầu", "#dfeaf3", "#f5e6ea"], ["Lời mở", "#e8eef5", "#f3ebe3"],
    ["Chương I ·", "#e3edf5", "#e9f0e6"], ["Chương II ·", "#dbe6f2", "#f2e4e8"],
    ["Chương III ·", "#d8e4ee", "#e4e8f3"], ["Chương IV ·", "#f1e4e8", "#e3ecf4"],
    ["Nhìn về", "#e6eef5", "#f5e8e2"], ["Chương cuối", "#f4e3e8", "#dfe9f2"], ["Cảm ơn", "#f4e3e8", "#dfe9f2"]
  ];
  gsap.set(root, { "--w1": tones[0][1], "--w2": tones[0][2] });
  const setPage = p => {
    $("#label").textContent = p.dataset.label;
    $("#count").textContent = String(pages.indexOf(p) + 1).padStart(2, "0") + " / " + String(pages.length).padStart(2, "0");
    const t = tones.find(t => p.dataset.label.startsWith(t[0]));
    if (t) gsap.to(root, { "--w1": t[1], "--w2": t[2], duration: 1.6, ease: "power2.out", overwrite: "auto" });
  };
  setPage(pages[0]);

  // Phần mở đầu: các mục rơi xuống lần lượt từ trên xuống (chạy sau khi nền và các đường cong đã hiện)
  const intro = () => gsap.timeline({ defaults: { ease: "power3.out" } })
    .to(".kick", { opacity: 1, y: 0, duration: 0.8 })
    .to(".hero .w > span", { yPercent: 0, autoAlpha: 1, duration: 1, stagger: 0.08 }, "-=0.5")
    .to([".sub", ".by", ".cue"], { opacity: 1, y: 0, duration: 0.9, stagger: 0.15 }, "-=0.6")
    .add(() => inkTw.play(), 0.4);

  /* ===== Loader tự chạy: trang tựa như một tờ giấy → chữ hiện trên trang → nét mực chạy ngang
     → hai mép trang mở ra ở giữa → chỉ còn nền trơn → đường cong / hiệu ứng nền hiện dần → nội dung hiện dần ===== */
  // mỗi mục có 2 bản (nửa trái, nửa phải) nên luôn chọn cả hai và chạy đồng bộ
  const pgName = $$(".pg-name"), pgRuleT = $$(".pg-rule.t"), pgRuleB = $$(".pg-rule.b"),
        pgL1 = $$(".pg-title .l1 > span"), pgL2 = $$(".pg-title .l2 > span"),
        pgYear = $$(".pg-year"), pgInk = $$(".pg-ink path"), pgL = $(".pg-l"), pgR = $(".pg-r");
  let started = false;

  const startLoader = () => {
    if (started) return; started = true;
    if (!root.classList.contains("ld")) { intro(); return; }   // mạng chậm: loader đã bị gỡ, hiện nội dung ngay
    root.classList.add("ldgo");
    const HOLD = 0.53242;   // <<< CHỈNH Ở ĐÂY: số giây chờ sau khi chữ hiện hết rồi mới mở hai mép trang (nhỏ hơn = mở nhanh hơn)
    const rise = { yPercent: 130, autoAlpha: 0 };               // ẩn hẳn, không lộ đuôi chữ "g" của "Đang"
    gsap.timeline({ defaults: { ease: "power3.out" } })
      // 1) Tên
      .fromTo(pgName, { autoAlpha: 0, y: 10, letterSpacing: "0.7em" }, { autoAlpha: 1, y: 0, letterSpacing: "0.42em", duration: 1.1 }, 0.4)
      // 2) Đường kẻ trên → tiêu đề → đường kẻ dưới → năm
      .fromTo(pgRuleT, { scaleX: 0, autoAlpha: 0 }, { scaleX: 1, autoAlpha: 1, duration: 1, ease: "power2.inOut" }, "-=0.5")
      .fromTo(pgL1, rise, { yPercent: 0, autoAlpha: 1, duration: 1.1 }, "-=0.55")
      .fromTo(pgL2, rise, { yPercent: 0, autoAlpha: 1, duration: 1.1 }, "-=0.9")
      .fromTo(pgRuleB, { scaleX: 0, autoAlpha: 0 }, { scaleX: 1, autoAlpha: 1, duration: 1, ease: "power2.inOut" }, "-=0.6")
      .fromTo(pgYear, { autoAlpha: 0, y: 10 }, { autoAlpha: 1, y: 0, duration: 0.9 }, "-=0.5")
      // 3) Một đường mực chạy ngang qua trang, chạy trong lúc chờ và kết thúc đúng lúc trang bắt đầu mở
      .fromTo(pgInk, { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: HOLD + 0.2, ease: "power2.inOut" }, "-=0.2")
      // 4) Hai mép trang mở ra ở giữa; chữ và nét mực tách đôi theo từng nửa
      .fromTo([pgL, pgR], { "--sh": 0 }, { "--sh": 1, duration: 0.35, ease: "none" }, ">")
      .to(pgL, { xPercent: -100, duration: 1.5, ease: "power3.inOut" }, "<")
      .to(pgR, { xPercent: 100, duration: 1.5, ease: "power3.inOut" }, "<")
      // 5) Trang đã mở hoàn toàn: nền, các đường cong hiện dần, rồi nội dung hiện dần
      .add(() => { root.classList.remove("ld"); ScrollTrigger.refresh(); })
      .add(intro(), ">+1.1");
  };
  Promise.race([document.fonts.ready, new Promise(r => setTimeout(r, 1200))]).then(startLoader);

  // Tiêu đề: từng từ trồi lên khi trang tới (bỏ .rv để không bị tween hai lần)
  $$(".p:not(.hero) h2").forEach(h => {
    h.classList.remove("rv"); splitWords(h);
    const ws = h.querySelectorAll(".w > span");
    gsap.set(ws, { xPercent: 110, autoAlpha: 0 });
    gsap.to(ws, { xPercent: 0, autoAlpha: 1, duration: 1.1, stagger: 0.08, ease: "power3.out",
      scrollTrigger: { trigger: h, containerAnimation: hs, start: "left 85%", once: true } });
  });

  // Mỗi trang: nội dung trượt vào theo chiều ngang khi trang tiến tới; nhãn chương đổi theo trang
  $$(".p").forEach(p => {
    const items = p.querySelectorAll(".rv");
    if (items.length) gsap.fromTo(items, { opacity: 0, x: 100 }, {
      opacity: 1, x: 0, duration: 1.1, stagger: 0.13, ease: "power3.out",
      scrollTrigger: { trigger: p, containerAnimation: hs, start: "left 82%", once: true, onEnter: () => p.classList.add("on") }
    });
    ScrollTrigger.create({
      trigger: p, containerAnimation: hs, start: "left 60%", end: "right 60%",
      onToggle: s => { if (s.isActive) setPage(p); }
    });
  });

  // Bụi sáng nhiều tầng: tầng xa trôi chậm, tầng gần trôi nhanh (chỉ dùng transform nên rất nhẹ)
  const small = innerWidth < 760;
  const layers = [[".d1", 0.18, small ? 6 : 10, 2], [".d2", 0.4, small ? 4 : 7, 3], [".d3", 0.7, small ? 3 : 5, 5]];
  const build = () => layers.forEach(([s, f, n, r]) => {
    const g = $(s); g.textContent = "";
    for (let i = 0; i < n; i++) {
      const d = document.createElement("i"), z = r * (0.6 + Math.random() * 0.8);
      d.style.cssText = `left:${Math.random() * (innerWidth + dist() * f)}px;top:${6 + Math.random() * 88}vh;opacity:${0.25 + Math.random() * 0.35};` +
        (i % 2 ? `width:${z * 6}px;height:1px;transform:rotate(${Math.random() * 180}deg)` : `width:${z}px;height:${z}px;border-radius:50%`);
      g.appendChild(d);
    }
  });
  build(); ScrollTrigger.addEventListener("refreshInit", build);
  layers.forEach(([s, f]) => gsap.to(s, { x: () => -dist() * f, ease: "none",
    scrollTrigger: { trigger: "#world", start: "top top", end: len, scrub: 1.2, invalidateOnRefresh: true } }));

  // Chiều sâu: số lớp trôi ngược hướng, hero mờ dần khi rời đi, orb trôi ở các tốc độ khác nhau
  $$(".grade .num").forEach(n => gsap.fromTo(n, { x: 90 }, { x: -90, ease: "none",
    scrollTrigger: { trigger: n.parentElement, containerAnimation: hs, start: "left right", end: "right left", scrub: true } }));
  gsap.to(".hero", { opacity: 0.15, x: 80, ease: "none",
    scrollTrigger: { trigger: ".hero", containerAnimation: hs, start: "right 45%", end: "right 0%", scrub: true } });
  [[".o1", 0.12], [".o2", 0.5], [".o3", 0.85]].forEach(([s, f]) => gsap.to(s, { x: () => -dist() * f, ease: "none",
    scrollTrigger: { trigger: "#world", start: "top top", end: len, scrub: 1.6, invalidateOnRefresh: true } }));

  // Trang cuối: tim bay lên khi tới nơi, và mỗi lần chạm vào tim
  const th = $(".thanks"), heart = $(".heart"), NS = "http://www.w3.org/2000/svg";
  const burst = (n = 14) => {
    for (let i = 0; i < n; i++) {
      const s = document.createElementNS(NS, "svg"), u = document.createElementNS(NS, "use");
      s.setAttribute("class", "ic fl"); u.setAttribute("href", "#i-heart"); s.appendChild(u); th.appendChild(s);
      gsap.set(s, { x: heart.offsetLeft + 10, y: heart.offsetTop + 10, scale: gsap.utils.random(0.6, 1.6), opacity: 1 });
      gsap.to(s, { x: "+=" + gsap.utils.random(-110, 110), y: "-=" + gsap.utils.random(120, 280), rotate: gsap.utils.random(-40, 40),
        opacity: 0, duration: gsap.utils.random(1.6, 2.8), delay: i * 0.07, ease: "power2.out", onComplete: () => s.remove() });
    }
  };
  ScrollTrigger.create({ trigger: heart, containerAnimation: hs, start: "left 70%", once: true, onEnter: () => setTimeout(burst, 900) });
  heart.addEventListener("click", () => burst(10));

  // Con số đếm lên khi trang tới
  $$(".cnt").forEach(el => {
    const to = +el.dataset.to, o = { n: 0 };
    el.textContent = "0";
    ScrollTrigger.create({ trigger: el, containerAnimation: hs, start: "left 85%", once: true,
      onEnter: () => gsap.to(o, { n: to, duration: 1.6, delay: 0.3, ease: "power2.out", onUpdate: () => { el.textContent = Math.round(o.n); } }) });
  });

  // Gõ code khi trang Tin học tới gần
  code.textContent = "";
  const typed = { n: 0 }; let shown = -1;
  ScrollTrigger.create({
    trigger: code, containerAnimation: hs, start: "left 75%", once: true,
    onEnter: () => gsap.to(typed, { n: full.length, duration: 2.2, ease: "none", delay: 0.5,
      onUpdate: () => { const n = Math.round(typed.n); if (n !== shown) { shown = n; code.textContent = full.slice(0, n) + "▍"; } },
      onComplete: () => (code.textContent = full) })
  });

  return () => { document.documentElement.classList.remove("fx"); document.documentElement.classList.remove("ld"); };
  } catch (err) {
    // Có lỗi bất ngờ: bỏ lớp phủ + chế độ ghim để trang vẫn hiện và cuộn ngang được
    console.error(err);
    document.documentElement.classList.remove("fx", "ld");
    gsap.set([".hi", ".rv", ".hero .w > span", ".p h2 .w > span"], { clearProps: "all" });
  }
});

/* ===== Giảm chuyển động: không ghim, trang cuộn ngang tự nhiên bằng tay ===== */
mm.add("(prefers-reduced-motion: reduce)", () => { code.textContent = full; });

addEventListener("load", () => ScrollTrigger.refresh());
document.fonts && document.fonts.ready.then(() => ScrollTrigger.refresh());
