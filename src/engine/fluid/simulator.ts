import {
  createBlit,
  createDoubleFBO,
  createFBO,
  compileShader,
  Program,
  type DoubleFBO,
  type FBO,
} from './gl';
import {
  ADVECTION_FRAGMENT,
  BASE_VERTEX,
  COPY_FRAGMENT,
  CURL_FRAGMENT,
  DISPLAY_FRAGMENT,
  DIVERGENCE_FRAGMENT,
  FORCE_FIELD_FRAGMENT,
  GRADIENT_SUBTRACT_FRAGMENT,
  PRESSURE_FRAGMENT,
  SHARPEN_FRAGMENT,
  SPLAT_DYE_FRAGMENT,
  SPLAT_VELOCITY_FRAGMENT,
  VORTICITY_FRAGMENT,
} from './shaders';

const SIM_RESOLUTION = 160;
const DYE_RESOLUTION = 1024;
const PRESSURE_ITERATIONS = 20;
const CURL_STRENGTH = 5;
const VELOCITY_DISSIPATION = 2;
const PRESSURE_DAMPING = 0.8;
const GRAIN = 0.045;
/** 不混和（先鋭化）の強さ（毎秒）と1フレームあたりの上限 */
const SHARPEN_RATE = 10;
const SHARPEN_MAX = 0.35;

export type RGB = {
  r: number;
  g: number;
  b: number;
};

/**
 * Stable Fluids ベースの流体シミュレータ。
 * 染料（dye）は premultiplied alpha で保持し、速度場で移流する。
 */
export class FluidSimulator {
  private readonly gl: WebGL2RenderingContext;
  private readonly blit: ReturnType<typeof createBlit>;

  private velocity: DoubleFBO;
  private dye: DoubleFBO;
  private pressure: DoubleFBO;
  private divergence: FBO;
  private curl: FBO;
  private snapshotFbo: FBO;

  private readonly copyProgram: Program;
  private readonly advectionProgram: Program;
  private readonly divergenceProgram: Program;
  private readonly curlProgram: Program;
  private readonly vorticityProgram: Program;
  private readonly pressureProgram: Program;
  private readonly gradientProgram: Program;
  private readonly splatVelocityProgram: Program;
  private readonly splatDyeProgram: Program;
  private readonly forceFieldProgram: Program;
  private readonly sharpenProgram: Program;
  private readonly displayProgram: Program;

  private restoreTexture: WebGLTexture | null = null;

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;
    if (!gl.getExtension('EXT_color_buffer_float')) {
      throw new Error('EXT_color_buffer_float is not supported');
    }
    gl.disable(gl.BLEND);

    const vertex = compileShader(gl, gl.VERTEX_SHADER, BASE_VERTEX);
    this.copyProgram = new Program(gl, vertex, COPY_FRAGMENT);
    this.advectionProgram = new Program(gl, vertex, ADVECTION_FRAGMENT);
    this.divergenceProgram = new Program(gl, vertex, DIVERGENCE_FRAGMENT);
    this.curlProgram = new Program(gl, vertex, CURL_FRAGMENT);
    this.vorticityProgram = new Program(gl, vertex, VORTICITY_FRAGMENT);
    this.pressureProgram = new Program(gl, vertex, PRESSURE_FRAGMENT);
    this.gradientProgram = new Program(gl, vertex, GRADIENT_SUBTRACT_FRAGMENT);
    this.splatVelocityProgram = new Program(
      gl,
      vertex,
      SPLAT_VELOCITY_FRAGMENT,
    );
    this.splatDyeProgram = new Program(gl, vertex, SPLAT_DYE_FRAGMENT);
    this.forceFieldProgram = new Program(gl, vertex, FORCE_FIELD_FRAGMENT);
    this.sharpenProgram = new Program(gl, vertex, SHARPEN_FRAGMENT);
    this.displayProgram = new Program(gl, vertex, DISPLAY_FRAGMENT);

    this.blit = createBlit(gl);

