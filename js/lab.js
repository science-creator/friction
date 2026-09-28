/* =========================================================
   lab.js — 물체의 운동을 방해하는 힘 실험실
   ---------------------------------------------------------
   계산은 friction.js 가 하고, 이 파일은 그것을 '보이게' 만든다.

   화면의 핵심 장치 세 가지
     ① 당기는 힘 화살표와 마찰력 화살표가 **정확히 같은 길이로 반대 방향**을 향한다.
        당길수록 둘이 **함께** 자란다 — 마찰력이 스스로 정해진 크기가 없다는 뜻이다.
        한계에 닿으면 마찰력만 멈추고, 블록이 미끄러지기 시작한다.
     ② 무게와 접촉면을 바꾸면 **한계 막대만** 달라진다.
     ③ 빗면에서는 마찰력의 **방향**이 운동하려는 쪽의 반대로 뒤집힌다.

   ⚠ **그려진 길이가 곧 값이다.** 두 화살표는 같은 눈금을 쓰고 값에 정비례한다.
   ⚠ 애니메이션이 없으므로 requestAnimationFrame 을 돌리지 않는다.
   ========================================================= */
(function () {
  "use strict";

  var F = window.Friction;

  var S = {
    scene: "pull",
    pull: 0,
    surface: "wood",
    boxes: 1,
    motion: "down",
    mission: null, predictPick: null, missionState: "ready"
  };

  var canvas, ctx, cssW = 900, cssH = 556;
  var records = [];
  var seen = { held: {}, moved: false, boxes2: false, sand: false, motions: {} };

  var COL = { ink: "#e2e8f0", faint: "#64748b", line: "#94a3b8",
              pull: "#fbbf24", fric: "#a78bfa" };

  function $(id) { return document.getElementById(id); }
  function clamp(v, a, b) { return F.clamp(v, a, b); }
  function fmt(v, n) { var d = (n == null ? 2 : n); return (Math.round(v * Math.pow(10, d)) / Math.pow(10, d)).toFixed(d); }

  function roundRect(g, x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }

  /* ---------------------------------------------------------
     1. 미션
        ⚠ `setup` 이 정답 자리이면 안 된다 — 시작하자마자 깨지면 미션이 아니다.
     --------------------------------------------------------- */
  var MISSIONS = [
    {
      id: 1, star: "🧱", title: "당겨도 움직이지 않는다",
      story: "나무판 위의 나무 블록을 용수철저울로 <b>천천히</b> 당겨 보자. " +
             "조금 당겼을 때 블록은 <b>바로</b> 움직일까?",
      scene: "pull", setup: { pull: 0, surface: "wood", boxes: 1 }, allow: ["pull", "surface", "boxes"],
      predict: { q: "조금 당기면 블록은?",
                 opts: ["바로 움직인다", "움직이지 않는다", "뒤로 밀린다"], ans: 1 },
      goals: [{ key: "held", text: "당겼는데도 <b>움직이지 않는</b> 상태 만들어 보기" }],
      why: "<b>움직이지 않습니다.</b><br>" +
           "접촉면에서 <b>반대 방향으로 마찰력</b>이 작용해 당기는 힘과 <b>평형</b>을 이루기 때문이에요.<br>" +
           "두 화살표를 보세요 — <b>길이가 같고 방향이 반대</b>입니다."
    },
    {
      id: 2, star: "↔️", title: "마찰력은 얼마일까",
      story: "움직이지 않는 동안, <b>마찰력의 크기</b>는 얼마일까? " +
             "당기는 힘을 <b>여러 값으로 바꿔 가며</b> 확인해 보자.",
      scene: "pull", setup: { pull: 0, surface: "wood", boxes: 1 }, allow: ["pull", "surface", "boxes"],
      predict: { q: "움직이지 않을 때 마찰력의 크기는?",
                 opts: ["언제나 일정하다", "당기는 힘과 같다", "당기는 힘보다 크다"], ans: 1 },
      goals: [{ key: "held2", text: "서로 <b>다른 두 힘</b>에서 마찰력 확인하기 (움직이지 않는 채로)" }],
      why: "<b>당기는 힘과 같습니다.</b> 방향만 반대예요.<br>" +
           "그래서 마찰력에는 <b>스스로 정해진 크기가 없습니다</b> — 내가 당기는 만큼 따라 커집니다.<br>" +
           "<em>움직이지 않을 때 <b>용수철저울의 눈금이 곧 마찰력</b>인 이유입니다.</em>"
    },
    {
      id: 3, star: "🚀", title: "움직이게 하라",
      story: "이번엔 블록을 <b>움직이게</b> 해 보자. 얼마나 세게 당겨야 할까?",
      scene: "pull", setup: { pull: 0, surface: "wood", boxes: 1 }, allow: ["pull", "surface", "boxes"],
      predict: { q: "블록이 움직이기 시작하는 때는?",
                 opts: ["아무리 세게 당겨도 안 움직인다",
                        "당기는 힘이 마찰력의 한계를 넘어설 때",
                        "당기는 힘이 무게보다 클 때"], ans: 1 },
      goals: [{ key: "moved", text: "블록을 <b>움직이게</b> 만들기" }],
      why: "<b>당기는 힘이 마찰력의 한계를 넘어설 때</b> 움직이기 시작합니다.<br>" +
           "마찰력은 한계까지만 커질 수 있어요. 그 위로는 따라오지 못하니 " +
           "남는 힘이 블록을 밀어냅니다.<br>" +
           "<em>나무판 위 상자 1개의 한계는 <b>1.96 N</b> 입니다.</em>"
    },
    {
      id: 4, star: "📦", title: "상자를 더 얹으면",
      story: "블록 위에 <b>상자를 더 얹어</b> 무겁게 만들면 한계는 어떻게 될까? " +
             "상자를 <b>2개 이상</b>으로 해 보자.",
      scene: "factors", setup: { surface: "wood", boxes: 1 }, allow: ["surface", "boxes"],
      predict: { q: "무거워지면 마찰력의 한계는?",
                 opts: ["커진다", "작아진다", "변하지 않는다"], ans: 0 },
      goals: [{ key: "boxes2", text: "상자를 <b>2개 이상</b>으로 해 한계 확인하기" }],
      why: "<b>커집니다.</b> 학습지의 문장 그대로예요 — " +
           "<b>물체의 무게가 클수록 접촉면에서의 마찰력은 크다.</b><br>" +
           "그래서 상자 1개일 때가 2개일 때보다 <b>더 잘 미끄러집니다.</b>"
    },
    {
      id: 5, star: "🧱", title: "사포 위에서는",
      story: "이번엔 접촉면을 바꿔 보자. 매끈한 <b>아크릴</b>과 거친 <b>사포</b> 중 " +
             "어느 쪽이 더 잘 미끄러질까?",
      scene: "factors", setup: { surface: "wood", boxes: 1 }, allow: ["surface", "boxes"],
      predict: { q: "더 잘 미끄러지는 쪽은?",
                 opts: ["아크릴 면", "사포 면", "둘이 같다"], ans: 0 },
      goals: [{ key: "sand", text: "<b>🧱 사포</b>에서 한계 확인하기" }],
      why: "<b>아크릴 면</b>이 더 잘 미끄러집니다.<br>" +
           "학습지의 문장 그대로예요 — <b>접촉면이 거칠수록 마찰력은 크다.</b> " +
           "마찰력이 클수록 물체를 움직이는 데 힘이 <b>더 많이</b> 듭니다.<br>" +
           "<em>같은 상자라도 아크릴 0.98 N · 나무판 1.96 N · 사포 2.94 N 로 한계가 다릅니다.</em>"
    },
    {
      id: 6, star: "⛰️", title: "빗면에서 마찰력의 방향은",
      story: "빗면에서 물체가 <b>미끄러져 내려갈 때</b>와 <b>위로 끌어올릴 때</b>, " +
             "마찰력은 각각 어느 쪽을 향할까? <b>둘 다</b> 확인해 보자.",
      scene: "slope", setup: { motion: "down", surface: "wood", boxes: 1 }, allow: ["motion", "surface", "boxes"],
      predict: { q: "마찰력의 방향은?",
                 opts: ["언제나 빗면 위쪽", "언제나 빗면 아래쪽",
                        "운동하려는 방향의 반대쪽"], ans: 2 },
      goals: [
        { key: "motionDown", text: "<b>⬇️ 미끄러져 내려갈 때</b> 보기" },
        { key: "motionUp",   text: "<b>⬆️ 위로 끌어올릴 때</b> 보기" }
      ],
      why: "<b>운동하려는 방향의 반대쪽</b>입니다.<br>" +
           "· 밑으로 미끄러질 때 → 마찰력은 <b>빗면 위쪽</b> (미끄러지는 것을 방해)<br>" +
           "· 위로 끌어올릴 때 → 마찰력은 <b>빗면 아래쪽</b> (올라오는 것을 방해)<br>" +
           "마찰력은 언제나 <b>운동을 방해하는 쪽</b>이라 방향이 뒤집힙니다."
    }
  ];

  /* ---------------------------------------------------------
     2. 화면 만들기
     --------------------------------------------------------- */
  function layout() {
    if (!canvas) return;
    var r = canvas.getBoundingClientRect();
    cssW = Math.max(320, Math.round(r.width || 900));
    cssH = Math.max(200, Math.round(r.height || cssW / 1.62));
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function sceneKind() {
    if (S.scene === "mission") return S.mission ? S.mission.scene : "pull";
    return S.scene;
  }

  function draw() {
    if (!ctx) return;
    var g = ctx;
    var grad = g.createLinearGradient(0, 0, 0, cssH);
    grad.addColorStop(0, "#0b1220"); grad.addColorStop(1, "#1e293b");
    g.fillStyle = grad; g.fillRect(0, 0, cssW, cssH);
    var k = sceneKind();
    if (k === "pull") drawPull(g);
    else if (k === "factors") drawFactors(g);
    else drawSlope(g);
  }

  /* 화살표 하나 — 길이는 값에 정비례, 눈금은 바깥에서 준다 */
  function arrow(g, x, y, len, dir, col, label) {
    if (len < 1) return;
    g.strokeStyle = col; g.lineWidth = 5; g.lineCap = "round";
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + dir * len, y); g.stroke();
    g.fillStyle = col;
    var tipX = x + dir * (len + 10);
    g.beginPath();
    g.moveTo(tipX, y);
    g.lineTo(x + dir * len, y - 7);
    g.lineTo(x + dir * len, y + 7);
    g.closePath(); g.fill();
    g.lineCap = "butt";
    if (label) {
      g.fillStyle = col; g.font = "bold 13px sans-serif"; g.textAlign = "center";
      g.fillText(label, x + dir * len / 2, y - 14);
    }
  }

  /* ---- 장면 ① 당겨 보기 ----
     두 화살표가 **같은 눈금**을 쓴다. 그래서 길이가 같다는 것이 곧 힘이 같다는 뜻이다. */
  function drawPull(g) {
    var st = F.state(S.pull, S.boxes, S.surface);
    var surf = F.surface(S.surface);

    /* 바닥(접촉면) */
    var floorY = cssH * 0.62;
    g.fillStyle = surf.key === "acryl" ? "rgba(125,211,252,.30)"
               : (surf.key === "sand" ? "rgba(248,113,113,.30)" : "rgba(161,98,7,.45)");
    g.fillRect(0, floorY, cssW, cssH - floorY);
    g.strokeStyle = "rgba(226,232,240,.55)"; g.lineWidth = 2;
    g.beginPath(); g.moveTo(0, floorY); g.lineTo(cssW, floorY); g.stroke();
    /* 거칠기를 이빨로 보여 준다 — 거칠수록 촘촘하고 크다 */
    var teeth = surf.key === "acryl" ? 0 : (surf.key === "wood" ? 26 : 60);
    g.strokeStyle = "rgba(226,232,240,.45)"; g.lineWidth = 1.5;
    for (var i = 0; i < teeth; i++) {
      var tx = (i + 0.5) * (cssW - 8) / Math.max(teeth, 1);   /* 마지막 이빨이 무대 끝에 닿지 않게 */
      var th = surf.key === "sand" ? 6 : 4;
      g.beginPath(); g.moveTo(tx, floorY); g.lineTo(tx + 3, floorY - th); g.stroke();
    }

    /* 블록이 움직였으면 오른쪽으로 조금 옮겨 그린다 */
    var bw = Math.min(cssW * 0.16, 120), bh = cssH * 0.13;
    var bx = cssW * 0.30 + (st.moving ? cssW * 0.14 : 0);
    var by = floorY - bh;

    /* 쌓은 상자 */
    for (var b = 0; b < S.boxes; b++) {
      g.fillStyle = b === 0 ? "#a16207" : "#ca8a04";
      roundRect(g, bx, by - b * (bh * 0.62), bw, bh * (b === 0 ? 1 : 0.6), 5); g.fill();
      g.strokeStyle = "rgba(226,232,240,.6)"; g.lineWidth = 1.5;
      roundRect(g, bx, by - b * (bh * 0.62), bw, bh * (b === 0 ? 1 : 0.6), 5); g.stroke();
    }
    g.fillStyle = COL.ink; g.font = "bold 14px sans-serif"; g.textAlign = "center";
    g.fillText("나무 블록", bx + bw / 2, by + bh * 0.62);

    /* 두 화살표 — **같은 눈금**. 눈금은 가장 큰 한계(사포·상자 3개)에 맞춰 고정한다. */
    var maxF = Math.max(F.limitN(3, "sand"), 10);
    var room = Math.min(cssW * 0.24, 190);
    var pxPerN = room / maxF;
    var midY = by + bh * 0.42;
    arrow(g, bx + bw, midY, st.pullN * pxPerN, +1, COL.pull, "당기는 힘 " + fmt(st.pullN) + " N");
    arrow(g, bx, midY, st.frictionN * pxPerN, -1, COL.fric, "마찰력 " + fmt(st.frictionN) + " N");

    /* 용수철저울 — ⚠ 무대 오른쪽 끝에 닿지 않도록 안쪽으로 물린다(검증에서 걸렸다) */
    var scaleX = Math.min(bx + bw + room + 26, cssW - 70);
    g.strokeStyle = COL.line; g.lineWidth = 2;
    g.beginPath(); g.moveTo(bx + bw, midY); g.lineTo(scaleX, midY); g.stroke();
    g.fillStyle = "rgba(148,163,184,.25)";
    roundRect(g, scaleX, midY - 16, 62, 32, 6); g.fill();
    g.fillStyle = COL.pull; g.font = "bold 15px sans-serif"; g.textAlign = "center";
    g.fillText(fmt(st.pullN, 1) + " N", scaleX + 31, midY + 6);

    /* 상태 */
    g.textAlign = "left";
    g.fillStyle = COL.faint; g.font = "14px sans-serif";
    g.fillText("🧱 " + surf.name + " 위 · 상자 " + S.boxes + "개 · 한계 " + fmt(st.limitN) + " N", 16, 26);
    g.fillStyle = st.moving ? "#f87171" : "#4ade80";
    g.font = "bold 16px sans-serif";
    g.fillText(st.moving
      ? "➡ 한계를 넘었다 — 움직이기 시작한다"
      : (st.pullN > 0 ? "⏸ 움직이지 않는다 — 두 힘이 평형" : "손을 대지 않았다"), 16, 50);

    if (!st.moving && st.pullN > 0) {
      g.fillStyle = "#fde047"; g.font = "bold 15px sans-serif"; g.textAlign = "center";
      g.fillText("두 화살표의 길이가 같다 → 마찰력 = 당기는 힘", cssW * 0.5, cssH - 18);
    }
  }

  /* ---- 장면 ② 무엇이 마찰력을 정할까 ----
     학습지의 「상자 1개 vs 2개」, 「아크릴 vs 사포」를 한 화면에 늘어놓는다. */
  function drawFactors(g) {
    g.fillStyle = COL.faint; g.font = "14px sans-serif"; g.textAlign = "left";
    g.fillText("📊 한계(움직이기 시작하는 힘)를 견주어 보자", 16, 26);

    var maxLim = F.limitN(3, "sand");
    var rows = [];
    F.SURFACES.forEach(function (s) {
      for (var b = 1; b <= 3; b++) rows.push({ surf: s, boxes: b, lim: F.limitN(b, s.key) });
    });

    var top = cssH * 0.14, rowH = (cssH * 0.76) / rows.length;
    var bx = cssW * 0.34, bw = cssW * 0.54;
    rows.forEach(function (r, i) {
      var y = top + i * rowH;
      var on = (r.surf.key === S.surface && r.boxes === S.boxes);
      g.fillStyle = on ? "#fde047" : COL.ink;
      g.font = (on ? "bold " : "") + "13px sans-serif"; g.textAlign = "left";
      g.fillText(r.surf.emoji + " " + r.surf.name + " · " + r.boxes + "개", 16, y + rowH * 0.62);
      g.fillStyle = "rgba(148,163,184,.22)";
      roundRect(g, bx, y + rowH * 0.22, bw, rowH * 0.5, 4); g.fill();
      g.fillStyle = on ? "#fde047" : r.surf.css;
      roundRect(g, bx, y + rowH * 0.22, bw * clamp(r.lim / maxLim, 0, 1), rowH * 0.5, 4); g.fill();
      g.fillStyle = COL.ink; g.font = (on ? "bold " : "") + "12px sans-serif";
      g.fillText(fmt(r.lim) + " N", bx + 6, y + rowH * 0.62);
    });

    g.fillStyle = COL.ink; g.font = "bold 14px sans-serif"; g.textAlign = "center";
    g.fillText("무게가 클수록 · 접촉면이 거칠수록 한계가 크다", cssW * 0.5, cssH - 12);
  }

  /* ---- 장면 ③ 빗면에서 ----
     마찰력의 **방향**만 보여 준다. 운동하려는 쪽의 반대다. */
  function drawSlope(g) {
    var d = F.frictionDirection(S.motion);
    var st = F.state(0, S.boxes, S.surface);

    var x0 = cssW * 0.14, y0 = cssH * 0.76;
    var x1 = cssW * 0.78, y1 = cssH * 0.26;
    var ang = Math.atan2(y1 - y0, x1 - x0);

    /* 빗면 */
    g.strokeStyle = "rgba(226,232,240,.65)"; g.lineWidth = 3;
    g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
    g.fillStyle = "rgba(161,98,7,.35)";
    g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.lineTo(x1, y0); g.closePath(); g.fill();

    /* 블록 — 빗면 가운데 */
    var mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
    var bw = Math.min(cssW * 0.10, 74), bh = bw * 0.62;
    g.save();
    g.translate(mx, my); g.rotate(ang);
    g.fillStyle = "#a16207";
    roundRect(g, -bw / 2, -bh, bw, bh, 5); g.fill();
    g.strokeStyle = "rgba(226,232,240,.6)"; g.lineWidth = 1.5;
    roundRect(g, -bw / 2, -bh, bw, bh, 5); g.stroke();
    g.restore();

    /* 화살표 두 개 — 운동하려는 방향(주황)과 마찰력(보라). 길이는 같게 두고 **방향만** 본다. */
    var L = Math.min(cssW * 0.14, 96);
    var ux = Math.cos(ang), uy = Math.sin(ang);       // 빗면 아래쪽 방향
    var motionSign = (S.motion === "down") ? +1 : -1; // 내려감 = 아래쪽
    var fricSign = -motionSign;                        // 마찰력은 언제나 반대

    function slopeArrow(sign, col, label, offset) {
      var sx = mx + (-uy) * offset, sy = my + (ux) * offset;
      var ex = sx + ux * sign * L, ey = sy + uy * sign * L;
      g.strokeStyle = col; g.lineWidth = 5; g.lineCap = "round";
      g.beginPath(); g.moveTo(sx, sy); g.lineTo(ex, ey); g.stroke();
      var a2 = Math.atan2(ey - sy, ex - sx);
      g.fillStyle = col;
      g.beginPath();
      g.moveTo(ex + Math.cos(a2) * 10, ey + Math.sin(a2) * 10);
      g.lineTo(ex + Math.cos(a2 + 2.5) * 10, ey + Math.sin(a2 + 2.5) * 10);
      g.lineTo(ex + Math.cos(a2 - 2.5) * 10, ey + Math.sin(a2 - 2.5) * 10);
      g.closePath(); g.fill();
      g.lineCap = "butt";
      g.fillStyle = col; g.font = "bold 13px sans-serif"; g.textAlign = "center";
      g.fillText(label, (sx + ex) / 2 + (-uy) * 18, (sy + ey) / 2 + ux * 18);
    }
    slopeArrow(motionSign, COL.pull, S.motion === "down" ? "미끄러진다" : "끌어올린다", -30);
    slopeArrow(fricSign, COL.fric, "마찰력", 22);

    g.fillStyle = COL.faint; g.font = "14px sans-serif"; g.textAlign = "left";
    g.fillText("⛰️ 마찰력은 운동하려는 방향의 반대쪽", 16, 26);
    g.fillStyle = COL.fric; g.font = "bold 15px sans-serif";
    g.fillText("마찰력의 방향 : " + d.text, 16, 50);
    g.fillStyle = COL.ink; g.font = "14px sans-serif";
    g.fillText(d.why, 16, 72);
  }

  /* ---------------------------------------------------------
     3. 계기판
     --------------------------------------------------------- */
  function setBar(id, val, full) {
    $(id).querySelector(".bar-fill").style.width = clamp(val / full * 100, 0, 100) + "%";
  }
  function barText(id, t) { $(id).querySelector(".bar-val").textContent = t; }
  function ro(i, name, val, unit) {
    $("roName" + i).textContent = name; $("roVal" + i).textContent = val;
    $("roUnit" + i).textContent = unit || "";
  }

  function updatePanel() {
    var k = sceneKind();
    var st = F.state(S.pull, S.boxes, S.surface);
    /* ⚠ 두 막대는 **같은 눈금**을 쓴다. 길이가 같다는 것이 곧 힘이 같다는 뜻이다. */
    var full = Math.max(F.limitN(3, "sand"), 10);

    $("barName1").textContent = "당기는 힘 →";
    $("barName2").textContent = "← 마찰력";
    $("rowB").classList.remove("hidden");
    setBar("barA", st.pullN, full); barText("barA", fmt(st.pullN) + " N");
    setBar("barB", st.frictionN, full); barText("barB", fmt(st.frictionN) + " N");

    ro(1, "당기는 힘", fmt(st.pullN), " N");
    ro(2, "마찰력", fmt(st.frictionN), " N");
    ro(3, "한계", fmt(st.limitN), " N");
    ro(4, "상태", st.moving ? "움직인다" : "멈춰 있다", "");

    if (k === "factors") {
      $("gaugeTitle").textContent = "📊 무엇이 정할까";
      $("gaugeSub").innerHTML = "무게와 <b>거칠기</b>가 한계를 정한다";
      $("fLaw").innerHTML = '한계 = <span class="k">거칠기</span> × <span class="t">무게</span> = ' +
                            fmt(st.limitN) + ' N';
      $("fWhy").innerHTML = '<em>무게 ' + fmt(st.weightN) + ' N · 상자 ' + S.boxes +
                            '개 · ' + st.surfaceName + '</em>';
    } else if (k === "slope") {
      var d = F.frictionDirection(S.motion);
      $("gaugeTitle").textContent = "⛰️ 빗면에서";
      $("gaugeSub").innerHTML = "방향은 <b>운동의 반대</b>";
      $("fLaw").innerHTML = '마찰력의 방향 → <span class="k">' + d.text + '</span>';
      $("fWhy").innerHTML = '<em>' + d.why + '</em>';
    } else {
      $("gaugeTitle").textContent = "🧱 두 힘";
      $("gaugeSub").innerHTML = st.moving ? "한계를 넘었다" : "당기는 만큼 마찰력도 커진다";
      $("fLaw").innerHTML = '마찰력 = <span class="k">당기는 힘</span> ' +
                            '(한계 <span class="t">' + fmt(st.limitN) + ' N</span> 까지)';
      $("fWhy").innerHTML = st.moving
        ? '<em>당기는 힘이 한계를 넘었다 → <b>움직인다</b></em>'
        : (st.pullN > 0
            ? '<em>두 힘의 크기가 <b>같고</b> 방향이 <b>반대</b> → 평형</em>'
            : '<em>슬라이더를 밀어 당겨 보세요</em>');
    }

    $("graphTitle").textContent = "📈 당기는 힘과 마찰력";
    $("graphSub").innerHTML = "한계까지는 같이 커진다";
    $("tip").textContent = tipText();
    syncMissionGoals();
  }

  function tipText() {
    var k = sceneKind();
    if (k === "factors") return "상자 수와 접촉면을 바꿔 한계를 견주세요";
    if (k === "slope") return "내려갈 때와 올라갈 때를 모두 보세요";
    return "천천히 당겨 보세요 — 언제 움직이기 시작하나요?";
  }

  /* ---------------------------------------------------------
     4. 그래프 — 당기는 힘 vs 마찰력 (한계에서 꺾인다)
     --------------------------------------------------------- */
  function drawGraph() {
    var c = $("graph");
    if (!c) return;
    var r = c.getBoundingClientRect();
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    var w = Math.max(200, Math.round(r.width)), h = Math.max(100, Math.round(r.height));
    if (c.width !== Math.round(w * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); }
    var g = c.getContext("2d");
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = "#fff"; g.fillRect(0, 0, w, h);
    var pad = 32;
    g.strokeStyle = "#cbd5e1"; g.lineWidth = 1;
    g.beginPath(); g.moveTo(pad, h - pad); g.lineTo(w - 8, h - pad);
    g.moveTo(pad, 8); g.lineTo(pad, h - pad); g.stroke();

    var maxP = 10;
    function X(p) { return pad + (w - pad - 10) * clamp(p / maxP, 0, 1); }
    function Y(f) { return (h - pad) - (h - pad - 10) * clamp(f / maxP, 0, 1); }

    var lim = F.limitN(S.boxes, S.surface);
    /* 한계까지는 y = x 인 직선, 그 뒤로는 한계에서 멈춘 채 '움직임' 구간 */
    g.strokeStyle = "#7c3aed"; g.lineWidth = 2.5;
    g.beginPath();
    g.moveTo(X(0), Y(0));
    g.lineTo(X(Math.min(lim, maxP)), Y(Math.min(lim, maxP)));
    g.stroke();
    if (lim < maxP) {
      g.setLineDash([5, 4]);
      g.beginPath(); g.moveTo(X(lim), Y(lim)); g.lineTo(X(maxP), Y(lim)); g.stroke();
      g.setLineDash([]);
      g.strokeStyle = "rgba(220,38,38,.6)"; g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(X(lim), 8); g.lineTo(X(lim), h - pad); g.stroke();
      g.fillStyle = "#dc2626"; g.font = "11px sans-serif"; g.textAlign = "center";
      g.fillText("한계", X(lim), h - pad + 14);
    }

    /* 지금 값 */
    var st = F.state(S.pull, S.boxes, S.surface);
    g.fillStyle = st.moving ? "#dc2626" : "#7c3aed";
    g.beginPath(); g.arc(X(st.pullN), Y(st.frictionN), 5.5, 0, Math.PI * 2); g.fill();

    g.fillStyle = "#64748b"; g.font = "12px sans-serif"; g.textAlign = "center";
    g.fillText("당기는 힘 (N) →", w / 2, h - 8);
    g.save(); g.translate(12, h / 2); g.rotate(-Math.PI / 2);
    g.fillText("← 마찰력 (N)", 0, 0); g.restore();
  }

  /* ---------------------------------------------------------
     5. 조작 패널
     --------------------------------------------------------- */
  function syncControls() {
    var k = sceneKind();
    var allow = (S.scene === "mission" && S.mission) ? S.mission.allow : null;
    document.querySelectorAll("[data-for]").forEach(function (el) {
      var scenes = el.getAttribute("data-for").split(/\s+/);
      var need = el.getAttribute("data-need");
      var okScene = scenes.indexOf(S.scene) >= 0 || scenes.indexOf(k) >= 0;
      var okNeed = true;
      if (S.scene === "mission" && need) okNeed = allow && allow.indexOf(need) >= 0;
      el.classList.toggle("hidden", !(okScene && okNeed));
    });
    $("missionCard").classList.toggle("hidden", S.scene !== "mission");
    $("valPull").textContent = fmt(S.pull, 1) + " N";
    $("valBoxes").textContent = S.boxes + " 개";
  }

  function setChips(id, val) {
    var w = $(id); if (!w) return;
    w.querySelectorAll(".chip").forEach(function (b) {
      b.classList.toggle("on", b.getAttribute("data-val") === String(val));
    });
  }

  /* ---------------------------------------------------------
     6. 미션
     --------------------------------------------------------- */
  function loadProgress() {
    try { return JSON.parse(sessionStorage.getItem("fr_missions") || "[]"); } catch (e) { return []; }
  }
  function saveProgress(l) { try { sessionStorage.setItem("fr_missions", JSON.stringify(l)); } catch (e) {} }

  function renderMissionList() {
    var done = loadProgress(), host = $("missionList");
    host.innerHTML = "";
    MISSIONS.forEach(function (M) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "mcard" + (S.mission && S.mission.id === M.id ? " on" : "") +
                    (done.indexOf(M.id) >= 0 ? " done" : "");
      b.innerHTML = '<span class="mno">미션 ' + M.id + (done.indexOf(M.id) >= 0 ? " ✅" : "") + '</span>' +
                    '<span class="mtitle"><span class="mstar">' + M.star + '</span> ' + M.title + '</span>';
      b.addEventListener("click", function () { pickMission(M); });
      host.appendChild(b);
    });
    $("missionScore").textContent = done.length + " / " + MISSIONS.length;
  }

  function pickMission(M) {
    S.scene = "mission";
    $("scenes").querySelectorAll(".scene-btn").forEach(function (x) {
      x.classList.toggle("on", x.getAttribute("data-scene") === "mission");
    });
    S.mission = M; S.predictPick = null;
    S.missionState = M.predict ? "predict" : "ready";
    Object.keys(M.setup || {}).forEach(function (kk) { S[kk] = M.setup[kk]; });
    seen = { held: {}, moved: false, boxes2: false, sand: false, motions: {} };
    $("rngPull").value = S.pull; $("rngBoxes").value = S.boxes;
    setChips("chipSurface", S.surface); setChips("chipMotion", S.motion);
    syncControls(); renderMissionList(); renderMissionBody(); refresh();
  }

  function renderMissionBody() {
    var M = S.mission, body = $("missionBody");
    if (!M) { body.classList.add("hidden"); return; }
    body.classList.remove("hidden");
    $("mTitle").textContent = M.star + " 미션 " + M.id + " · " + M.title;
    $("mStory").innerHTML = M.story;

    var pd = $("mPredict");
    if (M.predict && S.missionState === "predict") {
      pd.classList.remove("hidden");
      $("mQ").innerHTML = M.predict.q;
      var opts = $("mOpts"); opts.innerHTML = "";
      M.predict.opts.forEach(function (t, i) {
        var b = document.createElement("button");
        b.type = "button"; b.className = "opt";
        /* 예측 보기에는 굵은 글씨를 쓰지 않는다 — 정답만 굵으면 답이 드러난다(2026-09-28). */
        b.innerHTML = String(t).replace(/<\/?b>/g, "");
        b.addEventListener("click", function () {
          S.predictPick = i; S.missionState = "ready"; renderMissionBody();
        });
        opts.appendChild(b);
      });
    } else pd.classList.add("hidden");

    var gl = $("mGoals");
    if (M.goals && S.missionState !== "predict") {
      gl.classList.remove("hidden");
      gl.innerHTML = '<div class="q">목표</div>' + M.goals.map(function (gg) {
        var ok = checkGoal(gg.key);
        return '<div class="goal' + (ok ? " ok" : "") + '">' + (ok ? "✅ " : "⬜ ") + gg.text + '</div>';
      }).join("");
    } else gl.classList.add("hidden");

    var vd = $("mVerdict");
    if (S.missionState === "won") {
      vd.className = "verdict ok";
      vd.innerHTML = "<b>🎉 성공!</b>" + M.why +
        (M.predict && S.predictPick != null
          ? "<br><br>" + (S.predictPick === M.predict.ans
              ? "예측도 <b>맞았습니다.</b> 잘했어요!"
              : "예측은 달랐지만 <b>직접 확인해서 알아냈습니다.</b> 그것이 더 중요해요.")
          : "");
      vd.classList.remove("hidden");
    } else if (S.missionState === "predict") vd.classList.add("hidden");
    else {
      vd.className = "verdict no";
      vd.innerHTML = "<b>직접 확인하세요</b>목표를 모두 채우면 이유가 열립니다.";
      vd.classList.remove("hidden");
    }
  }

  function checkGoal(key) {
    switch (key) {
      case "held": return Object.keys(seen.held).length >= 1;
      case "held2": return Object.keys(seen.held).length >= 2;
      case "moved": return !!seen.moved;
      case "boxes2": return !!seen.boxes2;
      case "sand": return !!seen.sand;
      case "motionDown": return !!seen.motions.down;
      case "motionUp": return !!seen.motions.up;
      default: return false;
    }
  }

  function noteSeen() {
    var k = sceneKind();
    if (k === "pull") {
      var st = F.state(S.pull, S.boxes, S.surface);
      if (st.moving) seen.moved = true;
      /* '멈춘 채로 당기고 있는' 서로 다른 힘을 몇 가지 보았는가 */
      else if (st.pullN > 0.05) seen.held[fmt(st.pullN, 1)] = true;
    }
    if (k === "factors" || k === "pull") {
      if (S.boxes >= 2) seen.boxes2 = true;
      if (S.surface === "sand") seen.sand = true;
    }
    if (k === "slope") seen.motions[S.motion] = true;
  }

  function syncMissionGoals() {
    if (S.scene !== "mission" || !S.mission || S.missionState === "predict") return;
    var M = S.mission;
    if (!M.goals) return;
    var all = M.goals.every(function (gg) { return checkGoal(gg.key); });
    if (all && S.missionState !== "won") {
      S.missionState = "won";
      var done = loadProgress();
      if (done.indexOf(M.id) < 0) { done.push(M.id); saveProgress(done); }
      renderMissionList(); renderMissionBody();
    } else if (S.missionState !== "won") {
      var gl = $("mGoals");
      if (!gl.classList.contains("hidden")) {
        var rows = gl.querySelectorAll(".goal");
        M.goals.forEach(function (gg, i) {
          if (!rows[i]) return;
          var ok = checkGoal(gg.key);
          rows[i].className = "goal" + (ok ? " ok" : "");
          rows[i].innerHTML = (ok ? "✅ " : "⬜ ") + gg.text;
        });
      }
    }
  }

  /* ---------------------------------------------------------
     7. 실험 기록
     --------------------------------------------------------- */
  function addRecord() {
    var st = F.state(S.pull, S.boxes, S.surface);
    records.push({
      surf: F.surface(S.surface).emoji + " " + st.surfaceName,
      boxes: S.boxes + "개",
      pull: fmt(st.pullN) + " N",
      fric: fmt(st.frictionN) + " N",
      lim: fmt(st.limitN) + " N",
      moving: st.moving ? "움직인다" : "멈춰 있다"
    });
    renderRecords();
    window.PdfKit.toast("기록했습니다. (" + records.length + "번째)", "ok");
  }

  function renderRecords() {
    var body = $("recBody");
    body.innerHTML = "";
    records.forEach(function (r, i) {
      var tr = document.createElement("tr");
      tr.innerHTML = "<td>" + (i + 1) + "</td><td>" + r.surf + "</td><td>" + r.boxes +
                     "</td><td>" + r.pull + "</td><td><b>" + r.fric + "</b></td><td>" +
                     r.lim + "</td><td>" + r.moving + "</td>";
      body.appendChild(tr);
    });
    $("recEmpty").classList.toggle("hidden", records.length > 0);
  }

  function refresh() { noteSeen(); draw(); updatePanel(); drawGraph(); }

  /* ---------------------------------------------------------
     8. 연결
     --------------------------------------------------------- */
  function bindChips(id, fn) {
    var w = $(id); if (!w) return;
    w.addEventListener("click", function (e) {
      var b = e.target.closest ? e.target.closest(".chip") : null;
      if (!b) return;
      w.querySelectorAll(".chip").forEach(function (x) { x.classList.remove("on"); });
      b.classList.add("on");
      fn(b.getAttribute("data-val"));
    });
  }

  function bind() {
    $("scenes").addEventListener("click", function (e) {
      var b = e.target.closest ? e.target.closest(".scene-btn") : null;
      if (!b) return;
      $("scenes").querySelectorAll(".scene-btn").forEach(function (x) { x.classList.remove("on"); });
      b.classList.add("on");
      S.scene = b.getAttribute("data-scene");
      if (S.scene === "mission" && !S.mission) pickMission(MISSIONS[0]);
      else { syncControls(); refresh(); }
      renderMissionList();
    });

    $("btnReset").addEventListener("click", function () {
      S.pull = 0; S.surface = "wood"; S.boxes = 1; S.motion = "down";
      $("rngPull").value = 0; $("rngBoxes").value = 1;
      setChips("chipSurface", "wood"); setChips("chipMotion", "down");
      syncControls(); refresh();
    });
    $("btnRecord").addEventListener("click", addRecord);
    $("btnClearRec").addEventListener("click", function () {
      if (!records.length) return;
      if (!confirm("기록을 모두 지울까요?")) return;
      records.length = 0; renderRecords();
    });

    $("rngPull").addEventListener("input", function () { S.pull = parseFloat(this.value); syncControls(); refresh(); });
    $("rngBoxes").addEventListener("input", function () { S.boxes = parseInt(this.value, 10); syncControls(); refresh(); });
    bindChips("chipSurface", function (v) { S.surface = v; refresh(); });
    bindChips("chipMotion", function (v) { S.motion = v; refresh(); });

    if (window.ResizeObserver) {
      new ResizeObserver(function () { layout(); draw(); drawGraph(); }).observe(canvas);
    } else {
      window.addEventListener("resize", function () { layout(); draw(); drawGraph(); });
    }
  }

  function boot() {
    canvas = $("stage");
    layout(); bind(); syncControls();
    renderMissionList(); renderRecords(); refresh();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  window.FrLab = {
    S: S, MISSIONS: MISSIONS,
    _test: {
      set: function (k, v) { S[k] = v; syncControls(); refresh(); },
      scene: function (n) { S.scene = n; syncControls(); refresh(); },
      pick: function (id) { pickMission(MISSIONS[id - 1]); },
      answer: function (i) { S.predictPick = i; S.missionState = "ready"; renderMissionBody(); refresh(); },
      goals: function () {
        if (!S.mission || !S.mission.goals) return null;
        return S.mission.goals.map(function (gg) { return [gg.key, checkGoal(gg.key)]; });
      },
      state: function () { return S.missionState; },
      records: function () { return records; },
      draw: function () { draw(); return true; }
    }
  };
})();
