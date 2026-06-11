import { ART_SIZE, generateAutoScript, type AutoAction } from './auto';
import { hexToRgb, jitterInk, toneInk, type RGB } from './color';
import { FluidSimulator } from './fluid/simulator';
import type { Palette } from './palettes';
import { mulberry32 } from './rng';

export { ART_SIZE } from './auto';

export type Tool = 'drop' | 'flow' | 'comb' | 'vortex';

export type GestureConfig = {
  /** ツールごとのスライダー値（論理px: しずくの半径、筆の太さなど） */
  value: number;
  /** しずくツールが次に使う色（hex）を返す */
  nextColor: () => string;
};

export type SessionSnapshot = {
  canUndo: boolean;
  canRedo: boolean;
  isEmpty: boolean;
  unsupported: boolean;
};

type HistoryEntry = {
  dye: Uint8Array;
  hasInk: boolean;
};

type Gesture = {
  tool: Tool;
  config: GestureConfig;
  /** uv 座標（0..1、v は上下反転済み） */
  originX: number;
  originY: number;
  lastX: number;
  lastY: number;
  lastEmitX: number;
  lastEmitY: number;
  historyPushed: boolean;
  /** このストロークの絵の具（1ストローク = 1色） */
  strokeColor: string;
  /** ストローク内の濃淡。ランダムウォークでなめらかに揺れる */
  tone: number;
};

const MAX_HISTORY = 10;
/** 操作が止まってからシミュレーションを眠らせるまでの時間 */
const IDLE_MS = 7000;
/** 1回のポインタ移動で渦に加える回転の上限（中心付近の暴れ防止） */
const MAX_VORTEX_STEP = 0.3;

// 力の強さ。見た目で調整したチューニング値
const FLOW_FORCE = 6000;
const DROP_TRAIL_FORCE = 1200;
const DROP_BURST = 150;
/** しずくはこの回数に分けて注がれる（中心が痩せない） */
const DROP_POUR_COUNT = 6;
const DROP_POUR_INTERVAL_MS = 45;
const COMB_FORCE = 3000;
const VORTEX_STRENGTH = 30;
const AUTO_SWIRL = 40;
const AUTO_SWEEP = 50;
/** くしの歯はポインタ周辺だけ（片側の本数）。本物の櫛を引く感覚に合わせる */
const COMB_TEETH_PER_SIDE = 2;
/** ストローク内の濃淡ウォークの歩幅と範囲 */
const TONE_STEP = 0.12;
const TONE_MIN = 0.78;
const TONE_MAX = 1.22;

/**
 * 1枚のフルイドアートのセッション。WebGL 流体シミュレーションと
 * 履歴・おまかせ台本・キャンバスを束ね、React へは
 * subscribe / getSnapshot で同期する。
 */
export class FluidSession {
  private paperRgb: RGB;

  private canvas: HTMLCanvasElement | null = null;
  private sim: FluidSimulator | null = null;
  private gesture: Gesture | null = null;

  private undoStack: HistoryEntry[] = [];
  private redoStack: HistoryEntry[] = [];
  private hasInk = false;
  /** detach 時に退避して、再 attach で復元する */
  private parkedDye: HistoryEntry | null = null;

  private rafId = 0;
  private lastTime = 0;
  private idleDeadline = 0;
  private autoQueue: Array<{ at: number; action: AutoAction }> = [];
  private pourQueue: Array<{
    at: number;
    u: number;
    v: number;
    radius: number;
    color: RGB;
  }> = [];

  private listeners = new Set<() => void>();
  private snapshot: SessionSnapshot = {
    canUndo: false,
    canRedo: false,
    isEmpty: true,
    unsupported: false,
  };

  constructor(paper: string) {
    this.paperRgb = hexToRgb(paper);
  }

  attach(canvas: HTMLCanvasElement): () => void {
    this.canvas = canvas;
    const gl = canvas.getContext('webgl2', {
      alpha: false,
      depth: false,
      stencil: false,
      antialias: false,
    });
    if (gl) {
      try {
        this.sim = new FluidSimulator(gl);
      } catch {
        this.sim = null;
      }
    }
    if (!this.sim) {
      this.updateSnapshot();
      return () => {
        this.canvas = null;
      };
    }
    if (this.parkedDye) {
      this.sim.restoreDye(this.parkedDye.dye);
      this.hasInk = this.parkedDye.hasInk;
      this.parkedDye = null;
    }
    const observer = new ResizeObserver(() => {
      this.resize();
    });
    observer.observe(canvas);
    this.resize();
    this.updateSnapshot();
    this.poke();
    return () => {
      observer.disconnect();
      if (this.rafId !== 0) {
        cancelAnimationFrame(this.rafId);
        this.rafId = 0;
      }
      if (this.sim) {
        this.parkedDye = { dye: this.sim.snapshotDye(), hasInk: this.hasInk };
      }
      this.canvas = null;
      this.sim = null;
    };
  }

