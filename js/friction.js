/* =========================================================
   friction.js — 마찰력 계산 엔진
   ---------------------------------------------------------
   화면을 전혀 모른다. 숫자만 다룬다.

   ■ 이 엔진이 지키는 한 가지
     **마찰력은 '주는 힘과 같다' — 한계에 닿기 전까지는.**

         마찰력 = min(주는 힘, 한계)

     학습지 6쪽의 문장 그대로다 —
       · 마찰력은 물체에 주는 힘과 크기는 **같고** 방향은 **반대**이다
       · 물체에 주는 힘이 커질수록 마찰력은 **커진다**
       · 주는 힘이 마찰력의 **한계**를 넘어서면 물체가 움직이기 시작한다

     그래서 이 엔진에는 '마찰 계수로 마찰력을 구하는 식'이 **없다.**
     계수가 정하는 것은 마찰력이 아니라 **한계**뿐이다. 이 구분이 이 단원의 핵심이다.

   ⚠ 움직이기 시작한 뒤의 '운동 마찰력'은 다루지 않는다.
     학습지에 없고 중학교 1학년 범위도 아니다. 한계를 넘으면 **움직인다**고만 말한다.
   ========================================================= */
(function (global) {
  "use strict";

  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }
  function round(v, n) { var p = Math.pow(10, n || 0); return Math.round(v * p) / p; }

  var G = 9.8;                        // N/kg — 앞 소단원들과 같은 값
  var BLOCK_MASS_G = 500;             // 나무 블록 한 개 500 g → 무게 4.9 N

  /* ---------------------------------------------------------
     1. 접촉면 — 거칠수록 한계가 크다
        학습지의 「아크릴 면 vs 사포 면」이 이 표다.
     --------------------------------------------------------- */
  var SURFACES = [
    { key: "acryl", name: "아크릴 면", emoji: "🧊", mu: 0.2, css: "#7dd3fc", note: "매끈하다" },
    { key: "wood",  name: "나무판",   emoji: "🪵", mu: 0.4, css: "#a16207", note: "학습지의 실험" },
    { key: "sand",  name: "사포 면",  emoji: "🧱", mu: 0.6, css: "#f87171", note: "거칠다" }
  ];

  function surface(key) {
    for (var i = 0; i < SURFACES.length; i++) if (SURFACES[i].key === key) return SURFACES[i];
    return SURFACES[1];
  }

  /* ---------------------------------------------------------
     2. 무게 — 상자를 얹을수록 커진다
        학습지의 「상자 1개 vs 상자 2개」가 이것이다.
     --------------------------------------------------------- */
  function weightN(boxes) { return BLOCK_MASS_G * boxes / 1000 * G; }

  /* ---------------------------------------------------------
     3. 한계 — 이보다 세게 당기면 움직인다
        한계 = 마찰 계수 × 무게.
        ⚠ 이것은 '마찰력'이 아니라 마찰력이 **커질 수 있는 끝**이다.
     --------------------------------------------------------- */
  function limitN(boxes, surfKey) { return surface(surfKey).mu * weightN(boxes); }

  /* ---------------------------------------------------------
     4. 마찰력 — 주는 힘과 같다(한계까지)
     --------------------------------------------------------- */
  function frictionN(pullN, boxes, surfKey) {
    return Math.min(Math.max(pullN, 0), limitN(boxes, surfKey));
  }

  function moving(pullN, boxes, surfKey) { return pullN > limitN(boxes, surfKey) + 1e-12; }

  /* 지금 상태 한 묶음 — 화면과 학습지가 같이 쓴다 */
  function state(pullN, boxes, surfKey) {
    var lim = limitN(boxes, surfKey);
    var f = frictionN(pullN, boxes, surfKey);
    return {
      pullN: Math.max(pullN, 0),
      frictionN: f,
      limitN: lim,
      weightN: weightN(boxes),
      boxes: boxes,
      surfaceName: surface(surfKey).name,
      mu: surface(surfKey).mu,
      moving: moving(pullN, boxes, surfKey),
      /* 움직이지 않는 동안 두 힘은 **정확히 같다**. 이 앱이 보여 주려는 것이 이것이다. */
      balanced: !moving(pullN, boxes, surfKey) && Math.abs(f - Math.max(pullN, 0)) < 1e-12
    };
  }

  /* ---------------------------------------------------------
     5. 빗면 — 마찰력의 **방향**
        학습지 :
          · 빗면에서 물체가 밑으로 미끄러질 때는 미끄러지는 것을 방해한다
          · 빗면에서 물체를 위로 끌어올릴 때는 위로 올라오는 것을 방해한다
        즉 마찰력은 **운동(하려는) 방향의 반대**다. 부호 하나로 다룬다.
     --------------------------------------------------------- */
  function frictionDirection(motionKey) {
    /* motionKey : "down"(미끄러져 내려감) | "up"(끌어올림) */
    return motionKey === "down"
      ? { sign: +1, text: "빗면 위쪽", why: "미끄러져 내려가는 것을 방해한다" }
      : { sign: -1, text: "빗면 아래쪽", why: "위로 올라오는 것을 방해한다" };
  }

  /* 마찰력은 언제나 운동(하려는) 방향과 **반대**인가 — 검증용 */
  function alwaysOpposite() {
    return ["down", "up"].every(function (k) {
      var d = frictionDirection(k);
      var motion = (k === "down") ? -1 : +1;      // 내려감 −, 올라감 +
      return d.sign === -motion;
    });
  }

  /* ---------------------------------------------------------
     6. 두 가지를 견주기 — 학습지의 「더 잘 미끄러지는 쪽은?」
        한계가 작을수록 잘 미끄러진다.
     --------------------------------------------------------- */
  function slipsMoreEasily(a, b) {
    var la = limitN(a.boxes, a.surface), lb = limitN(b.boxes, b.surface);
    if (Math.abs(la - lb) < 1e-12) return "same";
    return la < lb ? "a" : "b";
  }

  global.Friction = {
    G: G, BLOCK_MASS_G: BLOCK_MASS_G, SURFACES: SURFACES,
    clamp: clamp, round: round,
    surface: surface, weightN: weightN, limitN: limitN,
    frictionN: frictionN, moving: moving, state: state,
    frictionDirection: frictionDirection, alwaysOpposite: alwaysOpposite,
    slipsMoreEasily: slipsMoreEasily
  };
})(window);
