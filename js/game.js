/* ============================================================
   game.js — 流程控制、UI、理智、结局
   ============================================================ */
(function () {
  const BR = (window.BR = window.BR || {});
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const $ = (id) => document.getElementById(id);

  class Game {
    constructor() {
      this.state = 'boot';
      this.renderer = null;
      this.scene = null;
      this.camera = null;
      this.level = null;
      this.player = null;
      this.hound = null;
      this.smiler = null;
      this.audio = new BR.AudioEngine();

      this.difficulty = 'normal';
      const params = new URLSearchParams(location.search);
      this.debug = params.get('debug') === '1';
      const touchParam = params.get('touch');
      const coarse = window.matchMedia ? window.matchMedia('(pointer: coarse)').matches : false;
      const maxTouch = navigator.maxTouchPoints || 0;
      const ua = navigator.userAgent || '';
      const mobileUA = /Android|iPhone|iPad|iPod|Mobile|Tablet/i.test(ua);
      const iPadOS = navigator.platform === 'MacIntel' && maxTouch > 1;
      const touchCapable = maxTouch > 0 || coarse;
      this.isTouch = touchParam === '1' ? true : touchParam === '0' ? false
        : (((mobileUA || iPadOS) && touchCapable) || (coarse && touchCapable));
      this.locked = false;
      this.settings = { sens: 1, vol: 0.8 };

      this.time = 0;
      this.sanity = 100;
      this.inventory = { fuse: 0, water: 0 };
      this.notesSet = new Set();
      this.notesFound = 0;
      this.waterUsed = 0;

      this.powered = false;
      this.installing = false;
      this.installT = 0;
      this.powerTimer = 0;
      this.powerReady = false;
      this.brownoutTick = 0;

      this.noteOpen = false;
      this.busy = false;
      this.interact = null;
      this.mapVisible = true;
      this.lookPointer = null;
      this.touchRefs = null;
      this.subtitleTimer = 0;
      this.subtitleQueue = [];
      this.toastTimer = 0;
      this.deathTimer = 0;
      this.deathShown = false;
      this.deathCause = '';

      this.houndAlertT = 0;
      this.sanityWarn = 0;
      this.hudT = 0;
      this.mapT = 0;
      this.promptText = '';
      this.invHTML = '';

      this.clock = new THREE.Clock();
      this.skipRender = false;
    }

    /* ==================== 初始化 ==================== */
    init() {
      const canvas = $('scene');
      if (this.isTouch) document.body.classList.add('touch');
      this.renderer = new THREE.WebGLRenderer({
        canvas: canvas, antialias: true, powerPreference: 'high-performance'
      });
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.isTouch ? 1.5 : 1.6));
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      this.renderer.outputColorSpace = THREE.SRGBColorSpace;
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1.0;

      this.scene = new THREE.Scene();
      this.scene.background = new THREE.Color(0x0d0c08);
      this.scene.fog = new THREE.FogExp2(0x3c3520, 0.026);

      this.camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.05, 140);
      this.camera.rotation.order = 'YXZ';
      this.scene.add(this.camera);

      const ambient = new THREE.AmbientLight(0x6e6039, 0.5);
      this.scene.add(ambient);
      const hemi = new THREE.HemisphereLight(0xa08c50, 0x4a4030, 0.34);
      this.scene.add(hemi);
      this.ambient = ambient;

      BR.Textures.init(this.renderer);
      this.buildWorld();
      this.bindUI();
      this.bindInput();
      this.setupTouch();
      this.setupDebug();
      this.setupGrain();
      this.loadSettings();
      if (this.isTouch) {
        this.mapVisible = false;
        $('minimapWrap').classList.add('hidden');
        const mmHint = $('minimapWrap').querySelector('.mm-hint');
        if (mmHint) mmHint.textContent = '点按“图”关闭';
        const sensLabel = $('sensLabel');
        if (sensLabel) sensLabel.textContent = '触屏灵敏度';
      }
      this.updateHUD(true);

      setTimeout(() => {
        const load = $('loading');
        load.style.opacity = '0';
        setTimeout(() => load.classList.add('hidden'), 520);
      }, 220);

      this.animate();

      if (this.debug) {
        setTimeout(() => this.startGame(false), 700);
      }
    }

    buildWorld() {
      if (this.level) this.level.dispose();
      this.level = new BR.Level(this.scene);
      if (!this.player) this.player = new BR.Player(this.camera, this.level, this.audio);
      this.player.level = this.level;
      this.player.audio = this.audio;
      if (!this.hound) this.hound = new BR.Hound(this.scene);
      if (!this.smiler) this.smiler = new BR.Smiler(this.scene);
      this.hound.reset();
      this.smiler.reset();
    }

    setupGrain() {
      const c = document.createElement('canvas');
      c.width = 128; c.height = 128;
      const g = c.getContext('2d');
      const img = g.createImageData(128, 128);
      const d = img.data;
      for (let i = 0; i < d.length; i += 4) {
        const v = Math.random() * 255;
        d[i] = v; d[i + 1] = v; d[i + 2] = v; d[i + 3] = 255;
      }
      g.putImageData(img, 0, 0);
      const grain = $('grain');
      grain.style.backgroundImage = 'url(' + c.toDataURL() + ')';
      grain.style.backgroundSize = '128px 128px';
    }

    /* ==================== 界面绑定 ==================== */
    bindUI() {
      const self = this;
      const diffBtns = document.querySelectorAll('.diff-btn');
      diffBtns.forEach(function (b) {
        b.addEventListener('click', function () {
          diffBtns.forEach(function (x) { x.classList.remove('active'); });
          b.classList.add('active');
          self.difficulty = b.getAttribute('data-diff');
        });
      });

      $('startBtn').addEventListener('click', function () {
        self.audio.init();
        self.startGame(!self.isTouch);
      });

      $('resumeBtn').addEventListener('click', function () { self.resume(); });
      $('restartBtn').addEventListener('click', function () { self.restart(); });
      $('quitBtn').addEventListener('click', function () { self.toMenu(); });
      $('retryBtn').addEventListener('click', function () { self.restart(); });
      $('deathMenuBtn').addEventListener('click', function () { self.toMenu(); });
      $('againBtn').addEventListener('click', function () { self.restart(); });
      $('endingMenuBtn').addEventListener('click', function () { self.toMenu(); });

      $('noteCloseBtn').addEventListener('click', function () { self.closeNote(); });
      $('note').addEventListener('pointerdown', function (e) {
        if (e.target === $('note')) self.closeNote();
      });
      $('prompt').addEventListener('pointerdown', function (e) {
        if (!self.isTouch) return;
        e.preventDefault();
        self.doInteract();
      });

      $('sensRange').addEventListener('input', function (e) {
        self.settings.sens = parseFloat(e.target.value);
        $('sensVal').textContent = self.settings.sens.toFixed(2);
        if (self.player) self.player.lookSens = self.settings.sens;
        self.saveSettings();
      });
      $('volRange').addEventListener('input', function (e) {
        self.settings.vol = parseFloat(e.target.value);
        $('volVal').textContent = Math.round(self.settings.vol * 100);
        self.audio.setVolume(self.settings.vol);
        self.saveSettings();
      });

      $('minimapWrap').addEventListener('click', function () { self.toggleMap(); });

      window.addEventListener('resize', function () {
        self.camera.aspect = window.innerWidth / window.innerHeight;
        self.camera.updateProjectionMatrix();
        self.renderer.setSize(window.innerWidth, window.innerHeight);
      });

      this.renderer.domElement.addEventListener('click', function () {
        if (self.isTouch) return;
        if (self.state === 'playing' && !self.locked && !self.debug) self.requestLock();
      });

      document.addEventListener('pointerlockchange', function () {
        const el = document.pointerLockElement;
        self.locked = el === self.renderer.domElement;
        if (!self.locked && self.state === 'playing' && !self.debug && !self.isTouch) self.pause();
      });

      if (this.isTouch) {
        document.addEventListener('contextmenu', function (e) { e.preventDefault(); });
      }
    }

    loadSettings() {
      try {
        const raw = localStorage.getItem('backrooms_settings');
        if (raw) {
          const s = JSON.parse(raw);
          if (s.sens) this.settings.sens = s.sens;
          if (s.vol !== undefined) this.settings.vol = s.vol;
        }
      } catch (e) { /* ignore */ }
      this.player.lookSens = this.settings.sens;
      this.audio.volume = this.settings.vol;
      $('sensRange').value = this.settings.sens;
      $('sensVal').textContent = this.settings.sens.toFixed(2);
      $('volRange').value = this.settings.vol;
      $('volVal').textContent = Math.round(this.settings.vol * 100);
      this.audio.setVolume(this.settings.vol);
    }

    saveSettings() {
      try {
        localStorage.setItem('backrooms_settings', JSON.stringify(this.settings));
      } catch (e) { /* ignore */ }
    }

    /* ==================== 输入 ==================== */
    bindInput() {
      const self = this;
      window.addEventListener('keydown', function (e) {
        if (e.code === 'Tab') e.preventDefault();
        if (self.state !== 'playing') {
          if (e.code === 'Escape' && self.state === 'paused') self.resume();
          return;
        }
        if (self.noteOpen) {
          if (e.code === 'KeyE' || e.code === 'Escape') self.closeNote();
          return;
        }
        if (e.code === 'KeyE') { self.doInteract(); return; }
        if (e.code === 'KeyF') {
          const on = self.player.toggleFlashlight();
          self.toast(on ? '手电筒 · 开' : '手电筒 · 关');
          return;
        }
        if (e.code === 'KeyM') { self.toggleMap(); return; }
        if (e.code === 'Digit1') { self.drinkWater(); return; }
        if (e.code === 'Escape') { self.pause(); return; }
        self.player.setKey(e.code, true);
      });

      window.addEventListener('keyup', function (e) {
        if (self.player) self.player.setKey(e.code, false);
      });

      window.addEventListener('blur', function () {
        if (self.player) self.player.keys = {};
      });

      this.lookPointer = null;
      this.dragX = 0;
      this.dragY = 0;
      const canvasEl = this.renderer.domElement;

      canvasEl.addEventListener('pointerdown', function (e) {
        if (self.state !== 'playing' || self.noteOpen) return;
        if (self.lookPointer !== null) return;
        self.lookPointer = e.pointerId;
        self.dragX = e.clientX;
        self.dragY = e.clientY;
        if (e.pointerType === 'touch') {
          if (e.cancelable) e.preventDefault();
          try { canvasEl.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
        }
      });

      window.addEventListener('pointermove', function (e) {
        if (e.pointerId !== self.lookPointer) return;
        if (self.state !== 'playing' || self.noteOpen || self.locked) return;
        const dx = e.clientX - self.dragX;
        const dy = e.clientY - self.dragY;
        self.dragX = e.clientX;
        self.dragY = e.clientY;
        const f = e.pointerType === 'touch' ? 1.35 : 1;
        self.player.look(dx * f, dy * f);
      });

      function releaseLook(e) {
        if (e.pointerId === self.lookPointer) self.lookPointer = null;
      }
      window.addEventListener('pointerup', releaseLook);
      window.addEventListener('pointercancel', releaseLook);

      document.addEventListener('mousemove', function (e) {
        if (!self.locked || self.state !== 'playing' || self.noteOpen) return;
        self.player.look(e.movementX || 0, e.movementY || 0);
      });
    }

    /* ==================== 触屏操作 ==================== */
    setupTouch() {
      if (!this.isTouch) return;
      const self = this;
      const refs = {
        stick: $('stick'), knob: $('stickKnob'),
        sprint: $('tSprint'), flash: $('tFlash'), drink: $('tDrink'),
        crouch: $('tCrouch'), interact: $('tInteract'), map: $('tMap'), pause: $('tPause')
      };
      this.touchRefs = refs;

      let stickId = null;
      let cx = 0, cy = 0;
      const R = 52;
      const applyStick = function (dx, dy) {
        const len = Math.hypot(dx, dy);
        if (len > R) { dx *= R / len; dy *= R / len; }
        refs.knob.style.transform = 'translate(' + dx.toFixed(1) + 'px,' + dy.toFixed(1) + 'px)';
        let nx = dx / R;
        let ny = -dy / R;
        if (Math.hypot(nx, ny) < 0.16) { nx = 0; ny = 0; }
        if (self.player) {
          self.player.touchMove.x = nx;
          self.player.touchMove.y = ny;
        }
      };
      const resetStick = function () {
        stickId = null;
        refs.knob.style.transform = 'translate(0px,0px)';
        refs.stick.classList.remove('active');
        if (self.player) {
          self.player.touchMove.x = 0;
          self.player.touchMove.y = 0;
        }
      };

      refs.stick.addEventListener('pointerdown', function (e) {
        if (stickId !== null) return;
        stickId = e.pointerId;
        try { refs.stick.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
        const r = refs.stick.getBoundingClientRect();
        cx = r.left + r.width / 2;
        cy = r.top + r.height / 2;
        refs.stick.classList.add('active');
        if (e.cancelable) e.preventDefault();
        applyStick(e.clientX - cx, e.clientY - cy);
      });
      refs.stick.addEventListener('pointermove', function (e) {
        if (e.pointerId !== stickId) return;
        if (e.cancelable) e.preventDefault();
        applyStick(e.clientX - cx, e.clientY - cy);
      });
      const endStick = function (e) {
        if (e.pointerId === stickId) resetStick();
      };
      refs.stick.addEventListener('pointerup', endStick);
      refs.stick.addEventListener('pointercancel', endStick);
      refs.stick.addEventListener('lostpointercapture', function () {
        if (stickId !== null) resetStick();
      });

      function bindTap(el, fn) {
        if (!el) return;
        el.addEventListener('pointerdown', function (e) {
          if (e.cancelable) e.preventDefault();
          el.classList.add('pressed');
          try { el.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
          fn();
        });
        const up = function () { el.classList.remove('pressed'); };
        el.addEventListener('pointerup', up);
        el.addEventListener('pointercancel', up);
        el.addEventListener('lostpointercapture', up);
      }

      bindTap(refs.interact, function () { self.doInteract(); });
      bindTap(refs.flash, function () {
        if (self.state !== 'playing' || self.noteOpen) return;
        const on = self.player.toggleFlashlight();
        self.toast(on ? '手电筒 · 开' : '手电筒 · 关');
        refs.flash.classList.toggle('active', on);
      });
      bindTap(refs.drink, function () { self.drinkWater(); });
      bindTap(refs.crouch, function () {
        if (self.state !== 'playing' || self.noteOpen) return;
        self.player.touchCrouch = !self.player.touchCrouch;
        refs.crouch.classList.toggle('active', self.player.touchCrouch);
      });
      bindTap(refs.map, function () { self.toggleMap(); });
      bindTap(refs.pause, function () { self.pause(); });

      refs.sprint.addEventListener('pointerdown', function (e) {
        if (e.cancelable) e.preventDefault();
        try { refs.sprint.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
        refs.sprint.classList.add('pressed');
        if (self.state === 'playing' && !self.noteOpen) {
          self.player.touchSprint = true;
          refs.sprint.classList.add('active');
        }
      });
      const endSprint = function () {
        refs.sprint.classList.remove('pressed');
        if (self.player) self.player.touchSprint = false;
        if (self.player && !self.player.sprinting) refs.sprint.classList.remove('active');
      };
      refs.sprint.addEventListener('pointerup', endSprint);
      refs.sprint.addEventListener('pointercancel', endSprint);
      refs.sprint.addEventListener('lostpointercapture', endSprint);

      window.addEventListener('blur', resetStick);
    }

    resetTouchInput() {
      if (!this.isTouch) return;
      if (this.player) {
        this.player.touchMove.x = 0;
        this.player.touchMove.y = 0;
        this.player.touchSprint = false;
      }
      const r = this.touchRefs;
      if (r) {
        r.knob.style.transform = 'translate(0px,0px)';
        r.stick.classList.remove('active');
        r.sprint.classList.remove('pressed', 'active');
      }
      this.lookPointer = null;
    }

    updateTouchUI() {
      if (!this.isTouch || !this.touchRefs) return;
      const r = this.touchRefs;
      const p = this.player;
      if (!p) return;
      r.flash.classList.toggle('active', !!p.flashlightOn);
      r.crouch.classList.toggle('active', !!p.touchCrouch);
      r.sprint.classList.toggle('active', !!p.touchSprint && p.moving);
      r.map.classList.toggle('active', this.mapVisible);
      r.drink.classList.toggle('disabled', this.inventory.water <= 0);
    }

    requestLock() {
      const el = this.renderer.domElement;
      try {
        const p = el.requestPointerLock();
        if (p && p.catch) p.catch(function () { });
      } catch (e) { /* ignore */ }
    }

    /* ==================== 流程 ==================== */
    startGame(lock) {
      this.audio.init();
      this.resetRun(true);
      const nightmare = this.difficulty === 'nightmare';
      this.sanityDrainMult = nightmare ? 1.4 : 1;
      this.hound.nightmare = nightmare;
      this.player.batteryDrain = nightmare ? 1.85 : 1.35;
      this.state = 'playing';
      this.audio.setPaused(false);
      $('boot').classList.add('hidden');
      $('loading').classList.add('hidden');
      $('hud').classList.add('visible');
      this.player.reset(this.level.spawnPos, this.level.spawnYaw);
      this.resetTouchInput();
      this.planIntro();
      this.updateObjective(true);
      this.updateHUD(true);
      this.updateTouchUI();
      if (lock && !this.isTouch) this.requestLock();
    }

    planIntro() {
      this.subtitleQueue = [];
      this.say('……你从现实的缝隙里切了出去。', 0.8, 4.0);
      this.say('荧光灯在头顶嗡鸣，地毯是潮的。空气里有一股铁锈味。', 5.0, 4.4);
      this.say('找到三枚保险丝，修复走廊尽头的货运电梯。', 9.8, 4.6);
      this.say('别跑。它听得见。', 14.8, 3.6);
    }

    resetRun(newMaze) {
      if (newMaze) this.buildWorld();
      this.inventory = { fuse: 0, water: 0 };
      this.notesSet = new Set();
      this.notesFound = 0;
      this.waterUsed = 0;
      this.sanity = 100;
      this.time = 0;
      this.powered = false;
      this.installing = false;
      this.installT = 0;
      this.powerTimer = 0;
      this.powerReady = false;
      this.brownoutTick = 0;
      this.noteOpen = false;
      this.busy = false;
      this.interact = null;
      this.subtitleQueue = [];
      this.subtitleTimer = 0;
      this.deathTimer = 0;
      this.deathShown = false;
      this.houndAlertT = 0;
      this.sanityWarn = 0;
      this.hints = {};
      this.invHTML = '';
      this.promptText = '';
      $('note').classList.add('hidden');
      $('prompt').classList.remove('show');
      $('crosshair').classList.remove('active');
      $('subtitle').classList.remove('show');
      $('sequence').classList.add('hidden');
      $('installBar').classList.add('hidden');
      $('fade').classList.remove('on', 'white');
      $('hitflash').classList.remove('fire');
      $('insanity').classList.remove('low', 'critical');
      $('toast').classList.remove('show');
      this.hound.reset();
      this.smiler.reset();
      this.level.setFuseLamps(0);
      this.level.brownout = 0;
      this.level.explored.fill(0);
      if (this.player) this.player.insanity = 0;
      this.mapVisible = !this.isTouch;
      $('minimapWrap').classList.toggle('hidden', !this.mapVisible);
      this.resetTouchInput();
    }

    pause() {
      if (this.state !== 'playing') return;
      this.state = 'paused';
      this.audio.setPaused(true);
      $('pause').classList.remove('hidden');
      $('prompt').classList.remove('show');
      this.resetTouchInput();
      if (document.pointerLockElement) {
        try { document.exitPointerLock(); } catch (e) { /* ignore */ }
      }
    }

    resume() {
      if (this.state !== 'paused') return;
      this.state = 'playing';
      $('pause').classList.add('hidden');
      this.audio.setPaused(false);
      this.audio.resume();
      if (!this.debug && !this.isTouch) this.requestLock();
      this.clock.getDelta();
      this.updateTouchUI();
    }

    restart() {
      $('pause').classList.add('hidden');
      $('death').classList.add('hidden');
      $('ending').classList.add('hidden');
      $('boot').classList.add('hidden');
      this.audio.setPaused(false);
      this.startGame(!this.debug && !this.isTouch);
    }

    toMenu() {
      $('pause').classList.add('hidden');
      $('death').classList.add('hidden');
      $('ending').classList.add('hidden');
      $('note').classList.add('hidden');
      $('hud').classList.remove('visible');
      $('boot').classList.remove('hidden');
      this.state = 'boot';
      this.noteOpen = false;
      this.buildWorld();
      this.audio.setPaused(true);
      $('fade').classList.remove('on', 'white');
      $('insanity').classList.remove('low', 'critical');
      $('hitflash').classList.remove('fire');
      if (document.pointerLockElement) {
        try { document.exitPointerLock(); } catch (e) { /* ignore */ }
      }
    }

    /* ==================== 菜单镜头 ==================== */
    updateMenu(dt) {
      const t = performance.now() * 0.00016;
      const c = this.level.spawnCell;
      const center = this.level.cellToWorld(c.x, c.z);
      const cam = this.camera;
      cam.position.set(
        center.x + Math.sin(t * 1.7) * 2.3,
        1.7 + Math.sin(t * 0.9) * 0.06,
        center.z + 1.6 + Math.cos(t * 1.7) * 0.9
      );
      cam.lookAt(center.x, 1.45, center.z - 2.6);
      if (cam.fov !== 72) {
        cam.fov = 72;
        cam.updateProjectionMatrix();
      }
      this.level.update(dt, cam.position);
    }

    /* ==================== 主循环更新 ==================== */
    updatePlaying(dt) {
      this.time += dt;
      const p = this.player;
      const lvl = this.level;
      const h = this.hound;

      if (this.houndAlertT > 0) this.houndAlertT -= dt;

      if (!this.noteOpen && !this.busy) p.update(dt);
      else p.applyCamera();

      if (this.installing) this.updateInstall(dt);

      lvl.update(dt, p.pos);
      h.update(dt, p, lvl, this);
      this.smiler.update(dt, lvl, p, this);

      // ---------- 理智 ----------
      const light = lvl.getLightAt(p.pos);
      let rate = -0.22;
      if (light > 0.18) rate += 0.52 * Math.min(1, light);
      if (p.flashlightOn && p.flashIntensity > 0.3) rate += 0.1;
      if (h.state !== 'dormant') {
        if (h.state === 'chase' && h.dist < 18) rate -= 1.15 * (1 - h.dist / 18);
        else if (h.dist < 14) rate -= 0.5 * (1 - h.dist / 14);
      }
      if (this.powerTimer > 0) rate -= 0.2;
      if (rate < 0) rate *= (this.sanityDrainMult || 1);
      this.sanity = clamp(this.sanity + rate * dt, 0, 100);
      p.insanity = clamp((58 - this.sanity) / 58, 0, 1);
      this.updateSanityFX();

      // ---------- 交互 ----------
      this.interact = (this.noteOpen || this.busy) ? null : p.getInteract(lvl.interactables);
      this.updatePrompt();

      // ---------- 流程提示 ----------
      if (p.sprinting && !this.hints.sprint) {
        this.hints.sprint = true;
        this.say('奔跑的声音会顺着走廊传得很远。', 0.4, 3.4);
      }
      if (this.time > 22 && !p.flashlightOn && !this.hints.flash) {
        this.hints.flash = true;
        this.say(this.isTouch ? '打开手电按钮。电池不多，省着用。' : '按 F 打开手电筒。电池不多，省着用。', 0.6, 4.2);
      }
      if (this.time > 85 && this.inventory.fuse === 0 && !this.hints.fuse) {
        this.hints.fuse = true;
        this.say('保险丝会发出很淡的橙光。留意墙角。', 1.2, 4.2);
      }
      if (this.time > 210 && !this.hints.map) {
        this.hints.map = true;
        this.say(this.isTouch ? '点右上角的“图”，查看走过的地方。绿色方块是电梯。' : '按 M 查看已经走过的地方。绿色方块是电梯。', 0.8, 4.4);
      }
      if (this.time > 330 && this.inventory.fuse < 3 && !this.hints.late) {
        this.hints.late = true;
        this.audio.whisper((Math.random() - 0.5) * 1.2);
        this.say('你已经在这层楼里走了很久。别相信墙上的接缝。', 0.6, 4.2);
      }

      // ---------- 字幕 / 提示 ----------
      this.updateSubtitles(dt);
      if (this.toastTimer > 0) {
        this.toastTimer -= dt;
        if (this.toastTimer <= 0) $('toast').classList.remove('show');
      }

      // ---------- 供电倒计时 ----------
      if (this.powerTimer > 0) {
        this.powerTimer -= dt;
        this.brownoutTick -= dt;
        if (this.brownoutTick <= 0) {
          this.brownoutTick = 3.2;
          lvl.setBrownout(2.4);
        }
        const seqTime = $('sequence').querySelector('.seq-time');
        seqTime.textContent = Math.max(0, Math.ceil(this.powerTimer));
        if (this.powerTimer <= 0) this.onPowerReady();
      }

      // ---------- 死亡判定 ----------
      if (this.isTouch && this.mapVisible && h.state === 'chase' && h.dist < 14) {
        this.mapVisible = false;
        $('minimapWrap').classList.add('hidden');
      }
      if (this.noteOpen && h.state === 'chase' && h.dist < 10) this.closeNote();
      if (h.state === 'chase' && h.dist < 8) {
        p.addShake(0.11 * dt * (1 - h.dist / 8));
      }
      if (h.state === 'chase' && h.dist < 1.25) { this.die('hound'); return; }
      if (this.sanity <= 0.4) { this.die('sanity'); return; }

      // ---------- 音频 ----------
      let tension = 0;
      if (h.state !== 'dormant') {
        tension = h.state === 'chase'
          ? clamp(0.62 + 0.38 * (1 - h.dist / 26), 0, 1)
          : clamp(0.14 * (1 - h.dist / 28), 0, 1);
      }
      tension = Math.max(tension, clamp((55 - this.sanity) / 150, 0, 0.45));
      const dx = h.pos.x - p.pos.x, dz = h.pos.z - p.pos.z;
      const distH = Math.max(1.2, Math.hypot(dx, dz));
      const pan = clamp((dx * Math.cos(p.yaw) + dz * (-Math.sin(p.yaw))) / distH, -1, 1);
      this.audio.tick(dt, {
        tension: tension,
        sanity: this.sanity,
        houndDist: h.dist,
        houndPan: pan,
        chasing: h.state === 'chase',
        houndActive: h.state !== 'dormant'
      });

      // ---------- HUD ----------
      this.hudT -= dt;
      if (this.hudT <= 0) {
        this.hudT = 0.1;
        this.updateHUD();
        this.updateObjective();
      }
      this.mapT -= dt;
      if (this.mapT <= 0) {
        this.mapT = 0.12;
        if (this.mapVisible) this.drawMap();
      }
    }

    updateSanityFX() {
      const el = $('insanity');
      if (this.sanity < 18) {
        el.classList.add('critical');
        el.classList.remove('low');
      } else if (this.sanity < 45) {
        el.classList.add('low');
        el.classList.remove('critical');
      } else {
        el.classList.remove('low', 'critical');
      }

      const stage = this.sanity < 15 ? 3 : this.sanity < 35 ? 2 : this.sanity < 60 ? 1 : 0;
      if (stage > this.sanityWarn) {
        this.sanityWarn = stage;
        const lines = ['', '你的指尖开始发麻。找点光。', '墙纸的花纹在呼吸。喝杏仁水。', '你听见自己的名字从墙里传出来。'];
        this.say(lines[stage], 0, 4);
        this.audio.whisper((Math.random() - 0.5) * 1.6);
      }
    }

    /* ==================== 交互 ==================== */
    doInteract() {
      if (this.noteOpen) { this.closeNote(); return; }
      if (this.busy || this.state !== 'playing') return;
      const it = this.interact;
      if (!it) return;
      if (it.kind === 'note') { this.openNote(it); return; }
      if (it.kind === 'lift') { this.useLift(); return; }
      if (it.kind === 'elevator') { this.escape(); return; }
      this.pickupItem(it);
    }

    pickupItem(it) {
      const item = it.item;
      if (!item || item.collected) return;
      this.level.collectItem(item);
      this.audio.pickup();

      if (it.kind === 'fuse') {
        this.inventory.fuse++;
        this.level.setFuseLamps(this.inventory.fuse);
        this.toast('保险丝 · ' + this.inventory.fuse + ' / 3');
        if (this.inventory.fuse === 1) {
          this.hound.setAggression(1, this.level, this.player.pos);
          this.audio.stinger();
          this.player.addShake(0.4);
          this.say('墙的另一边传来一声很长的呼吸。它醒了。', 1.1, 4.4);
        } else if (this.inventory.fuse === 2) {
          this.hound.setAggression(2, this.level, this.player.pos);
          this.say('它的脚步比刚才更近了。', 0.7, 3.6);
        } else {
          this.hound.setAggression(3, this.level, this.player.pos);
          this.say('最后一步：回到电梯，把保险丝装进去。', 0.6, 4.2);
        }
        this.updateObjective(true);
      } else       if (it.kind === 'water') {
        this.inventory.water++;
        this.toast(this.isTouch ? '杏仁水 · 点“水”饮用' : '杏仁水 · 按 1 饮用');
      } else if (it.kind === 'battery') {
        this.player.addBattery(55);
        this.toast('电池 · 手电电量 +55%');
      }
      this.updateHUD(true);
    }

    openNote(it) {
      const item = it.item;
      const idx = item.data.noteIndex;
      if (!this.notesSet.has(idx)) {
        this.notesSet.add(idx);
        this.notesFound++;
      }
      this.level.collectItem(item);
      this.audio.pickup();
      this.noteOpen = true;
      this.player.keys = {};
      this.resetTouchInput();
      $('noteIndex').textContent = this.level.noteTexts[idx].title;
      $('noteText').textContent = this.level.noteTexts[idx].text;
      $('note').classList.remove('hidden');
      $('prompt').classList.remove('show');
      this.updateHUD(true);
    }

    closeNote() {
      this.noteOpen = false;
      $('note').classList.add('hidden');
      $('prompt').classList.remove('show');
      this.audio.click();
      this.updateTouchUI();
    }

    drinkWater() {
      if (this.state !== 'playing' || this.noteOpen || this.busy) return;
      if (this.inventory.water <= 0) {
        this.toast('没有杏仁水了');
        this.audio.error();
        return;
      }
      this.inventory.water--;
      this.waterUsed++;
      this.sanity = clamp(this.sanity + 42, 0, 100);
      this.player.insanity = clamp((58 - this.sanity) / 58, 0, 1);
      this.audio.drink();
      this.toast('杏仁水 · 心智 +42');
      this.say('甜味散开。嗡鸣退远了一点。', 0.1, 3.2);
      this.updateHUD(true);
    }

    useLift() {
      if (this.powered) {
        if (this.powerReady) this.escape();
        else this.say('还在供电，还需要 ' + Math.ceil(this.powerTimer) + ' 秒。别走远。', 0, 2.8);
        return;
      }
      if (this.installing) return;
      if (this.inventory.fuse < 3) {
        this.audio.error();
        this.say('三个空插槽。还差 ' + (3 - this.inventory.fuse) + ' 枚保险丝。', 0, 3.4);
        this.toast('还差 ' + (3 - this.inventory.fuse) + ' 枚保险丝');
        return;
      }
      this.startInstall();
    }

    startInstall() {
      this.installing = true;
      this.busy = true;
      this.installT = 0;
      this.installClanks = 0;
      $('installBar').classList.remove('hidden');
      $('installFill').style.width = '0%';
      $('prompt').classList.remove('show');
      this.audio.installClank();
      this.say('金属很凉。一枚、两枚……', 0, 3.2);
      this.player.keys = {};
    }

    cancelInstall() {
      this.installing = false;
      this.busy = false;
      $('installBar').classList.add('hidden');
      this.audio.error();
      this.say('它太近了。先把它甩开，再回来接线。', 0, 3.6);
    }

    updateInstall(dt) {
      if (this.hound.state === 'chase' && this.hound.dist < 7) {
        this.cancelInstall();
        return;
      }
      this.installT += dt;
      const k = Math.min(1, this.installT / 3.8);
      $('installFill').style.width = Math.round(k * 100) + '%';
      const marks = [1.0, 2.2, 3.3];
      while (this.installClanks < marks.length && this.installT >= marks[this.installClanks]) {
        this.audio.installClank();
        this.installClanks++;
      }
      if (k >= 1) this.finishInstall();
    }

    finishInstall() {
      this.installing = false;
      this.busy = false;
      $('installBar').classList.add('hidden');
      this.powered = true;
      this.level.setFuseLamps(3);
      this.level.powerOn();
      this.powerTimer = 45;
      this.powerReady = false;
      this.brownoutTick = 0;
      this.audio.powerOn();
      if (this.hound.state === 'dormant') {
        this.hound.setAggression(3, this.level, this.player.pos);
      }
      this.hound.enrage();
      this.hound.target = this.level.worldToCell(this.player.pos.x, this.player.pos.z);
      this.hound.lastSeen = this.level.worldToCell(this.player.pos.x, this.player.pos.z);
      this.hound.repathT = 0;
      this.level.setBrownout(5);
      this.say('电梯开始供电。灯管正在失控——留在门口，等它到。', 0, 5.4);
      if (!this.isTouch) this.toast('供电恢复 · 等待电梯');
      $('sequence').classList.remove('hidden');
      $('sequence').querySelector('.seq-time').textContent = '45';
      this.updateObjective(true);
      this.updateHUD(true);
    }

    onPowerReady() {
      this.powerReady = true;
      this.level.openLift();
      this.level.setBrownout(2);
      this.audio.beep(1180, 0.22, 0.07);
      this.audio.doorSlide();
      $('sequence').classList.add('hidden');
      this.toast('电梯已就位');
      this.say('门开了。进去，现在。', 0.4, 4.5);
      this.updateObjective(true);
    }

    /* ==================== 死亡 / 结局 ==================== */
    die(cause) {
      if (this.state !== 'playing') return;
      this.state = 'dead';
      this.deathCause = cause;
      this.deathShown = false;
      this.deathTimer = 0;
      this.noteOpen = false;
      this.busy = false;
      this.resetTouchInput();
      $('note').classList.add('hidden');
      $('prompt').classList.remove('show');
      $('installBar').classList.add('hidden');
      $('crosshair').classList.remove('active');

      this.audio.scream();
      this.player.addShake(1.4);
      this.player.insanity = 1;

      if (cause === 'hound') {
        this.hound.jumpscare(this.camera);
        this.hound.state = 'dead';
      } else {
        this.hound.state = 'dormant';
      }

      const hf = $('hitflash');
      hf.classList.remove('fire');
      void hf.offsetWidth;
      hf.classList.add('fire');

      if (document.pointerLockElement) {
        try { document.exitPointerLock(); } catch (e) { /* ignore */ }
      }
    }

    updateDead(dt) {
      this.deathTimer += dt;
      this.player.shake = Math.max(0, this.player.shake - dt * 0.55);
      this.player.applyCamera();
      if (this.hound.state === 'dead') this.hound.update(dt, this.player, this.level, this);
      this.level.update(dt, this.player.pos);
      this.audio.tick(dt, { tension: 1, sanity: 0, houndDist: 2, houndPan: 0, chasing: true });
      if (!this.deathShown && this.deathTimer > 1.6) {
        this.deathShown = true;
        this.showDeath();
      }
    }

    showDeath() {
      const cause = this.deathCause === 'hound'
        ? '猎犬从走廊尽头扑过来的时候，你听见的最后一件事是自己的心跳。\n它记住了你的脚步，也记住了你的呼吸。'
        : '你数了太多盏灯。墙纸的花纹开始变成你的名字，\n而你再也分不清哪条走廊是来时的那一条。';
      $('deathCause').textContent = cause;
      $('deathStats').innerHTML =
        '<div><span>存活时间</span><b>' + this.formatTime(this.time) + '</b></div>' +
        '<div><span>保险丝</span><b>' + this.inventory.fuse + ' / 3</b></div>' +
        '<div><span>便条</span><b>' + this.notesFound + ' / 6</b></div>' +
        '<div><span>行走距离</span><b>' + Math.round(this.player.walked) + ' m</b></div>';
      $('death').classList.remove('hidden');
      $('hud').classList.remove('visible');
      this.audio.setPaused(true);
    }

    escape() {
      if (this.state !== 'playing') return;
      this.state = 'ending';
      this.endingTimer = 0;
      this.resetTouchInput();
      this.audio.doorSlide();
      this.audio.beep(980, 0.3, 0.05);
      $('prompt').classList.remove('show');
      $('hud').classList.remove('visible');
      $('sequence').classList.add('hidden');
      $('crosshair').classList.remove('active');
      const fade = $('fade');
      fade.classList.add('white');
      void fade.offsetWidth;
      fade.classList.add('on');
      if (document.pointerLockElement) {
        try { document.exitPointerLock(); } catch (e) { /* ignore */ }
      }
      const self = this;
      setTimeout(function () { self.showEnding(); }, 1900);
    }

    showEnding() {
      const fade = $('fade');
      fade.classList.remove('on');
      setTimeout(function () { fade.classList.remove('white'); }, 700);
      $('endingStats').innerHTML =
        '<div><span>逃脱用时</span><b>' + this.formatTime(this.time) + '</b></div>' +
        '<div><span>便条</span><b>' + this.notesFound + ' / 6</b></div>' +
        '<div><span>杏仁水</span><b>' + this.waterUsed + ' 瓶</b></div>' +
        '<div><span>行走距离</span><b>' + Math.round(this.player.walked) + ' m</b></div>';
      $('ending').classList.remove('hidden');
      this.audio.setPaused(true);
      this.audio.beep(520, 1.4, 0.03);
    }

    updateEnding(dt) {
      this.endingTimer += dt;
    }

    onHoundAlert(h) {
      if (this.state !== 'playing') return;
      if (this.houndAlertT > 0) return;
      this.houndAlertT = 10;
      this.audio.stinger();
      this.player.addShake(0.5);
      this.say('它看见你了。跑。', 0, 2.8);
    }

    drainSanity(v) {
      this.sanity = clamp(this.sanity + v, 0, 100);
    }

    /* ==================== HUD ==================== */
    formatTime(sec) {
      const m = Math.floor(sec / 60);
      const s = Math.floor(sec % 60);
      return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
    }

    updateObjective(force) {
      let text;
      if (this.powerReady) text = '进入电梯，离开 Level 0';
      else if (this.powered) text = '等待电梯供电 · ' + Math.ceil(this.powerTimer) + ' 秒';
      else if (this.installing) text = '正在安装保险丝 · 3 / 3';
      else if (this.inventory.fuse >= 3) text = '返回货运电梯，安装三枚保险丝';
      else text = '寻找保险丝 · ' + this.inventory.fuse + ' / 3';

      if (text !== this.objectiveText) {
        const countdown = text.indexOf('等待电梯供电') === 0;
        const el = $('objectiveText');
        el.textContent = text;
        this.objectiveText = text;
        if (!countdown || force) {
          el.classList.remove('flash');
          void el.offsetWidth;
          el.classList.add('flash');
        }
      }
    }

    updateHUD(force) {
      const p = this.player;
      if (!p) return;
      $('clock').textContent = this.formatTime(this.time);

      const sanity = Math.round(this.sanity);
      const sf = $('sanityFill');
      sf.style.width = sanity + '%';
      sf.classList.toggle('low', sanity < 45 && sanity >= 18);
      sf.classList.toggle('crit', sanity < 18);

      $('staminaFill').style.width = Math.round(p.stamina) + '%';
      $('batteryFill').style.width = Math.round(p.battery) + '%';
      $('batteryRow').classList.toggle('off', !p.flashlightOn);

      const html =
        '<div class="chip"><span class="dot"></span>保险丝 <b>' + this.inventory.fuse + '</b>/3</div>' +
        '<div class="chip' + (this.inventory.water ? '' : ' empty') + '">' +
        (this.isTouch ? '' : '<kbd>1</kbd>') + '杏仁水 <b>' + this.inventory.water + '</b></div>';
      if (html !== this.invHTML || force) {
        $('inventory').innerHTML = html;
        this.invHTML = html;
      }
      this.updateTouchUI();
    }

    updatePrompt() {
      let html = '';
      if (this.interact && this.state === 'playing') {
        html = (this.isTouch ? '<span class="tap">点按</span>' : '<kbd>E</kbd>') + ' ' + this.interact.label;
      }
      if (html !== this.promptText) {
        const el = $('prompt');
        el.innerHTML = html;
        el.classList.toggle('show', !!html);
        $('crosshair').classList.toggle('active', !!html);
        this.promptText = html;
      }
    }

    say(text, delay, dur) {
      this.subtitleQueue.push({
        at: this.time + (delay || 0),
        text: text,
        dur: dur || 3.5
      });
    }

    updateSubtitles(dt) {
      for (let i = 0; i < this.subtitleQueue.length; i++) {
        const q = this.subtitleQueue[i];
        if (q.at <= this.time) {
          const el = $('subtitle');
          el.textContent = q.text;
          el.classList.add('show');
          this.subtitleTimer = q.dur;
          this.subtitleQueue.splice(i, 1);
          break;
        }
      }
      if (this.subtitleTimer > 0) {
        this.subtitleTimer -= dt;
        if (this.subtitleTimer <= 0) $('subtitle').classList.remove('show');
      }
    }

    toast(text) {
      const el = $('toast');
      el.textContent = text;
      el.classList.add('show');
      this.toastTimer = 2.6;
    }

    toggleMap() {
      if (this.state !== 'playing') return;
      this.mapVisible = !this.mapVisible;
      $('minimapWrap').classList.toggle('hidden', !this.mapVisible);
      this.toast(this.mapVisible ? '局部地图 · 开' : '局部地图 · 关');
    }

    drawMap() {
      const canvas = $('minimap');
      const ctx = canvas.getContext('2d');
      this.level.drawMinimap(ctx, this.player, this.time);
    }

    /* ==================== 渲染循环 ==================== */
    animate() {
      const self = this;
      function loop() {
        requestAnimationFrame(loop);
        const dt = Math.min(self.clock.getDelta(), 0.05);
        if (self.state === 'playing') self.updatePlaying(dt);
        else if (self.state === 'dead') self.updateDead(dt);
        else if (self.state === 'boot') self.updateMenu(dt);
        else if (self.state === 'ending') self.updateEnding(dt);
        if (!self.skipRender) self.renderer.render(self.scene, self.camera);
      }
      loop();
    }

    /* ==================== 调试接口 ==================== */
    setupDebug() {
      const self = this;
      BR.debug = {
        teleport: function (x, z) {
          self.player.pos.set(x, 0, z);
          self.player.applyCamera();
          return { x: x, z: z };
        },
        look: function (yaw, pitch) {
          self.player.yaw = yaw;
          self.player.pitch = pitch || 0;
          self.player.applyCamera();
        },
        sanity: function (v) {
          self.sanity = v;
          self.player.insanity = clamp((58 - v) / 58, 0, 1);
          return v;
        },
        fuses: function (n) {
          self.inventory.fuse = n;
          self.level.setFuseLamps(n);
          self.updateObjective(true);
          self.updateHUD(true);
          return n;
        },
        items: function () {
          return self.level.items.filter(function (i) { return !i.collected; })
            .map(function (i) { return { kind: i.kind, x: i.group.position.x, z: i.group.position.z }; });
        },
        goto: function (kind) {
          const list = self.level.items.filter(function (i) { return i.kind === kind && !i.collected; });
          if (!list.length) return null;
          const item = list[0];
          const cell = self.level.worldToCell(item.group.position.x, item.group.position.z);
          const dirs = [[0, 1], [1, 0], [0, -1], [-1, 0]];
          for (let i = 0; i < dirs.length; i++) {
            const nx = cell.x + dirs[i][0], nz = cell.z + dirs[i][1];
            if (!self.level.canWalk(cell.x, cell.z, nx, nz)) continue;
            const w = self.level.cellToWorld(nx, nz);
            const tx = item.group.position.x, tz = item.group.position.z;
            const dx = tx - w.x, dz = tz - w.z;
            const dist = Math.hypot(dx, dz) || 1;
            self.player.pos.set(tx - (dx / dist) * 1.7, 0, tz - (dz / dist) * 1.7);
            self.player.yaw = Math.atan2(-dx, -dz);
            self.player.pitch = -0.24;
            self.player.applyCamera();
            return { kind: kind, x: self.player.pos.x, z: self.player.pos.z };
          }
          return null;
        },
        gotoCell: function (x, z) {
          const w = self.level.cellToWorld(x, z);
          self.player.pos.set(w.x, 0, w.z);
          self.player.applyCamera();
          return w;
        },
        gotoLift: function () {
          const l = self.level.lift;
          const c = self.level.spawnCell;
          const w = self.level.cellToWorld(c.x, c.z);
          self.player.pos.set(w.x + 0.5, 0, w.z + 1.35);
          self.player.yaw = 0;
          self.player.pitch = 0.05;
          self.player.applyCamera();
          return { x: w.x, z: w.z };
        },
        power: function () {
          self.fuses(3);
          self.startInstall();
        },
        houndNear: function () {
          if (self.hound.state === 'dormant') {
            self.hound.setAggression(1, self.level, self.player.pos);
          }
          const cell = self.level.worldToCell(self.player.pos.x, self.player.pos.z);
          let best = null;
          let bestD = 1e9;
          for (let dz = -2; dz <= 2; dz++) {
            for (let dx = -2; dx <= 2; dx++) {
              const nx = cell.x + dx, nz = cell.z + dz;
              if (nx < 0 || nz < 0 || nx >= self.level.W || nz >= self.level.H) continue;
              const w = self.level.cellToWorld(nx, nz);
              const d = Math.hypot(w.x - self.player.pos.x, w.z - self.player.pos.z);
              if (d < 4.5 || d > 10) continue;
              if (!self.level.hasLOS(self.player.pos.x, self.player.pos.z, w.x, w.z)) continue;
              if (d < bestD) { bestD = d; best = w; }
            }
          }
          if (!best) {
            const f = self.player.getForward();
            best = new THREE.Vector3(self.player.pos.x + f.x * 6, 0, self.player.pos.z + f.z * 6);
          }
          self.hound.pos.set(best.x, 0, best.z);
          self.hound.cell = self.level.worldToCell(best.x, best.z);
          self.hound.group.position.copy(self.hound.pos);
          self.hound.group.visible = true;
          const dx = self.player.pos.x - best.x;
          const dz = self.player.pos.z - best.z;
          self.hound.group.rotation.y = Math.atan2(-dx, -dz);
          self.player.yaw = Math.atan2(-(-dx), -(-dz));
          self.player.pitch = -0.02;
          self.player.applyCamera();
          self.hound.state = 'chase';
          self.hound.chaseTimer = 30;
          self.hound.target = self.level.worldToCell(self.player.pos.x, self.player.pos.z);
          self.hound.path = [];
          self.hound.repathT = 0;
          return self.hound.pos.toArray();
        },
        smiler: function () {
          self.sanity = 40;
          return self.smiler.trySpawn(self.level, self.player);
        },
        caught: function () { self.die('hound'); },
        clear: function () {
          self.hound.reset();
          self.level.setFuseLamps(0);
        },
        state: function () { return self.state; }
      };
    }
  }

  BR.Game = Game;
  window.addEventListener('DOMContentLoaded', function () {
    const g = new Game();
    BR.game = g;
    g.init();
  });
})();
