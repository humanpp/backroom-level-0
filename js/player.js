/* ============================================================
   player.js — 第一人称控制、碰撞、脚步、手电、交互探测
   ============================================================ */
(function () {
  const BR = (window.BR = window.BR || {});
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  class Player {
    constructor(camera, level, audio) {
      this.camera = camera;
      this.level = level;
      this.audio = audio;

      this.pos = new THREE.Vector3();
      this.yaw = 0;
      this.pitch = 0;
      this.keys = {};
      this.radius = 0.34;

      this.eyeY = 1.62;
      this.standEye = 1.62;
      this.crouchEye = 1.08;

      this.walkSpeed = 3.35;
      this.sprintSpeed = 5.5;
      this.crouchSpeed = 1.55;
      this.speed = 0;

      this.stamina = 100;
      this.maxStamina = 100;
      this.staminaDelay = 0;

      this.battery = 100;
      this.batteryDrain = 1.35;
      this.flashlightOn = false;

      this.crouching = false;
      this.sprinting = false;
      this.moving = false;
      this.touchMove = { x: 0, y: 0 };
      this.touchSprint = false;
      this.touchCrouch = false;
      this.bobPhase = 0;
      this.eyeOffset = 0;
      this.stepDist = 0;
      this.walked = 0;

      this.insanity = 0;
      this.shake = 0;
      this.lookSens = 1;
      this.fov = 72;
      this.fovTarget = 72;

      this.flashlight = new THREE.SpotLight(0xfff2d2, 0, 34, 0.46, 0.55, 1.35);
      this.flashlight.position.set(0.14, -0.1, 0);
      this.flashlight.target.position.set(0, -0.05, -1);
      camera.add(this.flashlight);
      camera.add(this.flashlight.target);
      this.flashIntensity = 0;
    }

    reset(pos, yaw) {
      this.pos.copy(pos);
      this.yaw = yaw || 0;
      this.pitch = 0;
      this.keys = {};
      this.speed = 0;
      this.stamina = this.maxStamina;
      this.battery = 100;
      this.flashlightOn = false;
      this.flashIntensity = 0;
      this.crouching = false;
      this.sprinting = false;
      this.moving = false;
      this.touchMove.x = 0;
      this.touchMove.y = 0;
      this.touchSprint = false;
      this.touchCrouch = false;
      this.bobPhase = 0;
      this.eyeY = this.standEye;
      this.eyeOffset = 0;
      this.stepDist = 0;
      this.walked = 0;
      this.insanity = 0;
      this.shake = 0;
      this.fov = 72;
      this.fovTarget = 72;
      this.applyCamera();
    }

    setKey(code, down) {
      this.keys[code] = down;
    }

    look(dx, dy) {
      const s = 0.0021 * this.lookSens;
      this.yaw -= dx * s;
      this.pitch -= dy * s;
      this.pitch = clamp(this.pitch, -1.32, 1.32);
    }

    toggleFlashlight() {
      if (this.battery <= 0) {
        this.flashlightOn = false;
        return false;
      }
      this.flashlightOn = !this.flashlightOn;
      this.audio.click();
      return this.flashlightOn;
    }

    addBattery(v) {
      this.battery = clamp(this.battery + v, 0, 100);
    }

    addShake(v) { this.shake = Math.min(1, this.shake + v); }

    getNoiseRadius() {
      if (!this.moving) return 1.4;
      let n = this.crouching ? 2.6 : (this.sprinting ? 19 : 8.6);
      if (this.flashlightOn) n += 1.6;
      return n;
    }

    getForward() {
      return new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    }

    applyCamera() {
      const cam = this.camera;
      const bob = this.moving ? (this.sprinting ? 0.062 : 0.036) : 0;
      const bobY = Math.sin(this.bobPhase * 2) * bob;
      const bobX = Math.cos(this.bobPhase) * bob * 0.55;

      const rightX = Math.cos(this.yaw), rightZ = -Math.sin(this.yaw);
      cam.position.set(
        this.pos.x + rightX * bobX,
        this.eyeY + bobY,
        this.pos.z + rightZ * bobX
      );

      const t = performance.now() * 0.001;
      const ins = this.insanity;
      const swayRoll = Math.sin(t * 0.9) * 0.022 * ins;
      const swayPitch = Math.sin(t * 1.3 + 1.2) * 0.012 * ins;
      const swayYaw = Math.sin(t * 0.62) * 0.012 * ins;
      const shake = this.shake;
      const sRoll = (Math.random() - 0.5) * 0.06 * shake;
      const sPitch = (Math.random() - 0.5) * 0.05 * shake;

      cam.rotation.set(this.pitch + swayPitch + sPitch, this.yaw + swayYaw, swayRoll + sRoll, 'YXZ');

      this.fovTarget = (this.sprinting ? 77 : 72) + ins * 4;
      this.fov += (this.fovTarget - this.fov) * 0.08;
      if (Math.abs(cam.fov - this.fov) > 0.01) {
        cam.fov = this.fov;
        cam.updateProjectionMatrix();
      }
    }

    update(dt) {
      const k = this.keys;
      const tm = this.touchMove;
      let fwd = (k.KeyW || k.ArrowUp ? 1 : 0) - (k.KeyS || k.ArrowDown ? 1 : 0) + tm.y;
      let strafe = (k.KeyD || k.ArrowRight ? 1 : 0) - (k.KeyA || k.ArrowLeft ? 1 : 0) + tm.x;
      fwd = Math.max(-1, Math.min(1, fwd));
      strafe = Math.max(-1, Math.min(1, strafe));
      const mag = Math.min(1, Math.hypot(fwd, strafe));
      this.crouching = !!(k.KeyC || k.ControlLeft || this.touchCrouch);

      const wantMove = mag > 0.08;
      const maxStam = this.maxStamina;

      let sprint = !!(k.ShiftLeft || k.ShiftRight || this.touchSprint) &&
        wantMove && !this.crouching && fwd > 0.1 && this.stamina > 1;
      this.sprinting = sprint;

      let targetSpeed = 0;
      if (wantMove) {
        targetSpeed = this.crouching ? this.crouchSpeed : (sprint ? this.sprintSpeed : this.walkSpeed);
        targetSpeed *= mag;
      }
      this.speed += (targetSpeed - this.speed) * Math.min(1, dt * 12);
      this.moving = this.speed > 0.25;

      if (this.moving) {
        const len = Math.hypot(fwd, strafe) || 1;
        const fx = fwd / len, sx = strafe / len;
        const dx = -Math.sin(this.yaw) * fx + Math.cos(this.yaw) * sx;
        const dz = -Math.cos(this.yaw) * fx - Math.sin(this.yaw) * sx;
        const step = this.speed * dt;

        const nx = this.pos.x + dx * step;
        if (!this.level.isBlocked(nx, this.pos.z, this.radius)) this.pos.x = nx;
        const nz = this.pos.z + dz * step;
        if (!this.level.isBlocked(this.pos.x, nz, this.radius)) this.pos.z = nz;

        this.walked += step;
        this.stepDist += step;

        const stride = this.crouching ? 2.2 : (sprint ? 1.85 : 2.05);
        if (this.stepDist >= stride) {
          this.stepDist = 0;
          this.audio.step(this.crouching ? 'crouch' : (sprint ? 'sprint' : 'walk'));
        }
      }

      // 体力
      if (sprint && this.moving) {
        this.stamina = Math.max(0, this.stamina - 20 * dt);
        this.staminaDelay = 0.9;
      } else {
        this.staminaDelay -= dt;
        if (this.staminaDelay <= 0) {
          this.stamina = Math.min(maxStam, this.stamina + (this.crouching ? 18 : 13) * dt);
        }
      }

      // 手电
      if (this.flashlightOn) {
        this.battery -= this.batteryDrain * dt;
        if (this.battery <= 0) {
          this.battery = 0;
          this.flashlightOn = false;
          this.audio.click();
        }
      }
      let target = this.flashlightOn ? 1 : 0;
      if (this.flashlightOn && this.battery < 22) {
        if (Math.random() < dt * 6) target = Math.random() < 0.4 ? 0.15 : 1;
      }
      this.flashIntensity += (target - this.flashIntensity) * Math.min(1, dt * 18);
      this.flashlight.intensity = this.flashIntensity * 85;
      this.flashlight.visible = this.flashIntensity > 0.01;

      // 视角高度 / 呼吸
      const targetEye = this.crouching ? this.crouchEye : this.standEye;
      this.eyeY += (targetEye - this.eyeY) * Math.min(1, dt * 11);

      if (this.moving) {
        this.bobPhase += dt * (sprint ? 12.5 : 8.6);
      } else {
        this.bobPhase += dt * 1.2;
      }

      this.shake = Math.max(0, this.shake - dt * 1.6);
      this.applyCamera();
    }

    getInteract(interactables) {
      let best = null;
      let bestScore = -1;
      const fwd = this.getForward();
      const eyePos = this.eyeY;
      for (let i = 0; i < interactables.length; i++) {
        const it = interactables[i];
        if (!it.enabled) continue;
        const dx = it.pos.x - this.pos.x;
        const dz = it.pos.z - this.pos.z;
        const dh = Math.hypot(dx, dz);
        if (dh > it.radius) continue;
        const dy = it.pos.y - eyePos;
        if (Math.abs(dy) > 2.4) continue;
        if (dh > 1.1) {
          const hdot = (dx / dh) * fwd.x + (dz / dh) * fwd.z;
          if (hdot < 0.32) continue;
        }
        const score = (dh > 0.01 ? (dx / dh) * fwd.x + (dz / dh) * fwd.z : 1) - dh * 0.04;
        if (score > bestScore) {
          bestScore = score;
          best = it;
        }
      }
      return best;
    }
  }

  BR.Player = Player;
})();
