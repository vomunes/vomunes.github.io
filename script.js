gsap.registerPlugin(ScrollTrigger);
ScrollTrigger.config({ ignoreMobileResize: true }); // thanh địa chỉ điện thoại co giãn không làm giật trang ghim
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

/* ===== Khối morph: 8 bán kính → đường cong; chỉ vẽ lại khi cần ===== */
const K = 8, path = $("#shape"), ring = $("#ring");
const SHAPES = [
  [150, 128, 160, 135, 150, 118, 158, 130], [128, 160, 125, 150, 135, 165, 120, 148],
  [165, 140, 118, 152, 168, 132, 122, 150], [140, 165, 150, 120, 142, 160, 155, 125],
  [156, 125, 165, 145, 120, 155, 140, 160], [135, 150, 140, 160, 150, 128, 162, 138]
];
const obj = a => Object.fromEntries(a.map((v, i) => ["r" + i, v]));
const S = obj(SHAPES[0]);
let dirty = true, lastDraw = -1;
function draw(t = 0) {
  const w = (Math.sin(t * 0.9) + 1) / 2, f = n => n.toFixed(1); // w: nhịp "thở" của khối
  const p = Array.from({ length: K }, (_, i) => {
    const a = (i / K) * Math.PI * 2, r = S["r" + i] + Math.sin(i * 1.7 + w * 6) * w * 7;
    return [Math.cos(a) * r, Math.sin(a) * r];
  });
  let d = `M${f(p[0][0])},${f(p[0][1])}`;
  for (let i = 0; i < K; i++) {
    const a = p[(i + K - 1) % K], b = p[i], c = p[(i + 1) % K], e = p[(i + 2) % K];
    d += `C${f(b[0] + (c[0] - a[0]) / 6)},${f(b[1] + (c[1] - a[1]) / 6)} ${f(c[0] - (e[0] - b[0]) / 6)},${f(c[1] - (e[1] - b[1]) / 6)} ${f(c[0])},${f(c[1])}`;
  }
  path.setAttribute("d", d + "Z");
  ring.setAttribute("d", d + "Z");
  ring.setAttribute("transform", "scale(1.13) rotate(8)");
}

// Mỗi chặng morph gắn với một mục thật của trang (không còn lệch khi phần cuộn ngang dài)
const STOPS = [
  { x: "18vw",  y: "0vh",  scale: 1.0,  rotation: 0,   color: "#dce8f0" },
  { x: "-22vw", y: "6vh",  scale: 1.0,  rotation: 50,  color: "#dce8f0" },
  { x: "0vw",   y: "0vh",  scale: 1.45, rotation: 110, color: "#e8eff3" },
  { x: "-26vw", y: "8vh",  scale: 0.95, rotation: 170, color: "#d9e6ef" },
  { x: "24vw",  y: "-6vh", scale: 1.15, rotation: 230, color: "#e3ecf1" },
  { x: "0vw",   y: "0vh",  scale: 1.0,  rotation: 280, color: "#e6edf2" },
  { x: "0vw",   y: "0vh",  scale: 0.8,  rotation: 330, color: "#f0e6ea" }
];
const STAGE = ["#open", "#mile", "#code", "#values", "#contact", "#thanks"];
gsap.set("#blob", { xPercent: -50, yPercent: -50, ...STOPS[0] });

/* ===== Thanh tiến trình + nhãn chương (nhẹ, luôn bật) ===== */
gsap.to(".bar", { scaleX: 1, ease: "none", scrollTrigger: { start: 0, end: "max", scrub: 0.3 } });
$$("[data-label]").forEach(sec => ScrollTrigger.create({
  trigger: sec, start: "top 55%", end: "bottom 55%",
  onToggle: self => self.isActive && ($("#label").textContent = sec.dataset.label)
}));

/* ===== Tách chữ (giữ nhãn cho trình đọc màn hình, chỉ tách một lần) ===== */
function splitChars(el) {
  if (el.dataset.s) return; el.dataset.s = 1;
  el.setAttribute("aria-label", el.textContent);
  (function walk(n) {
    [...n.childNodes].forEach(c => {
      if (c.nodeType === 3) {
        const fr = document.createDocumentFragment();
        [...c.textContent].forEach(ch => {
          const s = document.createElement("span");
          s.className = "ch"; s.setAttribute("aria-hidden", "true"); s.style.display = "inline-block";
          s.textContent = ch === " " ? "\u00A0" : ch; fr.appendChild(s);
        });
        c.replaceWith(fr);
      } else walk(c);
    });
  })(el);
}
function splitWords(el) {
  if (el.dataset.s) return; el.dataset.s = 1;
  el.setAttribute("aria-label", el.textContent.trim());
  el.innerHTML = el.textContent.trim().split(/\s+/).map(w => `<span class="w" aria-hidden="true"><span>${w}</span></span>`).join(" ");
}

/* ===== Contact (không phụ thuộc hiệu ứng) ===== */
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
$$(".icons a, .icons button").forEach(el => {
  el.addEventListener("pointerenter", () => gsap.to(el, { y: -4, duration: 0.3, ease: "power2.out", overwrite: true }));
  el.addEventListener("pointerleave", () => gsap.to(el, { y: 0, duration: 0.3, ease: "power2.out", overwrite: true }));
});

const code = $("#codebox"), full = code.dataset.text;
const mm = gsap.matchMedia();

