/* ============================================================
   entities.js — 猎犬（听觉追猎）与笑魇（黑暗中的脸）
   ============================================================ */
(function () {
  const BR = (window.BR = window.BR || {});

  /* =====================================================================
     猎犬：靠听觉与视线追踪，速度略慢于冲刺，但比走路快得多
     ===================================================================== */
  class Hound {
    constructor(scene) {
      this.scene = scene;
      this.group = new THREE.Group();
      this.group.visible = false;
      this.pos = new THREE.Vector3();
      this.cell = { x: 15, z: 15 };
      this.target = { x: 15, z: 15 };
      this.lastSeen = null;
      this.path = [];
      this.pathIdx = 0;
      this.state = 'dormant';
      this.dist = 999;
      this.chasing = false;
      this.hasLOS = false;
      this.losT = 0;
      this.repathT = 0;
      this.chaseTimer = 0;
      this.investTimer = 0;
      this.pauseT = 0;
      this.animT = 0;
      this.aggression = 0;
      this.enraged = false;
      this.speedMult = 1;
      this.stuckT = 0;
      this.lastPos = new THREE.Vector3();
      this.build(scene);
    }

    build(scene) {
      const fur = new THREE.MeshStandardMaterial({ color: 0x15110d, roughness: 0.9, metalness: 0.02 });
      const fur2 = new THREE.MeshStandardMaterial({ color: 0x231a12, roughness: 0.82 });
      const bone = new THREE.MeshStandardMaterial({ color: 0xb9b094, roughness: 0.7 });
      const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff3a16, toneMapped: false });
      this.mats = [fur, fur2, bone, eyeMat];

      // 躯干
      const bodyGeo = new THREE.CapsuleGeometry(0.23, 0.8, 5, 12);
      this.body = new THREE.Mesh(bodyGeo, fur);
      this.body.rotation.x = Math.PI / 2;
      this.body.position.set(0, 0.98, 0.06);
      this.group.add(this.body);

      const chestGeo = new THREE.SphereGeometry(0.27, 12, 10);
      const chest = new THREE.Mesh(chestGeo, fur2);
      chest.scale.set(1.04, 1.0, 0.9);
      chest.position.set(0, 0.96, -0.34);
      this.group.add(chest);

      // 脖子与头
      const neckGeo = new THREE.BoxGeometry(0.22, 0.24, 0.5);
      const neck = new THREE.Mesh(neckGeo, fur2);
      neck.position.set(0, 1.01, -0.58);
      neck.rotation.x = -0.25;
      this.group.add(neck);

      const headGeo = new THREE.SphereGeometry(0.2, 12, 10);
      this.head = new THREE.Mesh(headGeo, fur2);
      this.head.scale.set(1.05, 0.92, 1.3);
      this.head.position.set(0, 1.04, -0.82);
      this.group.add(this.head);

      const snoutGeo = new THREE.BoxGeometry(0.17, 0.15, 0.34);
      const snout = new THREE.Mesh(snoutGeo, fur2);
      snout.position.set(0, 0.97, -1.02);
      this.group.add(snout);

      const jawGeo = new THREE.BoxGeometry(0.15, 0.07, 0.32);
      this.jaw = new THREE.Mesh(jawGeo, fur2);
      this.jaw.position.set(0, 0.89, -1.0);
      this.group.add(this.jaw);

      const toothGeo = new THREE.ConeGeometry(0.018, 0.075, 4);
      for (let i = 0; i < 6; i++) {
        const t = new THREE.Mesh(toothGeo, bone);
        t.position.set((i % 3 - 1) * 0.045, 0.935, i < 3 ? -1.12 : -1.05);
        t.rotation.x = i < 3 ? Math.PI : 0;
        this.group.add(t);
      }

      const earGeo = new THREE.ConeGeometry(0.075, 0.22, 4);
      const earL = new THREE.Mesh(earGeo, fur2);
      earL.position.set(-0.13, 1.2, -0.74);
      earL.rotation.set(-0.25, 0, -0.2);
      const earR = new THREE.Mesh(earGeo, fur2);
      earR.position.set(0.13, 1.2, -0.74);
      earR.rotation.set(-0.25, 0, 0.2);
      this.group.add(earL, earR);

      const eyeGeo = new THREE.SphereGeometry(0.045, 8, 6);
      const e1 = new THREE.Mesh(eyeGeo, eyeMat);
      e1.position.set(-0.072, 1.07, -1.1);
      const e2 = new THREE.Mesh(eyeGeo, eyeMat);
      e2.position.set(0.072, 1.07, -1.1);
      this.group.add(e1, e2);

      const glowMat = new THREE.SpriteMaterial({
        map: BR.Textures.get('glow'), color: 0xff3a12, transparent: true,
        opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending
      });
      this.eyeGlow = new THREE.Sprite(glowMat);
      this.eyeGlow.scale.set(0.7, 0.7, 1);
      this.eyeGlow.position.set(0, 1.07, -1.12);
      this.group.add(this.eyeGlow);
      this.mats.push(glowMat);

      const spikeGeo = new THREE.ConeGeometry(0.04, 0.17, 5);
      for (let i = 0; i < 5; i++) {
        const s = new THREE.Mesh(spikeGeo, fur2);
        s.position.set((i % 2 === 0 ? 1 : -1) * 0.06, 1.16 - i * 0.005, -0.35 + i * 0.17);
        s.rotation.x = -0.5;
        s.rotation.z = (i % 2 === 0 ? 1 : -1) * 0.3;
        this.group.add(s);
      }

      // 尾巴
      const tailGeo = new THREE.ConeGeometry(0.055, 0.55, 5);
      const tail = new THREE.Mesh(tailGeo, fur);
      tail.position.set(0, 0.98, 0.78);
      tail.rotation.x = 2.1;
      this.group.add(tail);

      // 四肢
      const legGeo = new THREE.BoxGeometry(0.095, 0.92, 0.095);
      const pawGeo = new THREE.BoxGeometry(0.15, 0.08, 0.22);
      this.legs = [];
      const offs = [[-0.19, -0.38], [0.19, -0.38], [-0.19, 0.4], [0.19, 0.4]];
      for (let i = 0; i < 4; i++) {
        const pivot = new THREE.Group();
        pivot.position.set(offs[i][0], 0.98, offs[i][1]);
        const leg = new THREE.Mesh(legGeo, fur);
        leg.position.y = -0.46;
        const paw = new THREE.Mesh(pawGeo, fur2);
        paw.position.set(0, -0.88, -0.03);
        pivot.add(leg, paw);
        this.group.add(pivot);
        this.legs.push(pivot);
      }

      const light = new THREE.PointLight(0xff2f10, 0.55, 3.6, 1.8);
      light.position.set(0, 1.06, -0.9);
      this.group.add(light);
      this.eyeLight = light;

      this.geos = [bodyGeo, chestGeo, neckGeo, headGeo, snoutGeo, jawGeo, toothGeo, earGeo, eyeGeo, spikeGeo, tailGeo, legGeo, pawGeo];
      this.group.scale.setScalar(1.0);
      scene.add(this.group);
    }

    reset() {
      this.state = 'dormant';
      this.group.visible = false;
      this.group.scale.setScalar(1.0);
      this.path = [];
      this.pathIdx = 0;
      this.aggression = 0;
      this.enraged = false;
      this.speedMult = 1;
      this.chaseTimer = 0;
      this.investTimer = 0;
      this.dist = 999;
      this.chasing = false;
    }

    activate(playerPos, level, aggression) {
      this.aggression = aggression || 0;
      let cell = null;
      for (let i = 0; i < 240; i++) {
        const c = level.randomOpenCell({ minDist: 24, maxDist: 62 });
        if (!c) continue;
        if (level.hasLOS(c.w.x, c.w.z, playerPos.x, playerPos.z)) continue;
        cell = c;
        break;
      }
      if (!cell) cell = level.randomOpenCell({ minDist: 22, maxDist: 60 });
      if (!cell) return false;

      this.pos.set(cell.w.x, 0, cell.w.z);
      this.cell = { x: cell.x, z: cell.z };
      this.group.position.copy(this.pos);
      this.group.rotation.y = Math.random() * Math.PI * 2;
      this.group.visible = true;
      this.state = 'patrol';
      this.lastPos.copy(this.pos);
      this.pickPatrol(level);
      this.repathT = 0;
      this.losT = 0;
      return true;
    }

    setAggression(n, level, playerPos) {
      this.aggression = n;
      if (this.state === 'dormant' && n > 0) {
        this.activate(playerPos, level, n);
      }
      if (n >= 2) {
        this.speedMult = 1.05;
        this.repathT = 0;
      }
    }

    enrage() {
      this.enraged = true;
      this.speedMult = 1.12;
      if (this.state !== 'dormant') {
        this.state = 'chase';
        this.chaseTimer = 8;
        this.repathT = 0;
      }
    }

    pickPatrol(level) {
      const c = level.randomOpenCell({ minDist: 12, maxDist: 56 });
      if (c) this.target = { x: c.x, z: c.z };
      this.pauseT = Math.random() < 0.3 ? 0.8 + Math.random() * 1.6 : 0;
    }

    face(dx, dz, dt, speed) {
      const want = Math.atan2(-dx, -dz);
      let diff = want - this.group.rotation.y;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      this.group.rotation.y += diff * Math.min(1, dt * (speed || 7));
    }

    update(dt, player, level, game) {
      if (this.state === 'dormant' || this.state === 'dead') {
        if (this.state === 'dead') {
          this.animT += dt * 16;
          this.jaw.position.z = -1.0 - Math.abs(Math.sin(this.animT)) * 0.08;
          this.group.position.y = Math.sin(this.animT * 2.2) * 0.03;
        }
        return;
      }

      this.cell = level.worldToCell(this.pos.x, this.pos.z);
      this.dist = Math.hypot(player.pos.x - this.pos.x, player.pos.z - this.pos.z);
      this.losT -= dt;
      if (this.losT <= 0) {
        this.losT = 0.14;
        this.hasLOS = level.hasLOS(this.pos.x, this.pos.z, player.pos.x, player.pos.z);
      }

      const noise = player.getNoiseRadius() * (this.enraged ? 1.45 : 1) * (this.nightmare ? 1.22 : 1);

      if (this.state === 'chase') {
        this.chasing = true;
        if (this.hasLOS && this.dist < 26) {
          this.chaseTimer = 4.5;
          this.lastSeen = level.worldToCell(player.pos.x, player.pos.z);
          this.target = { x: this.lastSeen.x, z: this.lastSeen.z };
        } else {
          this.chaseTimer -= dt;
          if (this.chaseTimer <= 0) {
            this.state = 'investigate';
            this.investTimer = 7;
            if (this.lastSeen) this.target = { x: this.lastSeen.x, z: this.lastSeen.z };
          }
        }
      } else {
        this.chasing = false;
        let noticed = false;
        if (this.hasLOS && this.dist < 15) noticed = true;
        if (this.dist < noise && (this.hasLOS || this.dist < noise * 0.55)) noticed = true;
        if (this.dist < 5.5 && this.hasLOS) noticed = true;

        if (noticed) {
          this.state = 'chase';
          this.chaseTimer = 4.5;
          this.lastSeen = level.worldToCell(player.pos.x, player.pos.z);
          this.target = { x: this.lastSeen.x, z: this.lastSeen.z };
          this.repathT = 0;
          if (game && game.onHoundAlert) game.onHoundAlert(this);
        } else if (this.state === 'investigate') {
          this.investTimer -= dt;
          if (this.hasLOS && this.dist < 12) {
            this.state = 'chase';
            this.chaseTimer = 4.5;
          } else if (this.investTimer <= 0) {
            this.state = 'patrol';
            this.pickPatrol(level);
            this.repathT = 0;
          }
        }
      }

      // 路径
      this.repathT -= dt;
      if (this.repathT <= 0) {
        this.repathT = this.state === 'chase' ? 0.42 : 1.0;
        if (this.state === 'patrol' && this.pauseT > 0) {
          this.pauseT -= dt;
          this.path = [];
        } else {
          const path = level.bfs(this.cell, this.target);
          if (path && path.length) {
            this.path = path;
            this.pathIdx = 0;
          } else {
            this.path = [];
            if (this.state === 'patrol') this.pickPatrol(level);
          }
        }
      }

      // 移动
      let speed = 1.55;
      if (this.state === 'investigate') speed = 2.7;
      if (this.state === 'chase') speed = (this.enraged ? 4.95 : 4.3) * this.speedMult * (this.nightmare ? 1.1 : 1);
      if (this.pauseT > 0 && this.state === 'patrol') speed = 0;

      let moved = 0;
      if (this.path.length && this.pathIdx < this.path.length && speed > 0) {
        const wp = this.path[this.pathIdx];
        const targetPos = level.cellToWorld(wp.x, wp.z);
        const dx = targetPos.x - this.pos.x;
        const dz = targetPos.z - this.pos.z;
        const d = Math.hypot(dx, dz);
        if (d < 0.62) {
          this.pathIdx++;
          if (this.state === 'patrol' && this.pathIdx >= this.path.length) {
            this.pickPatrol(level);
          }
        } else {
          const nx = this.pos.x + (dx / d) * speed * dt;
          const nz = this.pos.z + (dz / d) * speed * dt;
          if (!level.isBlocked(nx, nz, 0.32)) {
            this.pos.x = nx;
            this.pos.z = nz;
            moved = speed * dt;
          } else if (!level.isBlocked(nx, this.pos.z, 0.32)) {
            this.pos.x = nx;
            moved = speed * dt * 0.6;
          } else if (!level.isBlocked(this.pos.x, nz, 0.32)) {
            this.pos.z = nz;
            moved = speed * dt * 0.6;
          } else {
            this.repathT = 0;
          }
          this.face(dx, dz, dt, this.state === 'chase' ? 9 : 5);
        }
      }

      // 卡住检测
      if (moved < 0.001) {
        this.stuckT += dt;
        if (this.stuckT > 1.2) {
          this.stuckT = 0;
          this.repathT = 0;
          if (this.state === 'patrol') this.pickPatrol(level);
        }
      } else {
        this.stuckT = 0;
      }

      this.group.position.set(this.pos.x, 0, this.pos.z);

      // 动画
      const legSpeed = this.state === 'chase' ? 13 : (this.state === 'investigate' ? 9 : 5.5);
      if (speed > 0 && moved > 0) this.animT += dt * legSpeed;
      for (let i = 0; i < 4; i++) {
        const amp = this.state === 'chase' ? 0.85 : 0.5;
        this.legs[i].rotation.x = Math.sin(this.animT + i * Math.PI * 0.5) * amp;
      }
      this.body.position.y = 0.98 + Math.sin(this.animT * 2) * 0.025;
      this.head.position.y = 1.04 + Math.sin(this.animT * 2 + 0.5) * 0.02;
      this.eyeLight.intensity = (this.state === 'chase' ? 1.5 : 0.7) * (0.8 + Math.random() * 0.3);
    }

    jumpscare(camera) {
      const dir = new THREE.Vector3();
      camera.getWorldDirection(dir);
      this.pos.set(camera.position.x + dir.x * 1.85, 0, camera.position.z + dir.z * 1.85);
      this.group.position.set(this.pos.x, 0, this.pos.z);
      const dx = camera.position.x - this.pos.x;
      const dz = camera.position.z - this.pos.z;
      this.group.rotation.y = Math.atan2(-dx, -dz);
      this.group.scale.setScalar(1.2);
      this.group.visible = true;
      this.state = 'dead';
      this.animT = 0;
    }
  }

  /* =====================================================================
     笑魇：只在黑暗中出现，盯着它会损耗心智，手电直射会驱散
     ===================================================================== */
  class Smiler {
    constructor(scene) {
      this.scene = scene;
      this.group = new THREE.Group();
      this.group.visible = false;
      this.cooldown = 26;
      this.life = 0;
      this.fade = 0;
      this.state = 'idle';
      this.pos = new THREE.Vector3();
      this.build(scene);
    }

    build(scene) {
      const bodyMat = new THREE.MeshBasicMaterial({ color: 0x050505, transparent: true, opacity: 1 });
      const bodyGeo = new THREE.SphereGeometry(0.42, 14, 12);
      this.body = new THREE.Mesh(bodyGeo, bodyMat);
      this.body.scale.set(0.85, 1.8, 0.5);
      this.body.position.y = 1.45;
      this.group.add(this.body);

      const faceMat = new THREE.MeshBasicMaterial({
        map: BR.Textures.get('smilerFace'), transparent: true, opacity: 1,
        blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false
      });
      const faceGeo = new THREE.PlaneGeometry(0.8, 0.8);
      this.face = new THREE.Mesh(faceGeo, faceMat);
      this.face.position.set(0, 1.62, 0.24);
      this.group.add(this.face);

      this.bodyMat = bodyMat;
      this.faceMat = faceMat;
      this.geos = [bodyGeo, faceGeo];
      scene.add(this.group);
    }

    reset() {
      this.group.visible = false;
      this.cooldown = 30;
      this.life = 0;
      this.fade = 0;
      this.state = 'idle';
    }

    trySpawn(level, player) {
      const p = player.pos;
      let cand = null;
      for (let i = 0; i < 140; i++) {
        const c = level.randomOpenCell({ minDist: 8, maxDist: 16 });
        if (!c) continue;
        if (!level.hasLOS(c.w.x, c.w.z, p.x, p.z)) continue;
        const light = level.getLightAt(new THREE.Vector3(c.w.x, 0, c.w.z));
        if (light > 0.3) continue;
        cand = c;
        break;
      }
      if (!cand) {
        for (let i = 0; i < 100; i++) {
          const c = level.randomOpenCell({ minDist: 9, maxDist: 15 });
          if (!c) continue;
          if (!level.hasLOS(c.w.x, c.w.z, p.x, p.z)) continue;
          cand = c;
          break;
        }
      }
      if (!cand) return false;

      this.pos.set(cand.w.x, 0, cand.w.z);
      this.group.position.copy(this.pos);
      const dx = player.pos.x - this.pos.x;
      const dz = player.pos.z - this.pos.z;
      this.group.rotation.y = Math.atan2(dx, dz);
      this.life = 9 + Math.random() * 4;
      this.fade = 0;
      this.group.visible = true;
      this.state = 'watch';
      if (BR.game && BR.game.audio) BR.game.audio.whisper((Math.random() - 0.5) * 1.2);
      return true;
    }

    vanish(reason, game) {
      this.group.visible = false;
      this.state = 'idle';
      this.cooldown = 24 + Math.random() * 20;
      if (game && game.audio) {
        if (reason === 'flash') game.audio.smilerGone();
        else game.audio.whisper((Math.random() - 0.5) * 1.4);
      }
    }

    update(dt, level, player, game) {
      if (this.cooldown > 0) this.cooldown -= dt;
      if (!this.group.visible) {
        if (game && game.sanity < 58 && this.cooldown <= 0 && Math.random() < dt * 0.55) {
          this.trySpawn(level, player);
        }
        return;
      }

      this.life -= dt;
      const dx = player.pos.x - this.pos.x;
      const dz = player.pos.z - this.pos.z;
      const dist = Math.hypot(dx, dz);

      const wantYaw = Math.atan2(dx, dz);
      let diff = wantYaw - this.group.rotation.y;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      this.group.rotation.y += diff * Math.min(1, dt * 2.4);

      if (this.fade < 1) this.fade = Math.min(1, this.fade + dt * 1.4);
      this.bodyMat.opacity = this.fade;
      this.faceMat.opacity = this.fade;
      this.face.scale.setScalar(1 + Math.sin(performance.now() * 0.0015) * 0.02);

      const fwd = new THREE.Vector3();
      player.camera.getWorldDirection(fwd);
      const len = Math.hypot(dx, 1.62 - player.eyeY, dz) || 1;
      const dot = (dx / len) * fwd.x + ((1.62 - player.eyeY) / len) * fwd.y + (dz / len) * fwd.z;

      if (dot > 0.9 && dist < 20 && game) {
        game.drainSanity(5.5 * dt);
        if (Math.random() < dt * 0.7) player.addShake(0.25);
      }

      if (player.flashlightOn && player.flashIntensity > 0.4 && dot > 0.88 && dist < 20) {
        this.vanish('flash', game);
        if (game) game.drainSanity(-6);
        return;
      }
      if (dist < 4.5) {
        this.vanish('close', game);
        return;
      }
      if (this.life <= 0) this.vanish('timeout', game);
    }
  }

  BR.Hound = Hound;
  BR.Smiler = Smiler;
})();
