/* ============================================================
   audio.js — 全部音效由 WebAudio 实时合成（不依赖任何外部音频文件）
   ============================================================ */
(function () {
  const BR = (window.BR = window.BR || {});

  class AudioEngine {
    constructor() {
      this.ctx = null;
      this.ready = false;
      this.volume = 0.8;
      this.muted = false;
      this.master = null;
      this.amb = null;
      this.noiseBuf = null;
      this.heartT = 0;
      this.whisperT = 6;
      this.eventT = 8;
      this.hound = null;
      this.paused = false;
    }

    init() {
      if (this.ctx) { this.resume(); return; }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      const ctx = new AC();
      this.ctx = ctx;

      this.master = ctx.createGain();
      this.master.gain.value = this.volume;
      this.master.connect(ctx.destination);

      // 白噪声缓冲
      const sr = ctx.sampleRate;
      const buf = ctx.createBuffer(1, sr * 2, sr);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      this.noiseBuf = buf;

      this.buildAmbient();
      this.buildHound();
      this.ready = true;
      this.resume();
    }

    resume() {
      if (!this.ctx) return;
      if (this.ctx.state === 'suspended') this.ctx.resume();
    }

    get t() { return this.ctx ? this.ctx.currentTime : 0; }
    get ok() { return !!(this.ready && this.ctx && !this.muted); }

    setVolume(v) {
      this.volume = v;
      if (this.master) this.master.gain.setTargetAtTime(this.paused ? v * 0.25 : v, this.t, 0.1);
    }

    setMuted(m) {
      this.muted = m;
      if (this.master) this.master.gain.setTargetAtTime(m ? 0 : this.volume, this.t, 0.05);
    }

    setPaused(p) {
      this.paused = p;
      if (this.master) this.master.gain.setTargetAtTime(p ? this.volume * 0.25 : (this.muted ? 0 : this.volume), this.t, 0.15);
    }

    /* ---------------- 环境音 ---------------- */
    buildAmbient() {
      const ctx = this.ctx;
      const amb = ctx.createGain();
      amb.gain.value = 0.9;
      amb.connect(this.master);
      this.amb = amb;

      // 荧光灯嗡鸣：120Hz 锯齿 + 60Hz 正弦 + 240Hz 高频
      const humGain = ctx.createGain();
      humGain.gain.value = 0.055;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 900;
      humGain.connect(lp);
      lp.connect(amb);

      const o1 = ctx.createOscillator();
      o1.type = 'sawtooth';
      o1.frequency.value = 120;
      const g1 = ctx.createGain();
      g1.gain.value = 0.5;
      o1.connect(g1); g1.connect(humGain);
      o1.start();

      const o2 = ctx.createOscillator();
      o2.type = 'sine';
      o2.frequency.value = 60;
      const g2 = ctx.createGain();
      g2.gain.value = 1.1;
      o2.connect(g2); g2.connect(humGain);
      o2.start();

      const o3 = ctx.createOscillator();
      o3.type = 'triangle';
      o3.frequency.value = 241;
      const g3 = ctx.createGain();
      g3.gain.value = 0.16;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 1800;
      bp.Q.value = 2;
      o3.connect(g3); g3.connect(bp); bp.connect(amb);
      o3.start();

      // 缓慢的音量起伏
      const lfo = ctx.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.value = 0.13;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 0.022;
      lfo.connect(lfoGain);
      lfoGain.connect(humGain.gain);
      lfo.start();

      // 房间底噪
      const room = ctx.createBufferSource();
      room.buffer = this.noiseBuf;
      room.loop = true;
      const rlp = ctx.createBiquadFilter();
      rlp.type = 'lowpass';
      rlp.frequency.value = 240;
      const rg = ctx.createGain();
      rg.gain.value = 0.14;
      room.connect(rlp); rlp.connect(rg); rg.connect(amb);
      room.start();
      this.roomNoise = room;

      // 紧张气氛低频
      const tense = ctx.createGain();
      tense.gain.value = 0;
      tense.connect(this.master);
      this.tensionGain = tense;

      const to1 = ctx.createOscillator();
      to1.type = 'sawtooth';
      to1.frequency.value = 46;
      const tlp = ctx.createBiquadFilter();
      tlp.type = 'lowpass';
      tlp.frequency.value = 220;
      const toG = ctx.createGain();
      toG.gain.value = 0.35;
      to1.connect(toG); toG.connect(tlp); tlp.connect(tense);
      to1.start();

      const to2 = ctx.createOscillator();
      to2.type = 'sine';
      to2.frequency.value = 69.5;
      const toG2 = ctx.createGain();
      toG2.gain.value = 0.25;
      to2.connect(toG2); toG2.connect(tense);
      to2.start();

      // 嗡鸣的失谐颤音
      const vibrato = ctx.createOscillator();
      vibrato.frequency.value = 0.37;
      const vibGain = ctx.createGain();
      vibGain.gain.value = 1.4;
      vibrato.connect(vibGain);
      vibGain.connect(to2.frequency);
      vibrato.start();
    }

    /* ---------------- 猎犬低吼层 ---------------- */
    buildHound() {
      const ctx = this.ctx;
      const out = ctx.createGain();
      out.gain.value = 0;
      let pan = null;
      if (ctx.createStereoPanner) {
        pan = ctx.createStereoPanner();
        out.connect(pan);
        pan.connect(this.master);
      } else {
        out.connect(this.master);
      }

      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 380;
      lp.Q.value = 1.2;
      lp.connect(out);

      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = 74;
      const og = ctx.createGain();
      og.gain.value = 0.6;
      o.connect(og); og.connect(lp);
      o.start();

      const o2 = ctx.createOscillator();
      o2.type = 'square';
      o2.frequency.value = 41;
      const o2g = ctx.createGain();
      o2g.gain.value = 0.22;
      o2.connect(o2g); o2g.connect(lp);
      o2.start();

      // 呼吸 / 噪声层
      const n = ctx.createBufferSource();
      n.buffer = this.noiseBuf;
      n.loop = true;
      const nbp = ctx.createBiquadFilter();
      nbp.type = 'bandpass';
      nbp.frequency.value = 520;
      nbp.Q.value = 0.8;
      const ng = ctx.createGain();
      ng.gain.value = 0.4;
      n.connect(nbp); nbp.connect(ng); ng.connect(lp);
      n.start();

      const lfo = ctx.createOscillator();
      lfo.frequency.value = 6.2;
      const lg = ctx.createGain();
      lg.gain.value = 9;
      lfo.connect(lg);
      lg.connect(o.frequency);
      lfo.start();

      this.hound = { out, pan, lp, osc: o };
    }

    /* ---------------- 每帧更新 ---------------- */
    tick(dt, st) {
      if (!this.ok) return;
      const t = this.t;

      // 紧张度
      const tension = Math.max(0, Math.min(1, st.tension || 0));
      if (this.tensionGain) this.tensionGain.gain.setTargetAtTime(tension * 0.16, t, 0.3);

      // 心跳
      this.heartT -= dt;
      if (tension > 0.06 && this.heartT <= 0) {
        const interval = 1.5 - tension * 1.05;
        this.heartT = interval;
        const g = 0.05 + tension * 0.22;
        this.thump(t + 0.01, g);
        this.thump(t + 0.29, g * 0.62);
      }

      // 随机环境事件
      this.eventT -= dt;
      if (this.eventT <= 0) {
        this.eventT = 7 + Math.random() * 16;
        this.ambientEvent();
      }

      // 低语
      if ((st.sanity === undefined ? 100 : st.sanity) < 58) {
        this.whisperT -= dt;
        if (this.whisperT <= 0) {
          this.whisperT = 3.5 + Math.random() * 7;
          this.whisper(Math.random() * 1.6 - 0.8);
        }
      }

      // 猎犬
      if (this.hound) {
        const dist = st.houndDist === undefined ? 999 : st.houndDist;
        const chase = !!st.chasing;
        const active = st.houndActive !== false && dist < 30;
        let g = active ? Math.pow(Math.max(0, 1 - dist / 30), 2) * (chase ? 0.5 : 0.16) : 0;
        this.hound.out.gain.setTargetAtTime(g, t, 0.15);
        if (this.hound.pan) this.hound.pan.pan.setTargetAtTime(Math.max(-1, Math.min(1, st.houndPan || 0)), t, 0.15);
        if (this.hound.lp) this.hound.lp.frequency.setTargetAtTime(chase ? 1100 : 380, t, 0.2);
        if (this.hound.osc) this.hound.osc.frequency.setTargetAtTime(chase ? 96 : 72, t, 0.3);
      }
    }

    /* ---------------- 基础发声 ---------------- */
    tone(freq, dur, type, gain, pan, slideTo) {
      if (!this.ok) return;
      const ctx = this.ctx, t = this.t;
      const o = ctx.createOscillator();
      o.type = type || 'sine';
      o.frequency.setValueAtTime(freq, t);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(gain, t + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g);
      this.route(g, pan);
      o.start(t);
      o.stop(t + dur + 0.02);
    }

    noise(dur, type, freq, q, gain, pan, sweepTo) {
      if (!this.ok) return;
      const ctx = this.ctx, t = this.t;
      const s = ctx.createBufferSource();
      s.buffer = this.noiseBuf;
      s.loop = true;
      s.playbackRate.value = 0.8 + Math.random() * 0.5;
      const f = ctx.createBiquadFilter();
      f.type = type || 'bandpass';
      f.frequency.setValueAtTime(freq, t);
      if (sweepTo) f.frequency.exponentialRampToValueAtTime(Math.max(40, sweepTo), t + dur);
      f.Q.value = q === undefined ? 1 : q;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(gain, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      s.connect(f); f.connect(g);
      this.route(g, pan);
      s.start(t);
      s.stop(t + dur + 0.05);
    }

    route(node, pan) {
      if (pan && this.ctx.createStereoPanner) {
        const p = this.ctx.createStereoPanner();
        p.pan.value = Math.max(-1, Math.min(1, pan));
        node.connect(p);
        p.connect(this.master);
      } else {
        node.connect(this.master);
      }
    }

    thump(t, gain) {
      if (!this.ctx) return;
      const ctx = this.ctx;
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(66, t);
      o.frequency.exponentialRampToValueAtTime(34, t + 0.22);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(gain, t + 0.014);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
      o.connect(g);
      g.connect(this.master);
      o.start(t);
      o.stop(t + 0.32);
    }

    whisper(pan) {
      if (!this.ok) return;
      const ctx = this.ctx, t = this.t;
      const s = ctx.createBufferSource();
      s.buffer = this.noiseBuf;
      s.loop = true;
      s.playbackRate.value = 0.55 + Math.random() * 0.4;
      const f = ctx.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.setValueAtTime(900 + Math.random() * 1400, t);
      f.frequency.linearRampToValueAtTime(1600 + Math.random() * 1800, t + 1.2);
      f.Q.value = 5.5;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.055, t + 0.5);
      g.gain.linearRampToValueAtTime(0.012, t + 1.1);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.9);
      s.connect(f); f.connect(g);
      this.route(g, pan);
      s.start(t);
      s.stop(t + 2);
    }

    ambientEvent() {
      if (!this.ok) return;
      const pan = (Math.random() - 0.5) * 1.4;
      const r = Math.random();
      if (r < 0.3) {
        // 远处的脚步
        const n = 2 + ((Math.random() * 3) | 0);
        for (let i = 0; i < n; i++) {
          setTimeout(() => {
            this.noise(0.12, 'lowpass', 420, 1, 0.03, pan);
            this.tone(58, 0.1, 'sine', 0.02, pan, 40);
          }, i * 340);
        }
      } else if (r < 0.55) {
        // 天花板/管道敲击
        this.tone(150 + Math.random() * 120, 0.35, 'square', 0.018, pan, 70);
        setTimeout(() => this.tone(110, 0.5, 'sine', 0.03, pan, 50), 90);
      } else if (r < 0.78) {
        // 墙体吱呀
        this.noise(1.5, 'bandpass', 260, 4, 0.03, pan, 720);
      } else if (r < 0.92) {
        // 远处重物落地
        this.tone(42, 1.1, 'sine', 0.07, pan, 26);
        this.noise(0.7, 'lowpass', 180, 1, 0.045, pan);
      } else {
        // 灯管电流爆响
        this.noise(0.18, 'highpass', 2600, 1, 0.04, pan);
        this.tone(120, 0.1, 'sawtooth', 0.02, pan, 60);
      }
    }

    /* ---------------- 音效 ---------------- */
    step(kind) {
      if (!this.ok) return;
      const gain = kind === 'sprint' ? 0.13 : kind === 'crouch' ? 0.035 : 0.08;
      this.noise(0.13, 'bandpass', 620 + Math.random() * 420, 1.1, gain, (Math.random() - 0.5) * 0.25);
      this.tone(72 + Math.random() * 18, 0.09, 'sine', gain * 0.65, 0, 46);
    }

    pickup() {
      this.tone(660, 0.09, 'triangle', 0.09);
      setTimeout(() => this.tone(990, 0.14, 'triangle', 0.07), 70);
    }

    drink() {
      this.noise(0.5, 'lowpass', 900, 1, 0.07);
      this.tone(180, 0.25, 'sine', 0.05, 0, 120);
      setTimeout(() => this.tone(150, 0.3, 'sine', 0.04, 0, 90), 260);
    }

    click() { this.tone(1200, 0.04, 'square', 0.03); }

    error() { this.tone(160, 0.22, 'square', 0.05, 0, 110); }

    installClank() {
      this.noise(0.16, 'bandpass', 1600, 2, 0.13);
      this.tone(320, 0.2, 'square', 0.05, 0, 180);
      this.tone(90, 0.3, 'sine', 0.1, 0, 55);
    }

    powerOn() {
      if (!this.ok) return;
      const t = this.t;
      const o = this.ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(45, t);
      o.frequency.exponentialRampToValueAtTime(180, t + 2.2);
      const f = this.ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.setValueAtTime(200, t);
      f.frequency.exponentialRampToValueAtTime(2400, t + 2);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.18, t + 0.4);
      g.gain.exponentialRampToValueAtTime(0.02, t + 2.4);
      o.connect(f); f.connect(g); g.connect(this.master);
      o.start(t); o.stop(t + 2.5);
      this.tone(60, 1.6, 'sine', 0.12, 0, 40);
      this.noise(1.8, 'highpass', 700, 0.8, 0.04);
    }

    doorSlide() {
      this.noise(1.3, 'bandpass', 500, 0.9, 0.09, 0, 160);
      this.tone(50, 1.2, 'sine', 0.08, 0, 36);
      setTimeout(() => this.tone(880, 0.25, 'sine', 0.05), 900);
    }

    beep(freq, dur, gain) {
      this.tone(freq || 880, dur || 0.09, 'sine', gain || 0.05);
    }

    stinger() {
      if (!this.ok) return;
      this.noise(0.9, 'highpass', 900, 0.7, 0.1, 0);
      this.tone(880, 0.9, 'sawtooth', 0.05, 0, 60);
      setTimeout(() => {
        this.tone(120, 1.4, 'sine', 0.18, 0, 42);
        this.noise(1.2, 'lowpass', 400, 1, 0.1);
      }, 90);
    }

    scream() {
      if (!this.ok) return;
      this.tone(420, 0.9, 'sawtooth', 0.12, 0, 90);
      this.noise(1.4, 'bandpass', 1800, 0.8, 0.16, 0, 260);
      setTimeout(() => this.tone(70, 1.8, 'sine', 0.2, 0, 30), 60);
    }

    smilerGone() {
      this.noise(0.6, 'highpass', 2400, 0.9, 0.06, 0, 600);
      this.tone(1400, 0.5, 'sine', 0.03, 0, 320);
    }
  }

  BR.AudioEngine = AudioEngine;
})();