/* ===== Chế độ đầy đủ hiệu ứng ===== */
mm.add("(prefers-reduced-motion: no-preference)", () => {
  // Vẽ khối: một ticker duy nhất; vẽ ngay khi cuộn, và ~22fps cho nhịp thở
  gsap.ticker.add(t => { if (dirty || t - lastDraw > 0.045) { draw(t); dirty = false; lastDraw = t; } });

  STAGE.forEach((sel, k) => {
    const i = k + 1, first = i === 1;
    gsap.timeline({
      defaults: { ease: "none", immediateRender: first },
      scrollTrigger: { trigger: sel, start: "top bottom", end: "top 25%", scrub: 1.2 }
    })
      .fromTo(S, obj(SHAPES[(i - 1) % 6]), { ...obj(SHAPES[i % 6]), onUpdate: () => (dirty = true) }, 0)
      .fromTo("#blob", STOPS[i - 1], { ...STOPS[i] }, 0);
  });

  // Hero
  splitChars($("#h1"));
  gsap.set(".ch", { yPercent: 110, opacity: 0, rotate: 4 });
  gsap.set([".kick", ".sub", ".by", ".cue"], { opacity: 0, y: 16 });
  const start = () => gsap.timeline({ defaults: { ease: "power3.out" } })
    .to(".kick", { opacity: 1, y: 0, duration: 0.8 })
    .to(".ch", { yPercent: 0, opacity: 1, rotate: 0, duration: 1, stagger: 0.03 }, "-=0.5")
    .to([".sub", ".by", ".cue"], { opacity: 1, y: 0, duration: 0.9, stagger: 0.15 }, "-=0.6");
  Promise.race([document.fonts.ready, new Promise(r => setTimeout(r, 1200))]).then(start);
  gsap.to(".hero-in", { yPercent: -14, opacity: 0, ease: "none",
    scrollTrigger: { trigger: "#hero", start: "top top", end: "bottom top", scrub: true } });

  // Tiêu đề từng từ
  $$(".split").forEach(el => {
    splitWords(el);
    gsap.from(el.querySelectorAll(".w > span"), { yPercent: 115, duration: 1, stagger: 0.07, ease: "power3.out",
      scrollTrigger: { trigger: el, start: "top 85%", once: true } });
  });

  // Đoạn văn hiện theo lô
  gsap.set(".rv", { opacity: 0, y: 30 });
  ScrollTrigger.batch(".rv", { start: "top 90%", once: true,
    onEnter: els => gsap.to(els, { opacity: 1, y: 0, duration: 0.9, stagger: 0.12, ease: "power2.out", overwrite: true }) });

  // Cuộn ngang
  // 1) CUỘN NGANG (pin) — phải tạo đầu tiên
  const track = $("#track"), dist = () => track.scrollWidth - innerWidth;
  const hs = gsap.to(track, { x: () => -dist(), ease: "none",
    scrollTrigger: { trigger: "#mile", start: "top top", end: () => "+=" + dist(),
      pin: true, scrub: 1, anticipatePin: 1, invalidateOnRefresh: true,
      refreshPriority: 1,                       // <-- thêm dòng này
      onUpdate: self => gsap.set("#hfill", { scaleX: self.progress }) } });
  $$(".panel").forEach(p => gsap.from(p.children, { opacity: 0, y: 40, duration: 0.9, stagger: 0.1, ease: "power2.out",
    scrollTrigger: { trigger: p, containerAnimation: hs, start: "left 88%", once: true } }));

  // 2) Ticker vẽ blob
  gsap.ticker.add(t => { if (dirty || t - lastDraw > 0.045) { draw(t); dirty = false; lastDraw = t; } });

  // 3) Các chặng morph — tạo SAU pin
  STAGE.forEach((sel, k) => { /* giữ nguyên như cũ */ });

  // Gõ code
  const typed = { n: 0 }; let shown = -1;
  ScrollTrigger.create({ trigger: code, start: "top 80%", once: true,
    onEnter: () => gsap.to(typed, { n: full.length, duration: 2.2, ease: "none", delay: 0.4,
      onUpdate: () => { const n = Math.round(typed.n); if (n !== shown) { shown = n; code.textContent = full.slice(0, n) + "▍"; } },
      onComplete: () => (code.textContent = full) }) });

  // Dải chữ: chỉ chạy khi nằm trong màn hình, nhanh dần theo vận tốc cuộn (làm mượt bằng ticker)
  const mq = gsap.to(".mq", { xPercent: -25, duration: 22, ease: "none", repeat: -1, paused: true });
  let vel = 0, boost = 1;
  ScrollTrigger.create({ trigger: ".marquee", start: "top bottom", end: "bottom top",
    onToggle: s => (s.isActive ? mq.play() : mq.pause()), onUpdate: s => (vel = Math.abs(s.getVelocity())) });
  gsap.ticker.add(() => { boost += (1 + Math.min(vel / 250, 8) - boost) * 0.08; vel *= 0.9; mq.timeScale(boost); });

  // Trái tim cuối trang
  gsap.from(".heart", { scale: 0, opacity: 0, duration: 0.9, delay: 0.8, ease: "back.out(2.5)",
    scrollTrigger: { trigger: ".thanks", start: "top 40%", once: true } });
});

/* ===== Chế độ giảm chuyển động: nội dung hiện sẵn, khối nền đứng yên ===== */
mm.add("(prefers-reduced-motion: reduce)", () => { draw(0); code.textContent = full; });

addEventListener("load", () => ScrollTrigger.refresh());
document.fonts && document.fonts.ready.then(() => ScrollTrigger.refresh());
