/** WebGL2 の小さなヘルパー群（プログラム・FBO・全画面描画） */

export type FBO = {
  texture: WebGLTexture;
  framebuffer: WebGLFramebuffer;
  width: number;
  height: number;
  texelSizeX: number;
  texelSizeY: number;
  attach: (unit: number) => number;
};

export type DoubleFBO = {
  width: number;
  height: number;
  texelSizeX: number;
  texelSizeY: number;
  read: FBO;
  write: FBO;
  swap: () => void;
};

export function compileShader(
  gl: WebGL2RenderingContext,
  type: number,
  source: string,
): WebGLShader {
  const shader = gl.createShader(type);
  if (shader === null) throw new Error('Failed to create shader');
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  const compiled = gl.getShaderParameter(shader, gl.COMPILE_STATUS) as boolean;
  if (!compiled) {
    const log = gl.getShaderInfoLog(shader) ?? 'unknown error';
    throw new Error(`Shader compile error: ${log}`);
  }
  return shader;
}

export class Program {
  readonly handle: WebGLProgram;
  private readonly uniforms = new Map<string, WebGLUniformLocation>();
  private readonly gl: WebGL2RenderingContext;

  constructor(
    gl: WebGL2RenderingContext,
    vertexShader: WebGLShader,
    fragmentSource: string,
  ) {
    this.gl = gl;
    const fragmentShader = compileShader(
      gl,
      gl.FRAGMENT_SHADER,
      fragmentSource,
    );
    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    const linked = gl.getProgramParameter(program, gl.LINK_STATUS) as boolean;
    if (!linked) {
      const log = gl.getProgramInfoLog(program) ?? 'unknown error';
      throw new Error(`Program link error: ${log}`);
    }
    this.handle = program;
    const count = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS) as number;
    for (let i = 0; i < count; i++) {
      const info = gl.getActiveUniform(program, i);
      if (!info) continue;
      const location = gl.getUniformLocation(program, info.name);
      if (location) this.uniforms.set(info.name, location);
    }
  }

  bind(): void {
    this.gl.useProgram(this.handle);
  }

  uniform(name: string): WebGLUniformLocation | null {
    return this.uniforms.get(name) ?? null;
  }
}

export function createFBO(
  gl: WebGL2RenderingContext,
  width: number,
  height: number,
  internalFormat: number,
  format: number,
  type: number,
  filter: number,
): FBO {
  const texture = gl.createTexture();
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    internalFormat,
    width,
    height,
    0,
    format,
    type,
    null,
  );

  const framebuffer = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
  gl.framebufferTexture2D(
    gl.FRAMEBUFFER,
    gl.COLOR_ATTACHMENT0,
    gl.TEXTURE_2D,
    texture,
    0,
  );
  if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
    throw new Error('Framebuffer is incomplete');
  }
  gl.viewport(0, 0, width, height);
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);

  return {
    texture,
    framebuffer,
    width,
    height,
    texelSizeX: 1 / width,
    texelSizeY: 1 / height,
    attach(unit: number) {
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      return unit;
    },
  };
}

export function createDoubleFBO(
  gl: WebGL2RenderingContext,
  width: number,
  height: number,
  internalFormat: number,
  format: number,
  type: number,
  filter: number,
): DoubleFBO {
  let fbo1 = createFBO(gl, width, height, internalFormat, format, type, filter);
  let fbo2 = createFBO(gl, width, height, internalFormat, format, type, filter);
  return {
    width,
    height,
    texelSizeX: 1 / width,
    texelSizeY: 1 / height,
    get read() {
      return fbo1;
    },
    get write() {
      return fbo2;
    },
    swap() {
      const temp = fbo1;
      fbo1 = fbo2;
      fbo2 = temp;
    },
  };
}

/** 全画面クアッドのセットアップ。返す関数で対象 FBO に描画する */
export function createBlit(
  gl: WebGL2RenderingContext,
): (target: FBO | null, width?: number, height?: number) => void {
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, -1, 1, 1, 1, 1, -1]),
    gl.STATIC_DRAW,
  );
  const elementBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, elementBuffer);
  gl.bufferData(
    gl.ELEMENT_ARRAY_BUFFER,
    new Uint16Array([0, 1, 2, 0, 2, 3]),
    gl.STATIC_DRAW,
  );
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(0);

  return (target, width, height) => {
    if (target) {
      gl.viewport(0, 0, target.width, target.height);
      gl.bindFramebuffer(gl.FRAMEBUFFER, target.framebuffer);
    } else {
      gl.viewport(
        0,
        0,
        width ?? gl.drawingBufferWidth,
        height ?? gl.drawingBufferHeight,
      );
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }
    gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
  };
}