    this.velocity = createDoubleFBO(
      gl,
      SIM_RESOLUTION,
      SIM_RESOLUTION,
      gl.RG16F,
      gl.RG,
      gl.HALF_FLOAT,
      gl.LINEAR,
    );
    this.pressure = createDoubleFBO(
      gl,
      SIM_RESOLUTION,
      SIM_RESOLUTION,
      gl.R16F,
      gl.RED,
      gl.HALF_FLOAT,
      gl.NEAREST,
    );
    this.divergence = createFBO(
      gl,
      SIM_RESOLUTION,
      SIM_RESOLUTION,
      gl.R16F,
      gl.RED,
      gl.HALF_FLOAT,
      gl.NEAREST,
    );
    this.curl = createFBO(
      gl,
      SIM_RESOLUTION,
      SIM_RESOLUTION,
      gl.R16F,
      gl.RED,
      gl.HALF_FLOAT,
      gl.NEAREST,
    );
    this.dye = createDoubleFBO(
      gl,
      DYE_RESOLUTION,
      DYE_RESOLUTION,
      gl.RGBA16F,
      gl.RGBA,
      gl.HALF_FLOAT,
      gl.LINEAR,
    );
    this.snapshotFbo = createFBO(
      gl,
      DYE_RESOLUTION,
      DYE_RESOLUTION,
      gl.RGBA8,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      gl.LINEAR,
    );
  }

  /** 1ステップ進める。dt は秒 */
  step(dt: number): void {
    const { gl } = this;
    const program = this.curlProgram;
    program.bind();
    gl.uniform2f(
      program.uniform('texelSize'),
      this.velocity.texelSizeX,
      this.velocity.texelSizeY,
    );
    gl.uniform1i(program.uniform('uVelocity'), this.velocity.read.attach(0));
    this.blit(this.curl);

    this.vorticityProgram.bind();
    gl.uniform2f(
      this.vorticityProgram.uniform('texelSize'),
      this.velocity.texelSizeX,
      this.velocity.texelSizeY,
    );
    gl.uniform1i(
      this.vorticityProgram.uniform('uVelocity'),
      this.velocity.read.attach(0),
    );
    gl.uniform1i(this.vorticityProgram.uniform('uCurl'), this.curl.attach(1));
    gl.uniform1f(this.vorticityProgram.uniform('uCurlStrength'), CURL_STRENGTH);
    gl.uniform1f(this.vorticityProgram.uniform('uDt'), dt);
    this.blit(this.velocity.write);
    this.velocity.swap();

    this.divergenceProgram.bind();
    gl.uniform2f(
      this.divergenceProgram.uniform('texelSize'),
      this.velocity.texelSizeX,
      this.velocity.texelSizeY,
    );
    gl.uniform1i(
      this.divergenceProgram.uniform('uVelocity'),
      this.velocity.read.attach(0),
    );
    this.blit(this.divergence);

    this.copyProgram.bind();
    gl.uniform2f(
      this.copyProgram.uniform('texelSize'),
      this.velocity.texelSizeX,
      this.velocity.texelSizeY,
    );
    gl.uniform1i(
      this.copyProgram.uniform('uTexture'),
      this.pressure.read.attach(0),
    );
    gl.uniform1f(this.copyProgram.uniform('uValue'), PRESSURE_DAMPING);
    this.blit(this.pressure.write);
    this.pressure.swap();

    this.pressureProgram.bind();
    gl.uniform2f(
      this.pressureProgram.uniform('texelSize'),
      this.velocity.texelSizeX,
      this.velocity.texelSizeY,
    );
    gl.uniform1i(
      this.pressureProgram.uniform('uDivergence'),
      this.divergence.attach(0),
    );
    for (let i = 0; i < PRESSURE_ITERATIONS; i++) {
      gl.uniform1i(
        this.pressureProgram.uniform('uPressure'),
        this.pressure.read.attach(1),
      );
      this.blit(this.pressure.write);
      this.pressure.swap();
    }

    this.gradientProgram.bind();
    gl.uniform2f(
      this.gradientProgram.uniform('texelSize'),
      this.velocity.texelSizeX,
      this.velocity.texelSizeY,
    );
    gl.uniform1i(
      this.gradientProgram.uniform('uPressure'),
      this.pressure.read.attach(0),
    );
    gl.uniform1i(
      this.gradientProgram.uniform('uVelocity'),
      this.velocity.read.attach(1),
    );
    this.blit(this.velocity.write);
    this.velocity.swap();

    this.advectionProgram.bind();
    gl.uniform2f(
      this.advectionProgram.uniform('texelSize'),
      this.velocity.texelSizeX,
      this.velocity.texelSizeY,
    );
    gl.uniform1i(
      this.advectionProgram.uniform('uVelocity'),
      this.velocity.read.attach(0),
    );
    gl.uniform1i(
      this.advectionProgram.uniform('uSource'),
      this.velocity.read.attach(0),
    );
    gl.uniform1f(this.advectionProgram.uniform('uDt'), dt);
    gl.uniform1f(
      this.advectionProgram.uniform('uDissipation'),
      VELOCITY_DISSIPATION,
    );
    this.blit(this.velocity.write);
    this.velocity.swap();

    gl.uniform1i(
      this.advectionProgram.uniform('uVelocity'),
      this.velocity.read.attach(0),
    );
    gl.uniform1i(
      this.advectionProgram.uniform('uSource'),
      this.dye.read.attach(1),
    );
    gl.uniform1f(this.advectionProgram.uniform('uDissipation'), 0);
    this.blit(this.dye.write);
    this.dye.swap();

    // 絵の具の不混和: 移流で生じたにじみを流れのある場所だけ打ち消す
    this.sharpenProgram.bind();
    gl.uniform2f(
      this.sharpenProgram.uniform('texelSize'),
      this.dye.texelSizeX,
      this.dye.texelSizeY,
    );
    gl.uniform1i(this.sharpenProgram.uniform('uDye'), this.dye.read.attach(0));
    gl.uniform1i(
      this.sharpenProgram.uniform('uVelocity'),
      this.velocity.read.attach(1),
    );
    gl.uniform1f(
      this.sharpenProgram.uniform('uStrength'),
      Math.min(SHARPEN_RATE * dt, SHARPEN_MAX),
    );
    this.blit(this.dye.write);
    this.dye.swap();
  }

  /** 染料を置く。x, y は uv（0..1）、radius も uv 単位 */
  splatDye(
    x: number,
    y: number,
    radius: number,
    color: RGB,
    alpha = 1,
    strength = 1,
  ): void {
    const { gl } = this;
    this.splatDyeProgram.bind();
    gl.uniform1i(
      this.splatDyeProgram.uniform('uTarget'),
      this.dye.read.attach(0),
    );
    gl.uniform2f(this.splatDyeProgram.uniform('uPoint'), x, y);
    gl.uniform4f(
      this.splatDyeProgram.uniform('uColor'),
      color.r * alpha,
      color.g * alpha,
      color.b * alpha,
      alpha,
    );
    gl.uniform1f(this.splatDyeProgram.uniform('uRadius'), radius);
    gl.uniform1f(this.splatDyeProgram.uniform('uStrength'), strength);
    this.blit(this.dye.write);
    this.dye.swap();
  }

  /** 速度を加える。force は uv/秒スケール */
  splatVelocity(
    x: number,
    y: number,
    radius: number,
    forceX: number,
    forceY: number,
  ): void {
    const { gl } = this;
    this.splatVelocityProgram.bind();
    gl.uniform1i(
      this.splatVelocityProgram.uniform('uTarget'),
      this.velocity.read.attach(0),
    );
    gl.uniform2f(this.splatVelocityProgram.uniform('uPoint'), x, y);
    gl.uniform2f(this.splatVelocityProgram.uniform('uForce'), forceX, forceY);
    gl.uniform1f(
      this.splatVelocityProgram.uniform('uRadius'),
      radius * radius * 1.4,
    );
    this.blit(this.velocity.write);
    this.velocity.swap();
  }

  /** 放射状（tangent=0）または渦（tangent=1）の力場を加える */
  applyForceField(
    x: number,
    y: number,
    radius: number,
    strength: number,
    tangent: 0 | 1,
  ): void {
    const { gl } = this;
    this.forceFieldProgram.bind();
    gl.uniform1i(
      this.forceFieldProgram.uniform('uTarget'),
      this.velocity.read.attach(0),
    );
    gl.uniform2f(this.forceFieldProgram.uniform('uPoint'), x, y);
    gl.uniform1f(this.forceFieldProgram.uniform('uStrength'), strength);
    gl.uniform1f(
      this.forceFieldProgram.uniform('uRadius'),
      radius * radius * 1.4,
    );
    gl.uniform1f(this.forceFieldProgram.uniform('uTangent'), tangent);
    this.blit(this.velocity.write);
    this.velocity.swap();
  }

  /** 画面（既定フレームバッファ）に描画する */
  render(width: number, height: number, paper: RGB): void {
    this.drawDisplay(null, width, height, paper);
  }

  /** 指定サイズで描画して RGBA ピクセル（上が先頭）を返す */
  renderToPixels(size: number, paper: RGB): Uint8ClampedArray<ArrayBuffer> {
    const { gl } = this;
    const target = createFBO(
      gl,
      size,
      size,
      gl.RGBA8,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      gl.LINEAR,
    );
    this.drawDisplay(target, size, size, paper);
    const pixels = new Uint8Array(size * size * 4);
    gl.bindFramebuffer(gl.FRAMEBUFFER, target.framebuffer);
    gl.readPixels(0, 0, size, size, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    gl.deleteFramebuffer(target.framebuffer);
    gl.deleteTexture(target.texture);
    return flipRows(pixels, size);
  }

  /** 染料テクスチャを RGBA8 で読み出す（undo 用） */
  snapshotDye(): Uint8Array {
    const { gl } = this;
    this.copyProgram.bind();
    gl.uniform2f(this.copyProgram.uniform('texelSize'), 1, 1);
    gl.uniform1i(this.copyProgram.uniform('uTexture'), this.dye.read.attach(0));
    gl.uniform1f(this.copyProgram.uniform('uValue'), 1);
    this.blit(this.snapshotFbo);
    const pixels = new Uint8Array(DYE_RESOLUTION * DYE_RESOLUTION * 4);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.snapshotFbo.framebuffer);
    gl.readPixels(
      0,
      0,
      DYE_RESOLUTION,
      DYE_RESOLUTION,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      pixels,
    );
    return pixels;
  }

  /** snapshotDye の内容を復元し、速度場を静止させる */
  restoreDye(pixels: Uint8Array): void {
    const { gl } = this;
    const texture = (this.restoreTexture ??= gl.createTexture());
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA8,
      DYE_RESOLUTION,
      DYE_RESOLUTION,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      pixels,
    );

    this.copyProgram.bind();
    gl.uniform2f(this.copyProgram.uniform('texelSize'), 1, 1);
    gl.uniform1i(this.copyProgram.uniform('uTexture'), 0);
    gl.uniform1f(this.copyProgram.uniform('uValue'), 1);
    this.blit(this.dye.write);
    this.dye.swap();
    this.still();
  }

  /** 染料と速度をすべて消す */
  clear(): void {
    this.clearFbo(this.dye.read);
    this.clearFbo(this.dye.write);
    this.still();
  }

  /** 速度・圧力をゼロにして流れを静止させる */
  still(): void {
    this.clearFbo(this.velocity.read);
    this.clearFbo(this.velocity.write);
    this.clearFbo(this.pressure.read);
    this.clearFbo(this.pressure.write);
  }

  private clearFbo(fbo: FBO): void {
    const { gl } = this;
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo.framebuffer);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
  }

  private drawDisplay(
    target: FBO | null,
    width: number,
    height: number,
    paper: RGB,
  ): void {
    const { gl } = this;
    this.displayProgram.bind();
    gl.uniform2f(
      this.displayProgram.uniform('texelSize'),
      1 / width,
      1 / height,
    );
    gl.uniform1i(this.displayProgram.uniform('uDye'), this.dye.read.attach(0));
    gl.uniform3f(
      this.displayProgram.uniform('uPaper'),
      paper.r,
      paper.g,
      paper.b,
    );
    gl.uniform1f(this.displayProgram.uniform('uGrain'), GRAIN);
    this.blit(target, width, height);
  }
}

/** readPixels は下が先頭なので、上が先頭になるよう行を反転する */
function flipRows(
  pixels: Uint8Array,
  size: number,
): Uint8ClampedArray<ArrayBuffer> {
  const rowBytes = size * 4;
  const flipped = new Uint8ClampedArray(pixels.length);
  for (let y = 0; y < size; y++) {
    const src = (size - 1 - y) * rowBytes;
    flipped.set(pixels.subarray(src, src + rowBytes), y * rowBytes);
  }
  return flipped;
}