  setPaper(color: string): void {
    this.paperRgb = hexToRgb(color);
    this.poke();
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = (): SessionSnapshot => this.snapshot;

  beginGesture(tool: Tool, x: number, y: number, config: GestureConfig): void {
    if (this.gesture || !this.sim) return;
    const u = x / ART_SIZE;
    const v = 1 - y / ART_SIZE;
    this.gesture = {
      tool,
      config,
      originX: u,
      originY: v,
      lastX: u,
      lastY: v,
      lastEmitX: u,
      lastEmitY: v,
      historyPushed: false,
      // 色が切り替わるのはストロークの区切りだけ。
      // ストローク内は同じ絵の具を濃淡を変えながら使う
      strokeColor: tool === 'drop' ? config.nextColor() : '',
      // Math.random は濃淡の初期値用（非セキュリティ用途）
      tone: 1 + (Math.random() * 2 - 1) * 0.08,
    };
    if (tool === 'drop') {
      this.mutateInGesture(() => {
        this.emitDrop(u, v, config, true);
      });
    }
  }

  moveGesture(x: number, y: number): void {
    const { gesture, sim } = this;
    if (!gesture || !sim) return;
    const u = x / ART_SIZE;
    const v = 1 - y / ART_SIZE;
    const dx = u - gesture.lastX;
    const dy = v - gesture.lastY;
    const { config } = gesture;
    const radiusUv = config.value / ART_SIZE;

    switch (gesture.tool) {
      case 'drop': {
        const emitDist = Math.hypot(
          u - gesture.lastEmitX,
          v - gesture.lastEmitY,
        );
        if (emitDist >= radiusUv * 0.5) {
          this.mutateInGesture(() => {
            this.emitDrop(u, v, config, false);
            // 移動方向にわずかな流れを足すと、線が生きる
            sim.splatVelocity(
              u,
              v,
              radiusUv,
              dx * DROP_TRAIL_FORCE,
              dy * DROP_TRAIL_FORCE,
            );
          });
          gesture.lastEmitX = u;
          gesture.lastEmitY = v;
        }
        break;
      }
      case 'flow': {
        if (Math.hypot(dx, dy) < 1e-5) break;
        this.mutateInGesture(() => {
          sim.splatVelocity(
            u,
            v,
            radiusUv / 2,
            dx * FLOW_FORCE,
            dy * FLOW_FORCE,
          );
        });
        break;
      }
      case 'comb': {
        const len = Math.hypot(dx, dy);
        if (len < 1e-5) break;
        this.mutateInGesture(() => {
          this.applyCombRow(u, v, dx, dy, radiusUv);
        });
        break;
      }
      case 'vortex': {
        const a0 = Math.atan2(
          gesture.lastY - gesture.originY,
          gesture.lastX - gesture.originX,
        );
        const a1 = Math.atan2(v - gesture.originY, u - gesture.originX);
        let da = a1 - a0;
        da = Math.atan2(Math.sin(da), Math.cos(da));
        da = Math.max(-MAX_VORTEX_STEP, Math.min(MAX_VORTEX_STEP, da));
        if (da === 0) break;
        this.mutateInGesture(() => {
          sim.applyForceField(
            gesture.originX,
            gesture.originY,
            radiusUv,
            da * VORTEX_STRENGTH,
            1,
          );
        });
        break;
      }
    }
    gesture.lastX = u;
    gesture.lastY = v;
  }

  endGesture(): void {
    this.gesture = null;
  }

  undo(): void {
    const entry = this.undoStack.pop();
    if (!entry || !this.sim) return;
    this.redoStack.push(this.currentEntry());
    this.restore(entry);
  }

  redo(): void {
    const entry = this.redoStack.pop();
    if (!entry || !this.sim) return;
    this.undoStack.push(this.currentEntry());
    this.restore(entry);
  }

  clear(): void {
    if (!this.hasInk || !this.sim) return;
    this.pushHistory();
    this.sim.clear();
    this.hasInk = false;
    this.autoQueue = [];
    this.pourQueue = [];
    this.updateSnapshot();
    this.poke();
  }

  /** おまかせ生成。台本を時間差で実行し、インクが咲いていく */
  applyAuto(palette: Palette, seed?: number): void {
    if (!this.sim) return;
    // Math.random は模様のシード用（非セキュリティ用途）
    const rng = mulberry32(seed ?? Math.floor(Math.random() * 2 ** 31));
    this.pushHistory();
    const now = performance.now();
    const script = generateAutoScript(palette, rng);
    this.autoQueue.push(
      ...script.map((action) => ({ at: now + action.t * 1000, action })),
    );
    this.updateSnapshot();
    this.poke();
  }

  /** 高解像度で PNG に書き出す */
  exportPng(size = 2048): Promise<Blob> {
    const { sim } = this;
    if (!sim) {
      return Promise.reject(new Error('WebGL2 が利用できません'));
    }
    const pixels = sim.renderToPixels(size, this.paperRgb);
    const target = document.createElement('canvas');
    target.width = size;
    target.height = size;
    const ctx = target.getContext('2d');
    if (!ctx) {
      return Promise.reject(new Error('Canvas context is unavailable'));
    }
    ctx.putImageData(new ImageData(pixels, size, size), 0, 0);
    return new Promise((resolve, reject) => {
      target.toBlob((blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('PNG の生成に失敗しました'));
        }
      }, 'image/png');
    });
  }

  /**
   * しずくを1滴置く。ストロークの絵の具を使い、濃淡を
   * ランダムウォークでなめらかに変えながら連ねる。
   */
  private emitDrop(
    u: number,
    v: number,
    config: GestureConfig,
    burst: boolean,
  ): void {
    const { gesture } = this;
    if (!gesture) return;
    // Math.random は大きさ・濃淡の揺らぎ用（非セキュリティ用途）
    const rng = Math.random;
    const radiusUv = (config.value / ART_SIZE) * (0.85 + rng() * 0.3);
    gesture.tone = Math.min(
      TONE_MAX,
      Math.max(TONE_MIN, gesture.tone + (rng() * 2 - 1) * TONE_STEP),
    );
    this.pourDrop(
      u,
      v,
      radiusUv,
      toneInk(gesture.strokeColor, gesture.tone, rng),
      burst,
    );
  }

  /**
   * インクを注ぐ共通処理。インクは数フレームに分けて
   * 注がれる。縁は流れて広がり、中心は痩せない。
   */
  private pourDrop(
    u: number,
    v: number,
    radiusUv: number,
    color: RGB,
    burst: boolean,
  ): void {
    const { sim } = this;
    if (!sim) return;
    sim.splatDye(u, v, radiusUv * 0.75, color);
    if (burst) {
      // まわりの絵の具を押し広げる（重ね落としで輪ができる）
      sim.applyForceField(u, v, radiusUv * 2, DROP_BURST, 0);
    }
    const now = performance.now();
    for (let i = 1; i < DROP_POUR_COUNT; i++) {
      this.pourQueue.push({
        at: now + i * DROP_POUR_INTERVAL_MS,
        u,
        v,
        radius: radiusUv * (0.75 + (0.25 * i) / (DROP_POUR_COUNT - 1)),
        color,
      });
    }
    this.hasInk = true;
  }

  /** ポインタ位置を通る、進行方向と直交する歯の列に力を加える */
  private applyCombRow(
    u: number,
    v: number,
    dx: number,
    dy: number,
    spacing: number,
  ): void {
    const { sim } = this;
    if (!sim) return;
    const len = Math.hypot(dx, dy);
    const axisX = -dy / len;
    const axisY = dx / len;
    const forceX = dx * COMB_FORCE;
    const forceY = dy * COMB_FORCE;
    // 歯の影響を重ねて、点々ではなくつながった筋にする
    const radius = spacing * 0.45;
    for (let k = -COMB_TEETH_PER_SIDE; k <= COMB_TEETH_PER_SIDE; k++) {
      const tx = u + axisX * k * spacing;
      const ty = v + axisY * k * spacing;
      if (tx < -spacing || tx > 1 + spacing) continue;
      if (ty < -spacing || ty > 1 + spacing) continue;
      sim.splatVelocity(tx, ty, radius, forceX, forceY);
    }
  }

  private runAutoAction(action: AutoAction): void {
    const { sim } = this;
    if (!sim) return;
    switch (action.kind) {
      case 'drop': {
        this.pourDrop(
          action.x / ART_SIZE,
          1 - action.y / ART_SIZE,
          action.radius / ART_SIZE,
          // Math.random は色の揺らぎ用（非セキュリティ用途）
          jitterInk(action.color, Math.random),
          true,
        );
        this.updateSnapshot();
        break;
      }
      case 'swirl': {
        sim.applyForceField(
          action.x / ART_SIZE,
          1 - action.y / ART_SIZE,
          action.radius / ART_SIZE,
          action.strength * AUTO_SWIRL,
          1,
        );
        break;
      }
      case 'sweep': {
        const v = 1 - action.y / ART_SIZE;
        const spacing = action.spacing / ART_SIZE;
        const forceY = -action.dirY * action.strength * AUTO_SWEEP;
        for (let x = spacing / 2; x <= 1; x += spacing) {
          sim.splatVelocity(x, v, spacing * 0.35, 0, forceY);
        }
        break;
      }
    }
  }

  /** ジェスチャー中の変更。最初の変更時のみ履歴を積む */
  private mutateInGesture(mutate: () => void): void {
    const { gesture } = this;
    if (gesture && !gesture.historyPushed) {
      this.pushHistory();
      gesture.historyPushed = true;
    }
    mutate();
    this.updateSnapshot();
    this.poke();
  }

  private currentEntry(): HistoryEntry {
    const { sim } = this;
    if (!sim) throw new Error('Simulator is not attached');
    return { dye: sim.snapshotDye(), hasInk: this.hasInk };
  }

  private pushHistory(): void {
    if (!this.sim) return;
    this.undoStack.push(this.currentEntry());
    this.redoStack = [];
    while (this.undoStack.length > MAX_HISTORY) {
      this.undoStack.shift();
    }
  }

  private restore(entry: HistoryEntry): void {
    const { sim } = this;
    if (!sim) return;
    sim.restoreDye(entry.dye);
    this.hasInk = entry.hasInk;
    this.autoQueue = [];
    this.pourQueue = [];
    this.updateSnapshot();
    this.poke();
  }

  private updateSnapshot(): void {
    const next: SessionSnapshot = {
      canUndo: this.undoStack.length > 0,
      canRedo: this.redoStack.length > 0,
      isEmpty: !this.hasInk,
      unsupported: this.canvas !== null && this.sim === null,
    };
    const prev = this.snapshot;
    if (
      next.canUndo === prev.canUndo &&
      next.canRedo === prev.canRedo &&
      next.isEmpty === prev.isEmpty &&
      next.unsupported === prev.unsupported
    ) {
      return;
    }
    this.snapshot = next;
    for (const listener of this.listeners) {
      listener();
    }
  }

  private resize(): void {
    const { canvas } = this;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio;
    const px = Math.max(1, Math.round(rect.width * dpr));
    if (canvas.width !== px || canvas.height !== px) {
      canvas.width = px;
      canvas.height = px;
    }
    this.poke();
  }

  /** 活動があったことを伝え、必要ならループを起こす */
  private poke(): void {
    this.idleDeadline = performance.now() + IDLE_MS;
    if (this.rafId === 0 && this.sim && this.canvas) {
      this.lastTime = performance.now();
      this.rafId = requestAnimationFrame(this.frame);
    }
  }

  private frame = (now: number): void => {
    this.rafId = 0;
    const { sim } = this;
    const { canvas } = this;
    if (!sim || !canvas) return;

    const dt = Math.min(Math.max((now - this.lastTime) / 1000, 0), 1 / 30);
    this.lastTime = now;

    if (this.autoQueue.length > 0) {
      const due = this.autoQueue.filter((item) => item.at <= now);
      this.autoQueue = this.autoQueue.filter((item) => item.at > now);
      for (const item of due) {
        this.runAutoAction(item.action);
      }
      this.idleDeadline = now + IDLE_MS;
    }

    if (this.pourQueue.length > 0) {
      const due = this.pourQueue.filter((item) => item.at <= now);
      this.pourQueue = this.pourQueue.filter((item) => item.at > now);
      for (const pour of due) {
        sim.splatDye(pour.u, pour.v, pour.radius, pour.color);
      }
      this.idleDeadline = now + IDLE_MS;
    }

    if (dt > 0) {
      sim.step(dt);
    }
    sim.render(canvas.width, canvas.height, this.paperRgb);

    if (
      now < this.idleDeadline ||
      this.autoQueue.length > 0 ||
      this.pourQueue.length > 0
    ) {
      this.rafId = requestAnimationFrame(this.frame);
    }
  };
}
