/* ============================================================
   textures.js — 全部材质由 Canvas 程序化生成（不依赖任何外部图片）
   ============================================================ */
(function () {
  const BR = (window.BR = window.BR || {});
  const T = (BR.Textures = {});
  let MAX_ANISO = 4;
  const cache = {};

  function cvs(w, h) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  }

  function rnd(a, b) { return a + Math.random() * (b - a); }

  /* 叠加细颗粒噪点 */
  function grain(g, w, h, amount) {
    const img = g.getImageData(0, 0, w, h);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const n = (Math.random() - 0.5) * amount;
      d[i] += n; d[i + 1] += n; d[i + 2] += n;
    }
    g.putImageData(img, 0, 0);
  }

  /* 可平铺的柔和色斑（在 3x3 偏移上重复绘制） */
  function blob(g, w, h, x, y, r, rgba) {
    for (let ox = -1; ox <= 1; ox++) {
      for (let oy = -1; oy <= 1; oy++) {
        const px = x + ox * w, py = y + oy * h;
        if (px < -r || px > w + r || py < -r || py > h + r) continue;
        const gr = g.createRadialGradient(px, py, 0, px, py, r);
        gr.addColorStop(0, rgba);
        gr.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = gr;
        g.fillRect(px - r, py - r, r * 2, r * 2);
      }
    }
  }

  function toTex(c, opts) {
    opts = opts || {};
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = opts.clamp ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping;
    t.anisotropy = MAX_ANISO;
    if (opts.repeat) t.repeat.set(opts.repeat[0], opts.repeat[1]);
    t.needsUpdate = true;
    return t;
  }

  /* ---------------- 墙纸 ---------------- */
  function wallpaper() {
    const S = 512, c = cvs(S, S), g = c.getContext('2d');
    const base = g.createLinearGradient(0, 0, 0, S);
    base.addColorStop(0, '#cbb87c');
    base.addColorStop(0.45, '#c2ad70');
    base.addColorStop(0.82, '#b8a364');
    base.addColorStop(1, '#a8935a');
    g.fillStyle = base;
    g.fillRect(0, 0, S, S);

    // 靠近天花板的阴影
    const top = g.createLinearGradient(0, 0, 0, 96);
    top.addColorStop(0, 'rgba(38,32,15,0.5)');
    top.addColorStop(0.35, 'rgba(38,32,15,0.18)');
    top.addColorStop(1, 'rgba(38,32,15,0)');
    g.fillStyle = top;
    g.fillRect(0, 0, S, 96);

    // 竖条纹壁纸
    for (let x = 0; x < S; x += 32) {
      g.fillStyle = 'rgba(255,248,210,0.05)';
      g.fillRect(x, 0, 15, S);
      g.fillStyle = 'rgba(92,76,38,0.045)';
      g.fillRect(x + 15, 0, 17, S);
      g.fillStyle = 'rgba(70,56,26,0.06)';
      g.fillRect(x, 0, 1, S);
    }
    // 细密花纹
    for (let y = 20; y < S; y += 44) {
      for (let x = 20; x < S; x += 44) {
        g.fillStyle = 'rgba(120,98,46,0.06)';
        g.beginPath();
        g.ellipse(x, y, 4.5, 2.4, 0.4, 0, Math.PI * 2);
        g.fill();
      }
    }
    // 壁纸接缝
    for (let x = 0; x < S; x += 128) {
      g.fillStyle = 'rgba(64,52,24,0.14)';
      g.fillRect(x, 0, 2, S);
      g.fillStyle = 'rgba(255,244,200,0.06)';
      g.fillRect(x + 2, 0, 1, S);
    }
    // 霉斑 / 水渍
    for (let i = 0; i < 16; i++) {
      const x = rnd(0, S), y = rnd(S * 0.35, S), r = rnd(18, 70);
      blob(g, S, S, x, y, r, 'rgba(58,50,24,0.16)');
    }
    for (let i = 0; i < 7; i++) {
      blob(g, S, S, rnd(0, S), rnd(S * 0.55, S), rnd(24, 60), 'rgba(38,50,26,0.13)');
    }
    // 底部踢脚线
    const bb = g.createLinearGradient(0, S - 52, 0, S);
    bb.addColorStop(0, '#8a7a4b');
    bb.addColorStop(0.12, '#736540');
    bb.addColorStop(1, '#4f4629');
    g.fillStyle = bb;
    g.fillRect(0, S - 52, S, 52);
    g.fillStyle = 'rgba(34,29,15,0.7)';
    g.fillRect(0, S - 52, S, 2);
    g.fillStyle = 'rgba(20,17,9,0.3)';
    g.fillRect(0, S - 5, S, 5);
    // 踢脚线上的磕碰
    for (let i = 0; i < 40; i++) {
      g.fillStyle = 'rgba(30,25,12,' + rnd(0.08, 0.25).toFixed(2) + ')';
      g.fillRect(rnd(0, S), S - rnd(4, 50), rnd(1, 8), rnd(1, 2));
    }
    grain(g, S, S, 13);
    return toTex(c, { repeat: [1.6, 1] });
  }

  /* ---------------- 地毯 ---------------- */
  function carpet() {
    const S = 512, c = cvs(S, S), g = c.getContext('2d');
    g.fillStyle = '#6d6448';
    g.fillRect(0, 0, S, S);
    // 大块潮湿色斑
    for (let i = 0; i < 26; i++) {
      blob(g, S, S, rnd(0, S), rnd(0, S), rnd(30, 120), 'rgba(50,44,26,0.16)');
    }
    for (let i = 0; i < 12; i++) {
      blob(g, S, S, rnd(0, S), rnd(0, S), rnd(20, 70), 'rgba(92,86,54,0.13)');
    }
    // 短绒毛与污点
    for (let i = 0; i < 9000; i++) {
      const x = Math.random() * S, y = Math.random() * S;
      const v = rnd(-24, 22) | 0;
      g.fillStyle = 'rgba(' + (109 + v) + ',' + (100 + v) + ',' + (72 + v) + ',0.55)';
      g.fillRect(x, y, rnd(1, 2.6), rnd(1, 2.2));
    }
    // 织纹
    g.globalAlpha = 0.05;
    for (let y = 0; y < S; y += 4) {
      g.fillStyle = y % 8 === 0 ? '#2c2617' : '#c8bc8c';
      g.fillRect(0, y, S, 1);
    }
    g.globalAlpha = 1;
    grain(g, S, S, 20);
    return toTex(c);
  }

  /* ---------------- 天花板 ---------------- */
  function ceiling() {
    const S = 512, c = cvs(S, S), g = c.getContext('2d');
    g.fillStyle = '#bdb69b';
    g.fillRect(0, 0, S, S);
    const tile = S / 4;
    for (let ty = 0; ty < 4; ty++) {
      for (let tx = 0; tx < 4; tx++) {
        const x = tx * tile, y = ty * tile;
        const v = rnd(-7, 7) | 0;
        g.fillStyle = 'rgb(' + (190 + v) + ',' + (184 + v) + ',' + (158 + v) + ')';
        g.fillRect(x + 3, y + 3, tile - 6, tile - 6);
        // 吸音板小孔
        g.fillStyle = 'rgba(110,104,82,0.30)';
        for (let py = 10; py < tile - 8; py += 9) {
          for (let px = 10; px < tile - 8; px += 9) {
            if (Math.random() > 0.55) g.fillRect(x + px, y + py, 1.4, 1.4);
          }
        }
        // 边缘阴影
        g.strokeStyle = 'rgba(90,84,64,0.30)';
        g.lineWidth = 1;
        g.strokeRect(x + 3.5, y + 3.5, tile - 7, tile - 7);
        // 污渍
        if (Math.random() < 0.45) {
          blob(g, S, S, x + rnd(20, tile - 20), y + rnd(20, tile - 20), rnd(14, 44), 'rgba(72,62,34,0.16)');
        }
      }
    }
    // 龙骨
    g.fillStyle = 'rgba(96,90,70,0.55)';
    for (let i = 0; i <= 4; i++) {
      g.fillRect(i * tile - 1.5, 0, 3, S);
      g.fillRect(0, i * tile - 1.5, S, 3);
    }
    // 水渍
    for (let i = 0; i < 10; i++) {
      blob(g, S, S, rnd(0, S), rnd(0, S), rnd(26, 90), 'rgba(96,74,36,0.12)');
    }
    grain(g, S, S, 12);
    return toTex(c);
  }

  /* ---------------- 金属 ---------------- */
  function metal(dark) {
    const S = 256, c = cvs(S, S), g = c.getContext('2d');
    g.fillStyle = dark ? '#3c3d3a' : '#6d6e69';
    g.fillRect(0, 0, S, S);
    // 拉丝
    for (let i = 0; i < 700; i++) {
      const y = Math.random() * S;
      g.strokeStyle = 'rgba(' + (dark ? '200,205,195' : '235,238,225') + ',' + rnd(0.02, 0.09).toFixed(3) + ')';
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(S, y + rnd(-1, 1));
      g.stroke();
    }
    // 锈斑
    for (let i = 0; i < 12; i++) {
      blob(g, S, S, rnd(0, S), rnd(0, S), rnd(8, 34), 'rgba(110,62,30,0.20)');
    }
    // 铆钉
    for (let x = 24; x < S; x += 64) {
      for (let y = 24; y < S; y += 64) {
        g.fillStyle = 'rgba(20,20,18,0.35)';
        g.beginPath(); g.arc(x, y, 2.6, 0, 6.283); g.fill();
        g.fillStyle = 'rgba(230,232,220,0.10)';
        g.beginPath(); g.arc(x - 0.8, y - 0.8, 1.1, 0, 6.283); g.fill();
      }
    }
    grain(g, S, S, 12);
    return toTex(c);
  }

  /* ---------------- 木箱 ---------------- */
  function wood() {
    const S = 256, c = cvs(S, S), g = c.getContext('2d');
    g.fillStyle = '#8a6b42';
    g.fillRect(0, 0, S, S);
    for (let y = 0; y < S; y += 64) {
      g.fillStyle = 'rgba(60,42,22,0.25)';
      g.fillRect(0, y, S, 2);
      for (let i = 0; i < 30; i++) {
        g.strokeStyle = 'rgba(' + (60 + rnd(-10, 30) | 0) + ',' + (44 + rnd(-10, 20) | 0) + ',22,0.15)';
        g.beginPath();
        g.moveTo(0, y + rnd(6, 58));
        g.bezierCurveTo(S * 0.3, y + rnd(0, 64), S * 0.7, y + rnd(0, 64), S, y + rnd(6, 58));
        g.stroke();
      }
    }
    // 钉子
    g.fillStyle = 'rgba(30,28,24,0.5)';
    for (let x = 16; x < S; x += 78) {
      for (let y = 16; y < S; y += 64) {
        g.beginPath(); g.arc(x, y, 2.2, 0, 6.283); g.fill();
      }
    }
    // 污渍
    for (let i = 0; i < 8; i++) blob(g, S, S, rnd(0, S), rnd(0, S), rnd(10, 40), 'rgba(40,30,14,0.18)');
    grain(g, S, S, 16);
    return toTex(c);
  }

  /* ---------------- 纸 ---------------- */
  function paper() {
    const S = 256, c = cvs(S, S), g = c.getContext('2d');
    g.fillStyle = '#e9e0c6';
    g.fillRect(0, 0, S, S);
    for (let i = 0; i < 14; i++) blob(g, S, S, rnd(0, S), rnd(0, S), rnd(6, 40), 'rgba(150,124,70,0.10)');
    g.strokeStyle = 'rgba(90,74,42,0.12)';
    g.lineWidth = 1;
    for (let y = 40; y < S; y += 26) {
      g.beginPath(); g.moveTo(18, y); g.lineTo(S - 18, y); g.stroke();
    }
    grain(g, S, S, 9);
    return toTex(c, { clamp: true });
  }

  /* ---------------- 杏仁水标签 ---------------- */
  function waterLabel() {
    const W = 128, H = 192, c = cvs(W, H), g = c.getContext('2d');
    g.fillStyle = '#eae3cd';
    g.fillRect(0, 0, W, H);
    g.fillStyle = '#a8352a';
    g.fillRect(0, 16, W, 24);
    g.fillStyle = '#f2ebd6';
    g.font = 'bold 15px "Microsoft YaHei", sans-serif';
    g.textAlign = 'center';
    g.fillText('杏仁水', W / 2, 34);
    g.fillStyle = '#3a3226';
    g.font = 'bold 22px "Microsoft YaHei", sans-serif';
    g.fillText('杏', W / 2, 82);
    g.fillText('仁', W / 2, 110);
    g.fillText('水', W / 2, 138);
    g.font = '8px monospace';
    g.fillStyle = '#6b5e42';
    g.fillText('ALMOND WATER', W / 2, 158);
    g.fillText('1998 · 250ml', W / 2, 172);
    g.strokeStyle = 'rgba(120,100,60,0.35)';
    g.strokeRect(4, 4, W - 8, H - 8);
    for (let i = 0; i < 10; i++) blob(g, W, H, rnd(0, W), rnd(0, H), rnd(4, 18), 'rgba(120,96,50,0.12)');
    return toTex(c, { clamp: true });
  }

  /* ---------------- 灯管面板 ---------------- */
  function lightPanel() {
    const W = 256, H = 128, c = cvs(W, H), g = c.getContext('2d');
    g.fillStyle = '#cfc7a8';
    g.fillRect(0, 0, W, H);
    const gr = g.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, '#fffbe4');
    gr.addColorStop(0.5, '#fff4c8');
    gr.addColorStop(1, '#f6e7ae');
    g.fillStyle = gr;
    g.fillRect(10, 10, W - 20, H - 20);
    g.fillStyle = 'rgba(255,255,240,0.9)';
    g.fillRect(22, 30, W - 44, 18);
    g.fillStyle = 'rgba(255,255,240,0.55)';
    g.fillRect(22, H - 48, W - 44, 18);
    g.strokeStyle = 'rgba(150,140,105,0.7)';
    g.lineWidth = 3;
    g.strokeRect(9, 9, W - 18, H - 18);
    grain(g, W, H, 8);
    return toTex(c, { clamp: true });
  }

  /* ---------------- 电梯门 ---------------- */
  function liftDoor() {
    const W = 256, H = 512, c = cvs(W, H), g = c.getContext('2d');
    const gr = g.createLinearGradient(0, 0, W, 0);
    gr.addColorStop(0, '#6f716a');
    gr.addColorStop(0.35, '#91938b');
    gr.addColorStop(0.55, '#a0a299');
    gr.addColorStop(1, '#686a63');
    g.fillStyle = gr;
    g.fillRect(0, 0, W, H);
    for (let i = 0; i < 800; i++) {
      g.strokeStyle = 'rgba(230,232,220,' + rnd(0.01, 0.06).toFixed(3) + ')';
      const y = Math.random() * H;
      g.beginPath(); g.moveTo(0, y); g.lineTo(W, y + rnd(-1, 1)); g.stroke();
    }
    g.strokeStyle = 'rgba(20,20,18,0.55)';
    g.lineWidth = 2;
    g.strokeRect(10, 10, W - 20, H - 20);
    g.strokeStyle = 'rgba(220,220,205,0.12)';
    g.lineWidth = 1;
    g.strokeRect(14, 14, W - 28, H - 28);
    // 底部警示条
    g.save();
    g.beginPath();
    g.rect(14, H - 54, W - 28, 30);
    g.clip();
    g.fillStyle = '#c9a63c';
    g.fillRect(14, H - 54, W - 28, 30);
    g.fillStyle = '#25241f';
    for (let x = -40; x < W + 40; x += 28) {
      g.beginPath();
      g.moveTo(x, H - 24); g.lineTo(x + 14, H - 54); g.lineTo(x + 26, H - 54); g.lineTo(x + 12, H - 24);
      g.fill();
    }
    g.restore();
    for (let i = 0; i < 16; i++) blob(g, W, H, rnd(0, W), rnd(0, H), rnd(8, 40), 'rgba(96,60,28,0.16)');
    grain(g, W, H, 10);
    return toTex(c, { clamp: true });
  }

  /* ---------------- 电梯标牌 ---------------- */
  function liftSign() {
    const W = 512, H = 128, c = cvs(W, H), g = c.getContext('2d');
    g.fillStyle = '#14150f';
    g.fillRect(0, 0, W, H);
    g.strokeStyle = 'rgba(150,176,110,0.55)';
    g.lineWidth = 3;
    g.strokeRect(8, 8, W - 16, H - 16);
    g.fillStyle = '#c8e29a';
    g.font = 'bold 44px "Microsoft YaHei", sans-serif';
    g.textAlign = 'center';
    g.fillText('货 运 电 梯', W / 2, 58);
    g.font = '22px monospace';
    g.fillStyle = 'rgba(180,206,146,0.75)';
    g.fillText('SERVICE  LIFT', W / 2, 96);
    grain(g, W, H, 8);
    return toTex(c, { clamp: true });
  }

  /* ---------------- 出口指示牌 ---------------- */
  function exitSign() {
    const W = 256, H = 128, c = cvs(W, H), g = c.getContext('2d');
    g.fillStyle = '#0b1209';
    g.fillRect(0, 0, W, H);
    g.strokeStyle = 'rgba(110,190,120,0.5)';
    g.lineWidth = 4;
    g.strokeRect(6, 6, W - 12, H - 12);
    g.fillStyle = '#9fe08c';
    g.font = 'bold 46px monospace';
    g.textAlign = 'center';
    g.fillText('EXIT', W / 2 - 12, 62);
    g.beginPath();
    g.moveTo(W - 54, 34); g.lineTo(W - 20, 62); g.lineTo(W - 54, 90);
    g.lineTo(W - 54, 74); g.lineTo(W - 92, 74); g.lineTo(W - 92, 50); g.lineTo(W - 54, 50);
    g.closePath();
    g.fill();
    g.font = '16px "Microsoft YaHei", sans-serif';
    g.fillStyle = 'rgba(150,210,140,0.8)';
    g.fillText('安全出口', W / 2, 106);
    grain(g, W, H, 6);
    return toTex(c, { clamp: true });
  }

  /* ---------------- 笑魇的脸 ---------------- */
  function smilerFace() {
    const S = 256, c = cvs(S, S), g = c.getContext('2d');
    g.clearRect(0, 0, S, S);
    g.save();
    g.shadowColor = 'rgba(240,255,220,0.95)';
    g.shadowBlur = 26;
    g.fillStyle = '#f4ffe2';
    g.beginPath();
    g.ellipse(80, 96, 17, 25, -0.18, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.ellipse(178, 96, 17, 25, 0.18, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.lineWidth = 15;
    g.strokeStyle = '#f4ffe2';
    g.arc(S / 2, 132, 66, 0.22, Math.PI - 0.22);
    g.stroke();
    g.restore();
    g.strokeStyle = 'rgba(30,40,20,0.55)';
    g.lineWidth = 2;
    for (let i = -3; i <= 3; i++) {
      const a = Math.PI / 2 + i * 0.28;
      const x = S / 2 + Math.cos(a) * 66;
      const y = 132 + Math.sin(a) * 66;
      g.beginPath();
      g.moveTo(x, y - 7);
      g.lineTo(x, y + 7);
      g.stroke();
    }
    return toTex(c, { clamp: true });
  }

  /* ---------------- 光晕 / 尘埃 ---------------- */
  function glow() {
    const S = 128, c = cvs(S, S), g = c.getContext('2d');
    const gr = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    gr.addColorStop(0, 'rgba(255,248,210,1)');
    gr.addColorStop(0.25, 'rgba(255,238,175,0.55)');
    gr.addColorStop(0.55, 'rgba(230,205,120,0.18)');
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, S, S);
    return toTex(c, { clamp: true });
  }

  function dust() {
    const S = 64, c = cvs(S, S), g = c.getContext('2d');
    const gr = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    gr.addColorStop(0, 'rgba(255,250,225,0.9)');
    gr.addColorStop(0.4, 'rgba(255,240,190,0.28)');
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, S, S);
    return toTex(c, { clamp: true });
  }

  /* ---------------- 污渍 / 水洼 ---------------- */
  function stain() {
    const S = 256, c = cvs(S, S), g = c.getContext('2d');
    for (let i = 0; i < 26; i++) {
      const a = rnd(0.05, 0.2);
      blob(g, S, S, rnd(40, S - 40), rnd(40, S - 40), rnd(12, 62), 'rgba(46,40,22,' + a.toFixed(2) + ')');
    }
    const gr = g.createRadialGradient(S / 2, S / 2, S * 0.15, S / 2, S / 2, S * 0.5);
    gr.addColorStop(0, 'rgba(0,0,0,0)');
    gr.addColorStop(1, 'rgba(0,0,0,1)');
    g.globalCompositeOperation = 'destination-out';
    g.fillStyle = gr;
    g.fillRect(0, 0, S, S);
    g.globalCompositeOperation = 'source-over';
    return toTex(c, { clamp: true });
  }

  function puddle() {
    const S = 256, c = cvs(S, S), g = c.getContext('2d');
    g.fillStyle = 'rgba(26,26,18,0.55)';
    g.beginPath();
    for (let i = 0; i <= 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      const r = 70 + Math.sin(i * 2.7) * 22 + Math.cos(i * 1.3) * 14;
      const x = S / 2 + Math.cos(a) * r;
      const y = S / 2 + Math.sin(a) * r * 0.7;
      if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
    }
    g.closePath();
    g.fill();
    g.strokeStyle = 'rgba(170,170,140,0.16)';
    g.lineWidth = 2;
    g.stroke();
    for (let i = 0; i < 10; i++) {
      blob(g, S, S, rnd(S * 0.25, S * 0.75), rnd(S * 0.3, S * 0.7), rnd(5, 20), 'rgba(220,220,190,0.06)');
    }
    return toTex(c, { clamp: true });
  }

  /* ---------------- 墙面涂鸦 ---------------- */
  function graffiti(text, color) {
    const W = 512, H = 256, c = cvs(W, H), g = c.getContext('2d');
    g.clearRect(0, 0, W, H);
    g.save();
    g.translate(W / 2, H / 2);
    g.rotate(rnd(-0.07, 0.07));
    g.font = 'bold 104px "Microsoft YaHei", sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = color;
    g.globalAlpha = 0.55;
    g.fillText(text, 0, 0);
    g.globalAlpha = 0.2;
    g.filter = 'blur(4px)';
    g.fillText(text, 0, 0);
    g.filter = 'none';
    g.restore();
    g.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 260; i++) {
      g.fillStyle = 'rgba(0,0,0,' + rnd(0.25, 0.9).toFixed(2) + ')';
      g.beginPath();
      g.arc(rnd(0, W), rnd(0, H), rnd(1, 9), 0, 6.283);
      g.fill();
    }
    g.globalCompositeOperation = 'source-over';
    return toTex(c, { clamp: true });
  }

  /* ---------------- 初始化 ---------------- */
  T.init = function (renderer) {
    if (T.ready) return;
    try {
      MAX_ANISO = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    } catch (e) { MAX_ANISO = 4; }

    cache.wallpaper = wallpaper();
    cache.carpet = carpet();
    cache.ceiling = ceiling();
    cache.metal = metal(false);
    cache.metalDark = metal(true);
    cache.wood = wood();
    cache.paper = paper();
    cache.waterLabel = waterLabel();
    cache.lightPanel = lightPanel();
    cache.liftDoor = liftDoor();
    cache.liftSign = liftSign();
    cache.exitSign = exitSign();
    cache.smilerFace = smilerFace();
    cache.glow = glow();
    cache.dust = dust();
    cache.stain = stain();
    cache.puddle = puddle();
    cache.graffiti = [
      graffiti('别回头', '#3a2a18'),
      graffiti('7', '#4a2418'),
      graffiti('NO EXIT', '#5a2018'),
      graffiti('它听见了', '#33280f'),
      graffiti('不要开灯', '#42220f')
    ];
    T.ready = true;
  };

  T.get = function (name) { return cache[name]; };
})();
