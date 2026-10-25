/* ============================================================
   level.js — Level 0 程序化生成：迷宫、材质、灯、道具、电梯
   ============================================================ */
(function () {
  const BR = (window.BR = window.BR || {});
  const T = () => BR.Textures;

  const NOTES = [
    {
      title: '便条 · 字迹潦草',
      text: '别数灯。\n\n我试过。数到第七盏的时候，我忘了自己是从哪面墙走进来的。\n\n如果你已经开始觉得这些房间很眼熟——那不是你的错觉，也不是你的记忆。\n\n快走。'
    },
    {
      title: '杏仁水 · 标签背面',
      text: '标签上印着 1998 年。\n\n喝下去的时候喉咙是甜的，然后你会听见嗡鸣声退远一点。\n\n省着喝。这里没有便利店，也没有第二次机会。'
    },
    {
      title: '潦草的记录 · 关于猎犬',
      text: '它看不见你，但它听得见你。\n\n走路它也许不会来；奔跑它一定来。\n\n如果真的跑起来了——别停，别回头。\n\n它比你更熟悉转角。'
    },
    {
      title: '撕下的墙纸 · 笑魇',
      text: '笑魇只在没有灯的地方出现。\n\n它不碰你。它只是让你记住它的笑。\n\n把手电照上去，它会不高兴地走开。\n\n如果你没带手电……那就别盯着看。'
    },
    {
      title: '维修单 · 货运电梯',
      text: '三枚保险丝，三个方向。\n\n别问为什么要把备件分散到这么远的地方。\n\n设计这层楼的人早就不在了。\n\n装好之后，电梯需要一点时间。留在附近，不要乱跑。'
    },
    {
      title: '地图师的最后记录',
      text: '我沿着地毯的接缝走，画了七页纸。\n\n第八页开始，走廊和我画的对不上。\n\n如果你捡到这张纸——别相信它，也别相信我。\n\n相信你自己的脚步。'
    }
  ];

  class Level {
    constructor(scene) {
      this.scene = scene;
      this.group = new THREE.Group();
      this.group.name = 'level0';
      scene.add(this.group);

      this.W = 31;
      this.H = 31;
      this.CELL = 4.4;
      this.WALL_H = 2.92;
      this.T = 0.26;

      this.colliders = [];
      this.hash = new Map();
      this.wallSegments = [];
      this.fixtures = [];
      this.items = [];
      this.interactables = [];
      this.ownedTextures = [];
      this.explored = new Uint8Array(this.W * this.H);
      this.time = 0;
      this.brownout = 0;
      this.spawnCell = { x: 15, z: 15 };
      this.noteTexts = NOTES;

      this.materials = [];
      this.geometries = [];

      this.generateMaze();
      this.buildFloorCeiling();
      this.buildWalls();
      this.buildFixtures();
      this.buildProps();
      this.buildDecals();
      this.buildLift();
      this.buildDust();
      this.placeItems();
      this.buildLightPool();

      this.spawnPos = this.cellToWorld(this.spawnCell.x, this.spawnCell.z);
      this.spawnPos.z += 1.0;
      this.spawnYaw = 0;
    }

    /* ==================== 迷宫生成 ==================== */
    generateMaze() {
      const W = this.W, H = this.H;
      this.hWalls = new Uint8Array(W * (H + 1)).fill(1);
      this.vWalls = new Uint8Array((W + 1) * H).fill(1);

      const visited = new Uint8Array(W * H);
      const sx = W >> 1, sz = H >> 1;
      const stack = [[sx, sz]];
      visited[sz * W + sx] = 1;

      while (stack.length) {
        const cur = stack[stack.length - 1];
        const dirs = [[0, -1], [1, 0], [0, 1], [-1, 0]];
        for (let i = dirs.length - 1; i > 0; i--) {
          const j = (Math.random() * (i + 1)) | 0;
          const t = dirs[i]; dirs[i] = dirs[j]; dirs[j] = t;
        }
        let moved = false;
        for (let i = 0; i < 4; i++) {
          const nx = cur[0] + dirs[i][0];
          const nz = cur[1] + dirs[i][1];
          if (nx < 0 || nx >= W || nz < 0 || nz >= H) continue;
          if (visited[nz * W + nx]) continue;
          this.knock(cur[0], cur[1], dirs[i][0], dirs[i][1]);
          visited[nz * W + nx] = 1;
          stack.push([nx, nz]);
          moved = true;
          break;
        }
        if (!moved) stack.pop();
      }

      // 打通部分墙壁，制造环路和大厅
      for (let z = 1; z < H; z++) {
        for (let x = 0; x < W; x++) {
          if (Math.random() < 0.30) this.hWalls[z * W + x] = 0;
        }
      }
      for (let z = 0; z < H; z++) {
        for (let x = 1; x < W; x++) {
          if (Math.random() < 0.30) this.vWalls[z * (W + 1) + x] = 0;
        }
      }

      // 房间
      for (let i = 0; i < 8; i++) {
        const rw = 3 + ((Math.random() * 3) | 0);
        const rh = 3 + ((Math.random() * 3) | 0);
        const rx = 3 + ((Math.random() * (W - rw - 6)) | 0);
        const rz = 3 + ((Math.random() * (H - rh - 6)) | 0);
        for (let x = rx; x < rx + rw; x++) {
          for (let z = rz; z < rz + rh; z++) {
            if (z > 0) this.hWalls[z * W + x] = 0;
            if (z + 1 < H) this.hWalls[(z + 1) * W + x] = 0;
            if (x > 0) this.vWalls[z * (W + 1) + x] = 0;
            if (x + 1 < W) this.vWalls[z * (W + 1) + x + 1] = 0;
          }
        }
      }

      // 出生房间
      const cx = this.spawnCell.x, cz = this.spawnCell.z;
      const x0 = cx - 2, x1 = cx + 2;
      const z0 = cz - 1, z1 = cz + 3;
      for (let x = x0; x <= x1; x++) {
        for (let z = z0; z <= z1; z++) {
          if (z > 0 && z < H) this.hWalls[z * W + x] = 0;
          if (z + 1 < H) this.hWalls[(z + 1) * W + x] = 0;
          if (x > 0) this.vWalls[z * (W + 1) + x] = 0;
          if (x + 1 < W) this.vWalls[z * (W + 1) + x + 1] = 0;
        }
      }
      // 电梯所在的整面墙保持完整
      for (let x = x0; x <= x1; x++) this.hWalls[cz * W + x] = 1;
      this.hWalls[(cz + 1) * W + cx] = 0;
      // 房间两侧留门洞
      for (let z = cz; z <= cz + 2; z++) {
        this.vWalls[z * (W + 1) + (x0 + 1)] = 0;
        this.vWalls[z * (W + 1) + (x1 + 1)] = 0;
      }
    }

    knock(x, z, dx, dz) {
      const W = this.W;
      if (dx === 1) this.vWalls[z * (W + 1) + x + 1] = 0;
      else if (dx === -1) this.vWalls[z * (W + 1) + x] = 0;
      else if (dz === 1) this.hWalls[(z + 1) * W + x] = 0;
      else if (dz === -1) this.hWalls[z * W + x] = 0;
    }

    cellToWorld(cx, cz) {
      return new THREE.Vector3((cx + 0.5) * this.CELL, 0, (cz + 0.5) * this.CELL);
    }
    worldToCell(x, z) {
      return {
        x: Math.max(0, Math.min(this.W - 1, Math.floor(x / this.CELL))),
        z: Math.max(0, Math.min(this.H - 1, Math.floor(z / this.CELL)))
      };
    }
    canWalk(cx, cz, nx, nz) {
      const W = this.W;
      if (nx < 0 || nx >= W || nz < 0 || nz >= this.H) return false;
      if (nx === cx + 1) return this.vWalls[cz * (W + 1) + cx + 1] === 0;
      if (nx === cx - 1) return this.vWalls[cz * (W + 1) + cx] === 0;
      if (nz === cz + 1) return this.hWalls[(cz + 1) * W + cx] === 0;
      if (nz === cz - 1) return this.hWalls[cz * W + cx] === 0;
      return false;
    }

    bfs(start, goal) {
      const W = this.W, H = this.H;
      const sIdx = start.z * W + start.x;
      const gIdx = goal.z * W + goal.x;
      if (!this.isOpen(start.x, start.z) || !this.isOpen(goal.x, goal.z)) return null;
      const prev = new Int32Array(W * H).fill(-1);
      const q = new Int32Array(W * H);
      let qh = 0, qt = 0;
      q[qt++] = sIdx;
      prev[sIdx] = sIdx;
      const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
      let found = false;
      while (qh < qt) {
        const cur = q[qh++];
        if (cur === gIdx) { found = true; break; }
        const cx = cur % W, cz = (cur / W) | 0;
        for (let i = 0; i < 4; i++) {
          const nx = cx + dirs[i][0], nz = cz + dirs[i][1];
          if (!this.canWalk(cx, cz, nx, nz)) continue;
          const ni = nz * W + nx;
          if (prev[ni] !== -1) continue;
          prev[ni] = cur;
          q[qt++] = ni;
        }
      }
      if (!found) return null;
      const path = [];
      let cur = gIdx;
      let guard = 0;
      while (cur !== sIdx && guard++ < W * H) {
        path.push({ x: cur % W, z: (cur / W) | 0 });
        cur = prev[cur];
        if (cur === -1) return null;
      }
      path.reverse();
      return path;
    }

    isOpen(x, z) {
      return x >= 0 && x < this.W && z >= 0 && z < this.H;
    }

    randomOpenCell(options) {
      const o = options || {};
      const W = this.W, H = this.H;
      const sp = this.cellToWorld(this.spawnCell.x, this.spawnCell.z);
      for (let attempt = 0; attempt < 900; attempt++) {
        const x = 1 + ((Math.random() * (W - 2)) | 0);
        const z = 1 + ((Math.random() * (H - 2)) | 0);
        const w = this.cellToWorld(x, z);
        const d = Math.hypot(w.x - sp.x, w.z - sp.z);
        if (o.minDist !== undefined && d < o.minDist) continue;
        if (o.maxDist !== undefined && d > o.maxDist) continue;
        if (o.sector) {
          let a = Math.atan2(w.z - sp.z, w.x - sp.x);
          if (a < 0) a += Math.PI * 2;
          const r = o.sectorRotation || 0;
          let rel = a - r;
          while (rel < 0) rel += Math.PI * 2;
          while (rel >= Math.PI * 2) rel -= Math.PI * 2;
          if (rel < o.sector[0] || rel > o.sector[1]) continue;
        }
        if (o.used) {
          let bad = false;
          for (let i = 0; i < o.used.length; i++) {
            const p = o.used[i];
            if (Math.hypot(p.x - w.x, p.z - w.z) < (o.minGap || 10)) { bad = true; break; }
          }
          if (bad) continue;
        }
        return { x, z, w };
      }
      return null;
    }

    /* ==================== 地面 / 天花板 ==================== */
    buildFloorCeiling() {
      const sizeX = this.W * this.CELL;
      const sizeZ = this.H * this.CELL;

      const floorTex = T().get('carpet').clone();
      floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping;
      floorTex.repeat.set(sizeX / 3.4, sizeZ / 3.4);
      floorTex.needsUpdate = true;
      this.ownedTextures.push(floorTex);

      const floorMat = new THREE.MeshStandardMaterial({
        map: floorTex, roughness: 0.97, metalness: 0.0, color: 0xffffff,
        emissive: 0x241f12, emissiveIntensity: 0.24
      });
      const floorGeo = new THREE.PlaneGeometry(sizeX, sizeZ);
      const floor = new THREE.Mesh(floorGeo, floorMat);
      floor.rotation.x = -Math.PI / 2;
      floor.position.set(sizeX / 2, 0, sizeZ / 2);
      this.group.add(floor);
      this.materials.push(floorMat);
      this.geometries.push(floorGeo);

      const ceilTex = T().get('ceiling').clone();
      ceilTex.wrapS = ceilTex.wrapT = THREE.RepeatWrapping;
      ceilTex.repeat.set(sizeX / 2.7, sizeZ / 2.7);
      ceilTex.needsUpdate = true;
      this.ownedTextures.push(ceilTex);

      const ceilMat = new THREE.MeshStandardMaterial({
        map: ceilTex, roughness: 0.95, metalness: 0.0, color: 0xd2cfb8,
        emissive: 0xffffff, emissiveMap: ceilTex, emissiveIntensity: 0.26
      });
      const ceilGeo = new THREE.PlaneGeometry(sizeX, sizeZ);
      const ceil = new THREE.Mesh(ceilGeo, ceilMat);
      ceil.rotation.x = Math.PI / 2;
      ceil.position.set(sizeX / 2, this.WALL_H, sizeZ / 2);
      this.group.add(ceil);
      this.materials.push(ceilMat);
      this.geometries.push(ceilGeo);
    }

    /* ==================== 墙体 ==================== */
    buildWalls() {
      const W = this.W, H = this.H;
      let hCount = 0, vCount = 0;
      for (let i = 0; i < this.hWalls.length; i++) if (this.hWalls[i]) hCount++;
      for (let i = 0; i < this.vWalls.length; i++) if (this.vWalls[i]) vCount++;
      // 电梯所在的墙面留出洞口（碰撞仍然保留）
      hCount -= 1;

      const wallMat = new THREE.MeshStandardMaterial({
        map: T().get('wallpaper'), roughness: 0.9, metalness: 0.02, color: 0xffffff,
        emissive: 0xffe6b0, emissiveMap: T().get('wallpaper'), emissiveIntensity: 0.06
      });
      this.materials.push(wallMat);

      const hGeo = new THREE.BoxGeometry(this.CELL + this.T, this.WALL_H, this.T);
      const vGeo = new THREE.BoxGeometry(this.T, this.WALL_H, this.CELL + this.T);
      this.geometries.push(hGeo, vGeo);

      const hMesh = new THREE.InstancedMesh(hGeo, wallMat, hCount);
      const vMesh = new THREE.InstancedMesh(vGeo, wallMat, vCount);
      hMesh.frustumCulled = false;
      vMesh.frustumCulled = false;
      const mat4 = new THREE.Matrix4();
      const col = new THREE.Color();

      let hi = 0, vi = 0;
      for (let z = 0; z <= H; z++) {
        for (let x = 0; x < W; x++) {
          if (!this.hWalls[z * W + x]) continue;
          const px = (x + 0.5) * this.CELL;
          const pz = z * this.CELL;
          const isLiftWall = (x === this.spawnCell.x && z === this.spawnCell.z);
          if (!isLiftWall) {
            mat4.makeTranslation(px, this.WALL_H / 2, pz);
            hMesh.setMatrixAt(hi, mat4);
            const v = 0.82 + Math.random() * 0.18;
            col.setRGB(v, v, v);
            hMesh.setColorAt(hi, col);
            hi++;
            this.wallSegments.push({ orient: 'h', x: px, z: pz });
          }
          this.addCollider(px - (this.CELL + this.T) / 2, px + (this.CELL + this.T) / 2,
            pz - this.T / 2, pz + this.T / 2);
        }
      }
      for (let z = 0; z < H; z++) {
        for (let x = 0; x <= W; x++) {
          if (!this.vWalls[z * (W + 1) + x]) continue;
          const px = x * this.CELL;
          const pz = (z + 0.5) * this.CELL;
          mat4.makeTranslation(px, this.WALL_H / 2, pz);
          vMesh.setMatrixAt(vi, mat4);
          const v = 0.82 + Math.random() * 0.18;
          col.setRGB(v, v, v);
          vMesh.setColorAt(vi, col);
          vi++;
          this.addCollider(px - this.T / 2, px + this.T / 2,
            pz - (this.CELL + this.T) / 2, pz + (this.CELL + this.T) / 2);
          this.wallSegments.push({ orient: 'v', x: px, z: pz });
        }
      }
      hMesh.instanceMatrix.needsUpdate = true;
      vMesh.instanceMatrix.needsUpdate = true;
      if (hMesh.instanceColor) hMesh.instanceColor.needsUpdate = true;
      if (vMesh.instanceColor) vMesh.instanceColor.needsUpdate = true;
      this.group.add(hMesh, vMesh);
    }

    addCollider(minX, maxX, minZ, maxZ) {
      const box = { minX, maxX, minZ, maxZ };
      this.colliders.push(box);
      const cs = this.CELL;
      const i0 = Math.floor(minX / cs), i1 = Math.floor(maxX / cs);
      const j0 = Math.floor(minZ / cs), j1 = Math.floor(maxZ / cs);
      for (let ix = i0; ix <= i1; ix++) {
        for (let iz = j0; iz <= j1; iz++) {
          const key = ix + ',' + iz;
          let arr = this.hash.get(key);
          if (!arr) { arr = []; this.hash.set(key, arr); }
          arr.push(box);
        }
      }
    }

    isBlocked(x, z, r) {
      r = r === undefined ? 0.32 : r;
      const cs = this.CELL;
      const i0 = Math.floor((x - r) / cs), i1 = Math.floor((x + r) / cs);
      const j0 = Math.floor((z - r) / cs), j1 = Math.floor((z + r) / cs);
      for (let ix = i0; ix <= i1; ix++) {
        for (let iz = j0; iz <= j1; iz++) {
          const arr = this.hash.get(ix + ',' + iz);
          if (!arr) continue;
          for (let k = 0; k < arr.length; k++) {
            const b = arr[k];
            const nx = Math.max(b.minX, Math.min(x, b.maxX));
            const nz = Math.max(b.minZ, Math.min(z, b.maxZ));
            const dx = x - nx, dz = z - nz;
            if (dx * dx + dz * dz < r * r) return true;
          }
        }
      }
      return false;
    }

    hasLOS(ax, az, bx, bz) {
      const dx = bx - ax, dz = bz - az;
      const dist = Math.hypot(dx, dz);
      if (dist < 0.001) return true;
      const steps = Math.ceil(dist / 0.22);
      for (let i = 1; i < steps; i++) {
        const t = i / steps;
        if (this.isBlocked(ax + dx * t, az + dz * t, 0.06)) return false;
      }
      return true;
    }

    /* ==================== 灯 ==================== */
    buildFixtures() {
      const W = this.W, H = this.H;
      const cells = [];
      for (let z = 1; z < H; z += 2) {
        for (let x = 1; x < W; x += 2) {
          if (Math.random() < 0.42) continue;
          cells.push({ x, z });
        }
      }
      const sc = this.spawnCell;
      cells.push({ x: sc.x - 1, z: sc.z + 1 });
      cells.push({ x: sc.x + 2, z: sc.z + 2 });
      cells.push({ x: sc.x, z: sc.z });
      cells.push({ x: sc.x, z: sc.z + 2 });
      const seen = new Set();
      for (let i = cells.length - 1; i >= 0; i--) {
        const key = cells[i].x + ',' + cells[i].z;
        if (seen.has(key)) cells.splice(i, 1);
        else seen.add(key);
      }

      const panelGeo = new THREE.PlaneGeometry(1.35, 0.62);
      panelGeo.rotateX(Math.PI / 2);
      const panelMat = new THREE.MeshBasicMaterial({
        map: T().get('lightPanel'), color: 0xfff3cc, fog: true, toneMapped: false
      });
      const glowGeo = new THREE.PlaneGeometry(2.3, 1.4);
      glowGeo.rotateX(Math.PI / 2);
      const glowMat = new THREE.MeshBasicMaterial({
        map: T().get('glow'), color: 0xffd88a, transparent: true,
        opacity: 0.32, depthWrite: false, blending: THREE.AdditiveBlending, fog: true
      });

      const panelMesh = new THREE.InstancedMesh(panelGeo, panelMat, cells.length);
      const glowMesh = new THREE.InstancedMesh(glowGeo, glowMat, cells.length);
      panelMesh.frustumCulled = false;
      glowMesh.frustumCulled = false;
      this.geometries.push(panelGeo, glowGeo);
      this.materials.push(panelMat, glowMat);

      const m = new THREE.Matrix4();
      const col = new THREE.Color();
      for (let i = 0; i < cells.length; i++) {
        const c = cells[i];
        const w = this.cellToWorld(c.x, c.z);
        const y = this.WALL_H - 0.03;
        m.makeTranslation(w.x, y, w.z);
        panelMesh.setMatrixAt(i, m);
        m.makeTranslation(w.x, y - 0.06, w.z);
        glowMesh.setMatrixAt(i, m);
        col.setRGB(1, 1, 1);
        panelMesh.setColorAt(i, col);
        glowMesh.setColorAt(i, col);

        this.fixtures.push({
          x: w.x, z: w.z,
          base: 0.82 + Math.random() * 0.18,
          brightness: 1,
          dead: Math.random() < 0.075,
          phase: Math.random() * 100,
          flickTimer: 1 + Math.random() * 8,
          sparkT: 0,
          idx: i
        });
      }
      panelMesh.instanceMatrix.needsUpdate = true;
      glowMesh.instanceMatrix.needsUpdate = true;
      if (panelMesh.instanceColor) panelMesh.instanceColor.needsUpdate = true;
      if (glowMesh.instanceColor) glowMesh.instanceColor.needsUpdate = true;
      this.panelMesh = panelMesh;
      this.glowMesh = glowMesh;
      this.group.add(panelMesh, glowMesh);
      this.colorTimer = 0;
    }

    buildLightPool() {
      this.pointLights = [];
      for (let i = 0; i < 5; i++) {
        const l = new THREE.PointLight(0xffe2ab, 0, 20, 1.85);
        this.group.add(l);
        this.pointLights.push(l);
      }
    }

    updateFixtures(dt, playerPos) {
      const t = this.time;
      if (this.brownout > 0) this.brownout -= dt;
      const near = [];
      const R2 = 34 * 34;
      for (let i = 0; i < this.fixtures.length; i++) {
        const f = this.fixtures[i];
        const dx = f.x - playerPos.x, dz = f.z - playerPos.z;
        const d2 = dx * dx + dz * dz;
        if (d2 > R2) continue;

        f.flickTimer -= dt;
        if (f.flickTimer <= 0) {
          f.flickTimer = 2.5 + Math.random() * 9;
          if (!f.dead && Math.random() < 0.4) f.sparkT = 0.12 + Math.random() * 1.3;
        }
        if (f.sparkT > 0) {
          f.sparkT -= dt;
          f.brightness = Math.random() < 0.55 ? 1.0 : 0.04;
        } else if (f.dead) {
          f.brightness = 0;
        } else {
          let b = f.base * (0.9 + 0.1 * Math.sin(t * 2.4 + f.phase));
          if (this.brownout > 0) b *= Math.random() < 0.5 ? 0.15 : 0.85;
          f.brightness = b;
        }
        near.push({ f, d: Math.sqrt(d2) });
      }

      near.sort((a, b) => a.d - b.d);
      for (let i = 0; i < this.pointLights.length; i++) {
        const l = this.pointLights[i];
        const n = near[i];
        if (n && n.d < 30 && n.f.brightness > 0.03) {
          l.position.set(n.f.x, this.WALL_H - 0.22, n.f.z);
          l.intensity = 62 * n.f.brightness;
        } else {
          l.intensity = 0;
        }
      }

      this.colorTimer -= dt;
      if (this.colorTimer <= 0) {
        this.colorTimer = 0.09;
        const col = new THREE.Color();
        for (let i = 0; i < near.length; i++) {
          const f = near[i].f;
          const b = f.brightness;
          col.setRGB(b, b, b);
          this.panelMesh.setColorAt(f.idx, col);
          this.glowMesh.setColorAt(f.idx, col);
        }
        if (this.panelMesh.instanceColor) this.panelMesh.instanceColor.needsUpdate = true;
        if (this.glowMesh.instanceColor) this.glowMesh.instanceColor.needsUpdate = true;
      }
    }

    getLightAt(pos) {
      let best = 0;
      for (let i = 0; i < this.fixtures.length; i++) {
        const f = this.fixtures[i];
        if (f.brightness <= 0.03) continue;
        const d = Math.hypot(f.x - pos.x, f.z - pos.z);
        if (d > 9) continue;
        const v = f.brightness * (1 - d / 9);
        if (v > best) best = v;
      }
      return best;
    }

    setBrownout(sec) { this.brownout = sec; }

    /* ==================== 杂物 ==================== */
    buildProps() {
      const crateMat = new THREE.MeshStandardMaterial({
        map: T().get('wood'), roughness: 0.88, color: 0xb8a88c
      });
      const barrelMat = new THREE.MeshStandardMaterial({
        map: T().get('metalDark'), roughness: 0.62, metalness: 0.22, color: 0xb6b7a6
      });
      this.materials.push(crateMat, barrelMat);

      const crateGeo = new THREE.BoxGeometry(0.92, 0.82, 0.92);
      const smallCrateGeo = new THREE.BoxGeometry(0.6, 0.55, 0.6);
      const barrelGeo = new THREE.CylinderGeometry(0.33, 0.33, 0.94, 12);
      this.geometries.push(crateGeo, smallCrateGeo, barrelGeo);

      const used = [];
      for (let i = 0; i < 26; i++) {
        const c = this.randomOpenCell({ minDist: 9, used, minGap: 5 });
        if (!c) continue;
        used.push({ x: c.w.x, z: c.w.z });
        const g = new THREE.Group();
        const big = new THREE.Mesh(crateGeo, crateMat);
        big.position.y = 0.41;
        big.rotation.y = Math.random() * 0.7 - 0.35;
        g.add(big);
        if (Math.random() < 0.4) {
          const small = new THREE.Mesh(smallCrateGeo, crateMat);
          small.position.set(0.08, 1.1, 0.05);
          small.rotation.y = Math.random() * 1.2;
          g.add(small);
        }
        const ox = (Math.random() - 0.5) * (this.CELL - 2.0);
        const oz = (Math.random() - 0.5) * (this.CELL - 2.0);
        g.position.set(c.w.x + ox, 0, c.w.z + oz);
        this.group.add(g);
        this.addCollider(g.position.x - 0.55, g.position.x + 0.55, g.position.z - 0.55, g.position.z + 0.55);
      }

      for (let i = 0; i < 12; i++) {
        const c = this.randomOpenCell({ minDist: 12, used, minGap: 6 });
        if (!c) continue;
        used.push({ x: c.w.x, z: c.w.z });
        const b = new THREE.Mesh(barrelGeo, barrelMat);
        const ox = (Math.random() - 0.5) * (this.CELL - 2.2);
        const oz = (Math.random() - 0.5) * (this.CELL - 2.2);
        b.position.set(c.w.x + ox, 0.47, c.w.z + oz);
        b.rotation.y = Math.random() * 3;
        this.group.add(b);
        this.addCollider(b.position.x - 0.38, b.position.x + 0.38, b.position.z - 0.38, b.position.z + 0.38);
      }

      const pipeGeo = new THREE.CylinderGeometry(0.075, 0.075, this.CELL, 7);
      const pipeMat = new THREE.MeshStandardMaterial({
        map: T().get('metalDark'), color: 0x8a8772, roughness: 0.6, metalness: 0.25
      });
      this.geometries.push(pipeGeo);
      this.materials.push(pipeMat);
      for (let i = 0; i < 34; i++) {
        const x = 1 + ((Math.random() * (this.W - 2)) | 0);
        const z = 1 + ((Math.random() * (this.H - 2)) | 0);
        const w = this.cellToWorld(x, z);
        const pipe = new THREE.Mesh(pipeGeo, pipeMat);
        pipe.position.set(w.x, this.WALL_H - 0.26 - Math.random() * 0.12, w.z);
        if (Math.random() < 0.5) pipe.rotation.z = Math.PI / 2;
        else pipe.rotation.x = Math.PI / 2;
        this.group.add(pipe);
      }
    }

    /* ==================== 贴花 ==================== */
    buildDecals() {
      const stainTex = T().get('stain');
      const puddleTex = T().get('puddle');
      const graff = T().get('graffiti');

      const stainMat = new THREE.MeshBasicMaterial({
        map: stainTex, transparent: true, opacity: 0.65, depthWrite: false,
        polygonOffset: true, polygonOffsetFactor: -2, color: 0x8a7c58
      });
      const puddleMat = new THREE.MeshBasicMaterial({
        map: puddleTex, transparent: true, opacity: 0.5, depthWrite: false,
        polygonOffset: true, polygonOffsetFactor: -1, color: 0xb9b79a
      });
      const grafMats = graff.map(function (tex) {
        return new THREE.MeshBasicMaterial({
          map: tex, transparent: true, opacity: 0.62, depthWrite: false,
          polygonOffset: true, polygonOffsetFactor: -2, color: 0x8f8158
        });
      });
      this.materials.push(stainMat, puddleMat);
      for (let i = 0; i < grafMats.length; i++) this.materials.push(grafMats[i]);

      const spawnW = this.cellToWorld(this.spawnCell.x, this.spawnCell.z);
      const segs = this.wallSegments;

      for (let i = 0; i < 48; i++) {
        const seg = segs[(Math.random() * segs.length) | 0];
        if (!seg) continue;
        if (Math.abs(seg.x - spawnW.x) < 0.5 && Math.abs(seg.z - spawnW.z) < 3.5) continue;
        const isGraf = i < 12;
        const mat = isGraf ? grafMats[(Math.random() * grafMats.length) | 0] : stainMat;
        const w = isGraf ? 2.3 : 1.1 + Math.random() * 1.1;
        const h = isGraf ? 1.15 : w;
        const geo = new THREE.PlaneGeometry(w, h);
        this.geometries.push(geo);
        const mesh = new THREE.Mesh(geo, mat);

        if (seg.orient === 'h') {
          const south = Math.random() < 0.5;
          const nz = south ? 1 : -1;
          mesh.position.set(seg.x, isGraf ? 1.55 : 0.5 + Math.random() * 1.6, seg.z + nz * (this.T / 2 + 0.014));
          mesh.rotation.y = south ? 0 : Math.PI;
        } else {
          const east = Math.random() < 0.5;
          const nx = east ? 1 : -1;
          mesh.position.set(seg.x + nx * (this.T / 2 + 0.014), isGraf ? 1.55 : 0.5 + Math.random() * 1.6, seg.z);
          mesh.rotation.y = east ? Math.PI / 2 : -Math.PI / 2;
        }
        if (isGraf) mesh.rotation.z = (Math.random() - 0.5) * 0.12;
        this.group.add(mesh);
      }

      for (let i = 0; i < 40; i++) {
        const x = Math.random() * this.W * this.CELL;
        const z = Math.random() * this.H * this.CELL;
        const isPuddle = i < 12;
        const s = isPuddle ? 1.6 + Math.random() * 1.4 : 1.2 + Math.random() * 1.8;
        const geo = new THREE.PlaneGeometry(s, s * (0.7 + Math.random() * 0.5));
        this.geometries.push(geo);
        const mesh = new THREE.Mesh(geo, isPuddle ? puddleMat : stainMat);
        mesh.rotation.x = -Math.PI / 2;
        mesh.rotation.z = Math.random() * Math.PI * 2;
        mesh.position.set(x, isPuddle ? 0.016 : 0.011, z);
        this.group.add(mesh);
      }
    }

    /* ==================== 电梯 ==================== */
    buildLift() {
      const sc = this.spawnCell;
      const cx = (sc.x + 0.5) * this.CELL;
      const wallZ = sc.z * this.CELL;
      const g = new THREE.Group();
      g.position.set(cx, 0, wallZ + this.T / 2);

      // 洞口两侧的墙垛
      const fillerMat = new THREE.MeshStandardMaterial({
        map: T().get('wallpaper'), roughness: 0.9, metalness: 0.02,
        emissive: 0xffe6b0, emissiveMap: T().get('wallpaper'), emissiveIntensity: 0.06
      });
      const fillerGeo = new THREE.BoxGeometry(1.05, this.WALL_H, this.T);
      const fillerL = new THREE.Mesh(fillerGeo, fillerMat);
      fillerL.position.set(-(1.28 + 0.525), this.WALL_H / 2, -this.T / 2);
      const fillerR = new THREE.Mesh(fillerGeo, fillerMat);
      fillerR.position.set(1.28 + 0.525, this.WALL_H / 2, -this.T / 2);
      g.add(fillerL, fillerR);
      this.geometries.push(fillerGeo);
      this.materials.push(fillerMat);

      const frameMat = new THREE.MeshStandardMaterial({
        map: T().get('metal'), color: 0xc7c4ad, roughness: 0.62, metalness: 0.22
      });
      const postGeo = new THREE.BoxGeometry(0.44, 2.58, 0.36);
      const leftPost = new THREE.Mesh(postGeo, frameMat);
      leftPost.position.set(-1.49, 1.29, 0.06);
      const rightPost = new THREE.Mesh(postGeo, frameMat);
      rightPost.position.set(1.49, 1.29, 0.06);
      const lintelGeo = new THREE.BoxGeometry(2.56, 0.3, 0.36);
      const lintel = new THREE.Mesh(lintelGeo, frameMat);
      lintel.position.set(0, 2.43, 0.06);
      const sillGeo = new THREE.BoxGeometry(2.56, 0.09, 0.44);
      const sill = new THREE.Mesh(sillGeo, frameMat);
      sill.position.set(0, 0.045, 0.1);
      g.add(leftPost, rightPost, lintel, sill);

      const headerGeo = new THREE.BoxGeometry(3.5, 0.62, 0.4);
      const headerMat = new THREE.MeshStandardMaterial({
        map: T().get('metal'), color: 0xbdb9a0, roughness: 0.55, metalness: 0.22
      });
      const header = new THREE.Mesh(headerGeo, headerMat);
      header.position.set(0, 2.75, 0.08);
      g.add(header);

      const signGeo = new THREE.PlaneGeometry(2.1, 0.53);
      const signMat = new THREE.MeshBasicMaterial({ map: T().get('liftSign'), toneMapped: false });
      const sign = new THREE.Mesh(signGeo, signMat);
      sign.position.set(0, 2.75, 0.285);
      g.add(sign);

      const doorGeo = new THREE.PlaneGeometry(1.28, 2.28);
      const doorMat = new THREE.MeshStandardMaterial({
        map: T().get('liftDoor'), roughness: 0.55, metalness: 0.18, color: 0xd6d1c0
      });
      const left = new THREE.Mesh(doorGeo, doorMat);
      left.position.set(-0.645, 1.19, 0.14);
      const right = new THREE.Mesh(doorGeo, doorMat);
      right.position.set(0.645, 1.19, 0.14);
      g.add(left, right);

      const lampGeo = new THREE.SphereGeometry(0.055, 10, 8);
      const lampMat = new THREE.MeshBasicMaterial({ color: 0x8b2a18, toneMapped: false });
      const lamp = new THREE.Mesh(lampGeo, lampMat);
      lamp.position.set(1.42, 2.66, 0.3);
      g.add(lamp);

      const panelGeo = new THREE.BoxGeometry(0.26, 0.46, 0.1);
      const panelMat = new THREE.MeshStandardMaterial({ color: 0x63635a, roughness: 0.62, metalness: 0.2 });
      const panel = new THREE.Mesh(panelGeo, panelMat);
      panel.position.set(1.85, 1.32, 0.25);
      g.add(panel);

      const socketGeo = new THREE.SphereGeometry(0.028, 8, 6);
      const lampMats = [];
      for (let i = 0; i < 3; i++) {
        const m = new THREE.MeshBasicMaterial({ color: 0x2a2318, toneMapped: false });
        const s = new THREE.Mesh(socketGeo, m);
        s.position.set(1.85, 1.47 - i * 0.12, 0.31);
        g.add(s);
        lampMats.push(m);
      }

      const innerMat = new THREE.MeshStandardMaterial({
        map: T().get('metal'), color: 0x8f8a74, roughness: 0.5, metalness: 0.25
      });
      const backGeo = new THREE.PlaneGeometry(2.56, 2.4);
      const backMat = new THREE.MeshStandardMaterial({
        map: T().get('metal'), color: 0xd8d0b4, roughness: 0.42, metalness: 0.3
      });
      const backWall = new THREE.Mesh(backGeo, backMat);
      backWall.position.set(0, 1.2, -1.05);
      backWall.visible = false;
      g.add(backWall);

      // 轿厢灯带与扶手
      const stripGeo = new THREE.PlaneGeometry(1.5, 0.42);
      const stripMat = new THREE.MeshBasicMaterial({ color: 0xfff8e0, toneMapped: false });
      const strip = new THREE.Mesh(stripGeo, stripMat);
      strip.rotation.x = Math.PI / 2;
      strip.position.set(0, 2.39, -0.52);
      strip.visible = false;
      g.add(strip);

      const railGeo = new THREE.BoxGeometry(1.9, 0.05, 0.05);
      const railMat = new THREE.MeshStandardMaterial({ color: 0xc4bfa4, roughness: 0.35, metalness: 0.35 });
      const rail = new THREE.Mesh(railGeo, railMat);
      rail.position.set(0, 1.02, -0.97);
      rail.visible = false;
      g.add(rail);

      const sideGeo = new THREE.PlaneGeometry(1.1, 2.4);
      const sideL = new THREE.Mesh(sideGeo, innerMat);
      sideL.position.set(-1.27, 1.2, -0.5);
      sideL.rotation.y = Math.PI / 2;
      sideL.visible = false;
      const sideR = new THREE.Mesh(sideGeo, innerMat);
      sideR.position.set(1.27, 1.2, -0.5);
      sideR.rotation.y = -Math.PI / 2;
      sideR.visible = false;
      const inFloorGeo = new THREE.PlaneGeometry(2.56, 1.1);
      const inFloor = new THREE.Mesh(inFloorGeo, innerMat);
      inFloor.rotation.x = -Math.PI / 2;
      inFloor.position.set(0, 0.02, -0.5);
      inFloor.visible = false;
      const inCeil = new THREE.Mesh(inFloorGeo, innerMat);
      inCeil.rotation.x = Math.PI / 2;
      inCeil.position.set(0, 2.4, -0.5);
      inCeil.visible = false;
      g.add(sideL, sideR, inFloor, inCeil);

      const innerLight = new THREE.PointLight(0xfff0c8, 0, 4.2, 1.7);
      innerLight.position.set(0, 1.9, -0.6);
      g.add(innerLight);

      this.geometries.push(postGeo, lintelGeo, sillGeo, headerGeo, signGeo, doorGeo, lampGeo, panelGeo, socketGeo, backGeo, sideGeo, inFloorGeo, stripGeo, railGeo);
      this.materials.push(frameMat, headerMat, signMat, doorMat, lampMat, panelMat, innerMat, backMat, stripMat, railMat);

      this.group.add(g);
      this.addCollider(cx - 1.72, cx + 1.72, wallZ + this.T / 2, wallZ + this.T / 2 + 0.28);

      this.lift = {
        group: g, left: left, right: right,
        lampMat: lampMat, lampMats: lampMats,
        innerLight: innerLight, backWall: backWall,
        interior: [backWall, sideL, sideR, inFloor, inCeil, strip, rail],
        opening: false, openT: 0, open: false,
        pos: new THREE.Vector3(cx, 1.2, wallZ + this.T / 2 + 0.3)
      };

      this.liftInteract = {
        kind: 'lift',
        label: '检查货运电梯',
        pos: new THREE.Vector3(cx + 1.5, 1.2, wallZ + 0.85),
        radius: 2.9,
        enabled: true
      };
      this.interactables.push(this.liftInteract);
    }

    setFuseLamps(n) {
      if (!this.lift) return;
      for (let i = 0; i < this.lift.lampMats.length; i++) {
        this.lift.lampMats[i].color.setHex(i < n ? 0xd8b45a : 0x2a2318);
      }
    }

    powerOn() {
      if (!this.lift) return;
      this.lift.lampMat.color.setHex(0x7ecb6a);
      this.lift.innerLight.intensity = 14;
      for (let i = 0; i < this.lift.interior.length; i++) {
        this.lift.interior[i].visible = true;
      }
    }

    openLift() {
      if (!this.lift || this.lift.opening || this.lift.open) return;
      this.lift.opening = true;
      this.lift.openT = 0;
    }

    updateLift(dt) {
      const L = this.lift;
      if (!L) return;
      if (L.opening) {
        L.openT += dt;
        const k = Math.min(1, L.openT / 1.9);
        const e = k * k * (3 - 2 * k);
        L.left.position.x = -0.645 - e * 1.2;
        L.right.position.x = 0.645 + e * 1.2;
        L.innerLight.intensity = 14 + 18 * e;
        if (k >= 1) {
          L.opening = false;
          L.open = true;
          L.left.visible = false;
          L.right.visible = false;
          this.liftInteract.kind = 'elevator';
          this.liftInteract.label = '进入电梯 · 离开 Level 0';
        }
      }
    }

    /* ==================== 尘埃 ==================== */
    buildDust() {
      const N = 460;
      const pos = new Float32Array(N * 3);
      this.dustOffsets = [];
      for (let i = 0; i < N; i++) {
        const o = {
          x: (Math.random() - 0.5) * 26,
          y: 0.2 + Math.random() * 2.6,
          z: (Math.random() - 0.5) * 26
        };
        this.dustOffsets.push(o);
        pos[i * 3] = o.x;
        pos[i * 3 + 1] = o.y;
        pos[i * 3 + 2] = o.z;
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const mat = new THREE.PointsMaterial({
        size: 0.05, map: T().get('dust'), transparent: true, opacity: 0.38,
        depthWrite: false, blending: THREE.AdditiveBlending, color: 0xffeec4,
        sizeAttenuation: true, fog: true
      });
      this.dust = new THREE.Points(geo, mat);
      this.dust.frustumCulled = false;
      this.group.add(this.dust);
      this.geometries.push(geo);
      this.materials.push(mat);
    }

    updateDust(dt, playerPos) {
      if (!this.dust) return;
      const arr = this.dust.geometry.attributes.position.array;
      const B = 26;
      const t = this.time;
      for (let i = 0; i < this.dustOffsets.length; i++) {
        const o = this.dustOffsets[i];
        o.x += Math.sin(t * 0.3 + i) * dt * 0.08;
        o.y += (Math.sin(t * 0.5 + i * 1.7) * 0.5 - 0.05) * dt * 0.1;
        o.z += Math.cos(t * 0.25 + i * 0.7) * dt * 0.08;
        if (o.x > B / 2) o.x -= B;
        if (o.x < -B / 2) o.x += B;
        if (o.z > B / 2) o.z -= B;
        if (o.z < -B / 2) o.z += B;
        if (o.y < 0.15) o.y = 2.8;
        if (o.y > 2.85) o.y = 0.2;
        arr[i * 3] = playerPos.x + o.x;
        arr[i * 3 + 1] = o.y;
        arr[i * 3 + 2] = playerPos.z + o.z;
      }
      this.dust.geometry.attributes.position.needsUpdate = true;
    }

    /* ==================== 道具模型 ==================== */
    makeGlowSprite(color, scale) {
      const mat = new THREE.SpriteMaterial({
        map: T().get('glow'), color: color, transparent: true, opacity: 0.55,
        depthWrite: false, blending: THREE.AdditiveBlending, fog: true
      });
      this.materials.push(mat);
      const s = new THREE.Sprite(mat);
      s.scale.set(scale, scale, 1);
      return s;
    }

    makeFuse() {
      const g = new THREE.Group();
      const bodyGeo = new THREE.CylinderGeometry(0.052, 0.052, 0.24, 10);
      const bodyMat = new THREE.MeshStandardMaterial({
        color: 0xffc46a, emissive: 0xff8a1e, emissiveIntensity: 1.5, roughness: 0.25
      });
      g.add(new THREE.Mesh(bodyGeo, bodyMat));
      const capGeo = new THREE.CylinderGeometry(0.062, 0.062, 0.035, 10);
      const capMat = new THREE.MeshStandardMaterial({ color: 0xc9c3a6, metalness: 0.8, roughness: 0.35 });
      const cap1 = new THREE.Mesh(capGeo, capMat); cap1.position.y = 0.135; g.add(cap1);
      const cap2 = new THREE.Mesh(capGeo, capMat); cap2.position.y = -0.135; g.add(cap2);
      g.add(this.makeGlowSprite(0xffa040, 1.6));
      this.geometries.push(bodyGeo, capGeo);
      this.materials.push(bodyMat, capMat);
      return g;
    }

    makeWater() {
      const g = new THREE.Group();
      const bodyGeo = new THREE.CylinderGeometry(0.072, 0.078, 0.3, 12);
      const bodyMat = new THREE.MeshStandardMaterial({
        map: T().get('waterLabel'), color: 0xf0ead2, roughness: 0.28, metalness: 0.05,
        emissive: 0x3a3520, emissiveIntensity: 0.35
      });
      g.add(new THREE.Mesh(bodyGeo, bodyMat));
      const capGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.05, 10);
      const capMat = new THREE.MeshStandardMaterial({ color: 0xc7b06a, metalness: 0.6, roughness: 0.4 });
      const cap = new THREE.Mesh(capGeo, capMat);
      cap.position.y = 0.175;
      g.add(cap);
      g.add(this.makeGlowSprite(0xd8e0b0, 1.45));
      this.geometries.push(bodyGeo, capGeo);
      this.materials.push(bodyMat, capMat);
      return g;
    }

    makeBattery() {
      const g = new THREE.Group();
      const bodyGeo = new THREE.BoxGeometry(0.13, 0.22, 0.13);
      const bodyMat = new THREE.MeshStandardMaterial({
        color: 0x35443f, emissive: 0x143028, emissiveIntensity: 0.9, roughness: 0.35, metalness: 0.4
      });
      g.add(new THREE.Mesh(bodyGeo, bodyMat));
      const bandGeo = new THREE.BoxGeometry(0.135, 0.05, 0.135);
      const bandMat = new THREE.MeshBasicMaterial({ color: 0x9fd6b8 });
      const band = new THREE.Mesh(bandGeo, bandMat);
      band.position.y = 0.06;
      g.add(band);
      g.add(this.makeGlowSprite(0x8fd0c0, 1.3));
      this.geometries.push(bodyGeo, bandGeo);
      this.materials.push(bodyMat, bandMat);
      return g;
    }

    makeNote() {
      const g = new THREE.Group();
      const geo = new THREE.PlaneGeometry(0.3, 0.4);
      const mat = new THREE.MeshBasicMaterial({
        map: T().get('paper'), side: THREE.DoubleSide, color: 0xf4ecd2, toneMapped: false
      });
      const paper = new THREE.Mesh(geo, mat);
      paper.rotation.x = -Math.PI / 2;
      g.add(paper);
      g.add(this.makeGlowSprite(0xe8d9a0, 1.1));
      this.geometries.push(geo);
      this.materials.push(mat);
      return g;
    }

    addItem(kind, label, cell, y, buildFn, extra) {
      const g = buildFn();
      g.position.set(cell.w.x, y, cell.w.z);

      // 指引光柱（让远处的道具可以被看见）
      const beamColor = kind === 'fuse' ? 0xffa040 :
        kind === 'water' ? 0xbfe0a0 :
          kind === 'battery' ? 0x8fd8cc : 0xffe9b0;
      const beamGeo = new THREE.CylinderGeometry(0.13, 0.3, 1.55, 8, 1, true);
      const beamMat = new THREE.MeshBasicMaterial({
        color: beamColor, transparent: true, opacity: 0.085,
        depthWrite: false, blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide, fog: true
      });
      const beam = new THREE.Mesh(beamGeo, beamMat);
      beam.position.y = 0.4;
      g.add(beam);
      this.geometries.push(beamGeo);
      this.materials.push(beamMat);

      this.group.add(g);
      const item = {
        kind: kind, group: g, baseY: y, phase: Math.random() * 6.28,
        collected: false, discovered: false, cell: cell, data: extra || null
      };
      this.items.push(item);
      const it = {
        kind: kind, label: label,
        pos: new THREE.Vector3(cell.w.x, y, cell.w.z),
        radius: 2.7, enabled: true, item: item
      };
      item.interact = it;
      this.interactables.push(it);
      return item;
    }

    placeItems() {
      const used = [];
      const rot = Math.random() * Math.PI * 2;

      for (let i = 0; i < 6; i++) {
        const c = this.randomOpenCell({
          minDist: i === 0 ? 8 : 16,
          maxDist: 68,
          used: used, minGap: 11
        });
        if (!c) continue;
        used.push({ x: c.w.x, z: c.w.z });
        this.addItem('note', '阅读便条', c, 0.95, () => this.makeNote(), { noteIndex: i });
      }

      for (let i = 0; i < 3; i++) {
        let c = null;
        for (let attempt = 0; attempt < 6 && !c; attempt++) {
          c = this.randomOpenCell({
            minDist: 26, maxDist: 62,
            sector: [0.12, 1.95],
            sectorRotation: rot + i * (Math.PI * 2 / 3),
            used: used, minGap: 13
          });
        }
        if (!c) c = this.randomOpenCell({ minDist: 24, maxDist: 64, used: used, minGap: 10 });
        if (!c) continue;
        used.push({ x: c.w.x, z: c.w.z });
        this.addItem('fuse', '拾取保险丝', c, 0.5, () => this.makeFuse());
      }

      for (let i = 0; i < 4; i++) {
        const c = this.randomOpenCell({ minDist: 12, maxDist: 70, used: used, minGap: 12 });
        if (!c) continue;
        used.push({ x: c.w.x, z: c.w.z });
        this.addItem('water', '拾取杏仁水', c, 0.5, () => this.makeWater());
      }

      for (let i = 0; i < 3; i++) {
        const c = this.randomOpenCell({ minDist: 14, maxDist: 64, used: used, minGap: 12 });
        if (!c) continue;
        used.push({ x: c.w.x, z: c.w.z });
        this.addItem('battery', '拾取电池', c, 0.5, () => this.makeBattery());
      }
    }

    collectItem(item) {
      item.collected = true;
      item.interact.enabled = false;
      this.group.remove(item.group);
    }

    /* ==================== 更新 ==================== */
    markExplored(pos, radius) {
      const cx = Math.floor(pos.x / this.CELL);
      const cz = Math.floor(pos.z / this.CELL);
      const r = radius === undefined ? 1 : radius;
      for (let dz = -r; dz <= r; dz++) {
        for (let dx = -r; dx <= r; dx++) {
          const x = cx + dx, z = cz + dz;
          if (x < 0 || x >= this.W || z < 0 || z >= this.H) continue;
          this.explored[z * this.W + x] = 1;
        }
      }
    }

    update(dt, playerPos) {
      this.time += dt;
      this.updateFixtures(dt, playerPos);
      this.updateLift(dt);
      this.updateDust(dt, playerPos);
      this.markExplored(playerPos, 1);

      for (let i = 0; i < this.items.length; i++) {
        const it = this.items[i];
        if (it.collected) continue;
        const g = it.group;
        g.position.y = it.baseY + Math.sin(this.time * 1.6 + it.phase) * 0.035;
        g.rotation.y = this.time * (it.kind === 'note' ? 0.4 : 1.1) + it.phase;
        const d = Math.hypot(g.position.x - playerPos.x, g.position.z - playerPos.z);
        if (!it.discovered && d < 17) it.discovered = true;
      }
    }

    /* ==================== 小地图 ==================== */
    drawMinimap(ctx, player, time) {
      const W = this.W, H = this.H;
      const cw = ctx.canvas.width, ch = ctx.canvas.height;
      const pad = 10;
      const s = Math.min((cw - pad * 2) / W, (ch - pad * 2) / H);
      const ox = (cw - s * W) / 2;
      const oz = (ch - s * H) / 2;

      ctx.clearRect(0, 0, cw, ch);
      ctx.fillStyle = 'rgba(7,7,5,0.86)';
      ctx.fillRect(0, 0, cw, ch);

      ctx.fillStyle = 'rgba(150,132,78,0.16)';
      for (let z = 0; z < H; z++) {
        for (let x = 0; x < W; x++) {
          if (!this.explored[z * W + x]) continue;
          ctx.fillRect(ox + x * s, oz + z * s, s + 0.5, s + 0.5);
        }
      }

      ctx.strokeStyle = 'rgba(196,170,104,0.42)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      for (let z = 0; z < H; z++) {
        for (let x = 0; x < W; x++) {
          if (!this.explored[z * W + x]) continue;
          if (this.hWalls[z * W + x]) {
            ctx.moveTo(ox + x * s, oz + z * s);
            ctx.lineTo(ox + (x + 1) * s, oz + z * s);
          }
          if (this.vWalls[z * (W + 1) + x]) {
            ctx.moveTo(ox + x * s, oz + z * s);
            ctx.lineTo(ox + x * s, oz + (z + 1) * s);
          }
        }
      }
      ctx.stroke();

      for (let i = 0; i < this.items.length; i++) {
        const it = this.items[i];
        if (it.collected || !it.discovered) continue;
        const p = it.group.position;
        ctx.fillStyle = it.kind === 'fuse' ? '#d8724f' :
          it.kind === 'water' ? '#a9c98c' :
            it.kind === 'battery' ? '#8fc4c0' : '#cbbd90';
        ctx.beginPath();
        ctx.arc(ox + (p.x / this.CELL) * s, oz + (p.z / this.CELL) * s, 2.6, 0, 6.283);
        ctx.fill();
      }

      if (this.lift) {
        const pulse = 0.55 + 0.45 * Math.sin(time * 3);
        const lx = ox + (this.lift.pos.x / this.CELL) * s;
        const lz = oz + (this.lift.pos.z / this.CELL) * s;
        ctx.strokeStyle = 'rgba(140,220,130,' + pulse.toFixed(2) + ')';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.rect(lx - 4, lz - 4, 8, 8);
        ctx.stroke();
        ctx.fillStyle = 'rgba(140,220,130,' + (pulse * 0.5).toFixed(2) + ')';
        ctx.fillRect(lx - 2, lz - 2, 4, 4);
      }

      const px = ox + (player.pos.x / this.CELL) * s;
      const pz = oz + (player.pos.z / this.CELL) * s;
      ctx.save();
      ctx.translate(px, pz);
      ctx.rotate(-player.yaw);
      ctx.fillStyle = '#f3e2a8';
      ctx.beginPath();
      ctx.moveTo(0, -5.5);
      ctx.lineTo(3.8, 4.4);
      ctx.lineTo(0, 2.3);
      ctx.lineTo(-3.8, 4.4);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      ctx.strokeStyle = 'rgba(192,167,99,0.22)';
      ctx.lineWidth = 2;
      ctx.strokeRect(1, 1, cw - 2, ch - 2);
    }

    /* ==================== 清理 ==================== */
    dispose() {
      this.scene.remove(this.group);
      for (let i = 0; i < this.geometries.length; i++) {
        const g = this.geometries[i];
        if (g && g.dispose) g.dispose();
      }
      for (let i = 0; i < this.materials.length; i++) {
        const m = this.materials[i];
        if (m && m.dispose) m.dispose();
      }
      for (let i = 0; i < this.ownedTextures.length; i++) {
        const t = this.ownedTextures[i];
        if (t && t.dispose) t.dispose();
      }
      this.colliders.length = 0;
      this.hash.clear();
      this.geometries.length = 0;
      this.materials.length = 0;
    }
  }

  BR.Level = Level;
  BR.NOTES = NOTES;
})();
