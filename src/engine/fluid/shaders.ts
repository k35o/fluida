/**
 * Stable Fluids（Jos Stam, 1999）に基づく流体シミュレーションの GLSL。
 * 構成は WebGL 流体シミュレーションの定番実装
 * （semi-Lagrangian 移流 + Jacobi 圧力解法 + 渦度強制）に従う。
 */

export const BASE_VERTEX = `
  precision highp float;

  attribute vec2 aPosition;
  varying vec2 vUv;
  varying vec2 vL;
  varying vec2 vR;
  varying vec2 vT;
  varying vec2 vB;
  uniform vec2 texelSize;

  void main () {
    vUv = aPosition * 0.5 + 0.5;
    vL = vUv - vec2(texelSize.x, 0.0);
    vR = vUv + vec2(texelSize.x, 0.0);
    vT = vUv + vec2(0.0, texelSize.y);
    vB = vUv - vec2(0.0, texelSize.y);
    gl_Position = vec4(aPosition, 0.0, 1.0);
  }
`;

export const COPY_FRAGMENT = `
  precision mediump float;
  precision mediump sampler2D;

  varying highp vec2 vUv;
  uniform sampler2D uTexture;
  uniform float uValue;

  void main () {
    gl_FragColor = uValue * texture2D(uTexture, vUv);
  }
`;

export const ADVECTION_FRAGMENT = `
  precision highp float;
  precision highp sampler2D;

  varying vec2 vUv;
  uniform sampler2D uVelocity;
  uniform sampler2D uSource;
  uniform vec2 texelSize;
  uniform float uDt;
  uniform float uDissipation;

  void main () {
    vec2 coord = vUv - uDt * texture2D(uVelocity, vUv).xy * texelSize;
    vec4 result = texture2D(uSource, coord);
    float decay = 1.0 + uDissipation * uDt;
    gl_FragColor = result / decay;
  }
`;

export const DIVERGENCE_FRAGMENT = `
  precision mediump float;
  precision mediump sampler2D;

  varying highp vec2 vUv;
  varying highp vec2 vL;
  varying highp vec2 vR;
  varying highp vec2 vT;
  varying highp vec2 vB;
  uniform sampler2D uVelocity;

  void main () {
    float L = texture2D(uVelocity, vL).x;
    float R = texture2D(uVelocity, vR).x;
    float T = texture2D(uVelocity, vT).y;
    float B = texture2D(uVelocity, vB).y;
    vec2 C = texture2D(uVelocity, vUv).xy;
    if (vL.x < 0.0) { L = -C.x; }
    if (vR.x > 1.0) { R = -C.x; }
    if (vT.y > 1.0) { T = -C.y; }
    if (vB.y < 0.0) { B = -C.y; }
    float div = 0.5 * (R - L + T - B);
    gl_FragColor = vec4(div, 0.0, 0.0, 1.0);
  }
`;

export const CURL_FRAGMENT = `
  precision mediump float;
  precision mediump sampler2D;

  varying highp vec2 vUv;
  varying highp vec2 vL;
  varying highp vec2 vR;
  varying highp vec2 vT;
  varying highp vec2 vB;
  uniform sampler2D uVelocity;

  void main () {
    float L = texture2D(uVelocity, vL).y;
    float R = texture2D(uVelocity, vR).y;
    float T = texture2D(uVelocity, vT).x;
    float B = texture2D(uVelocity, vB).x;
    float vorticity = R - L - T + B;
    gl_FragColor = vec4(0.5 * vorticity, 0.0, 0.0, 1.0);
  }
`;

export const VORTICITY_FRAGMENT = `
  precision highp float;
  precision highp sampler2D;

  varying vec2 vUv;
  varying vec2 vL;
  varying vec2 vR;
  varying vec2 vT;
  varying vec2 vB;
  uniform sampler2D uVelocity;
  uniform sampler2D uCurl;
  uniform float uCurlStrength;
  uniform float uDt;

  void main () {
    float L = texture2D(uCurl, vL).x;
    float R = texture2D(uCurl, vR).x;
    float T = texture2D(uCurl, vT).x;
    float B = texture2D(uCurl, vB).x;
    float C = texture2D(uCurl, vUv).x;

    vec2 force = 0.5 * vec2(abs(T) - abs(B), abs(R) - abs(L));
    force /= length(force) + 0.0001;
    force *= uCurlStrength * C;
    force.y *= -1.0;

    vec2 velocity = texture2D(uVelocity, vUv).xy;
    velocity += force * uDt;
    velocity = clamp(velocity, -1000.0, 1000.0);
    gl_FragColor = vec4(velocity, 0.0, 1.0);
  }
`;

export const PRESSURE_FRAGMENT = `
  precision mediump float;
  precision mediump sampler2D;

  varying highp vec2 vUv;
  varying highp vec2 vL;
  varying highp vec2 vR;
  varying highp vec2 vT;
  varying highp vec2 vB;
  uniform sampler2D uPressure;
  uniform sampler2D uDivergence;

  void main () {
    float L = texture2D(uPressure, vL).x;
    float R = texture2D(uPressure, vR).x;
    float T = texture2D(uPressure, vT).x;
    float B = texture2D(uPressure, vB).x;
    float divergence = texture2D(uDivergence, vUv).x;
    float pressure = (L + R + B + T - divergence) * 0.25;
    gl_FragColor = vec4(pressure, 0.0, 0.0, 1.0);
  }
`;

export const GRADIENT_SUBTRACT_FRAGMENT = `
  precision mediump float;
  precision mediump sampler2D;

  varying highp vec2 vUv;
  varying highp vec2 vL;
  varying highp vec2 vR;
  varying highp vec2 vT;
  varying highp vec2 vB;
  uniform sampler2D uPressure;
  uniform sampler2D uVelocity;

  void main () {
    float L = texture2D(uPressure, vL).x;
    float R = texture2D(uPressure, vR).x;
    float T = texture2D(uPressure, vT).x;
    float B = texture2D(uPressure, vB).x;
    vec2 velocity = texture2D(uVelocity, vUv).xy;
    velocity.xy -= vec2(R - L, T - B);
    gl_FragColor = vec4(velocity, 0.0, 1.0);
  }
`;

/** 速度場への加算スプラット */
export const SPLAT_VELOCITY_FRAGMENT = `
  precision highp float;
  precision highp sampler2D;

  varying vec2 vUv;
  uniform sampler2D uTarget;
  uniform vec2 uPoint;
  uniform vec2 uForce;
  uniform float uRadius;

  void main () {
    vec2 p = vUv - uPoint;
    float w = exp(-dot(p, p) / uRadius);
    vec2 base = texture2D(uTarget, vUv).xy;
    gl_FragColor = vec4(base + uForce * w, 0.0, 1.0);
  }
`;

/**
 * 染料への混合スプラット。premultiplied alpha
 * （rgb = インク色 × 濃度、a = 濃度）で持つ。
 */
export const SPLAT_DYE_FRAGMENT = `
  precision highp float;
  precision highp sampler2D;

  varying vec2 vUv;
  uniform sampler2D uTarget;
  uniform vec2 uPoint;
  uniform vec4 uColor;
  uniform float uRadius;
  uniform float uStrength;

  void main () {
    // インクは輪郭の立った円盤として落ち、流れで自然にゆがむ
    float d = length(vUv - uPoint);
    float w = (1.0 - smoothstep(uRadius * 0.8, uRadius, d)) * uStrength;
    vec4 base = texture2D(uTarget, vUv);
    gl_FragColor = mix(base, uColor, clamp(w, 0.0, 1.0));
  }
`;

/**
 * 絵の具の不混和を再現する先鋭化。移流（semi-Lagrangian）の
 * 数値拡散で生じるにじみを、流れのある場所だけ打ち消す。
 * 静止した作品には作用しない。
 */
export const SHARPEN_FRAGMENT = `
  precision highp float;
  precision highp sampler2D;

  varying vec2 vUv;
  varying vec2 vL;
  varying vec2 vR;
  varying vec2 vT;
  varying vec2 vB;
  uniform sampler2D uDye;
  uniform sampler2D uVelocity;
  uniform float uStrength;

  void main () {
    vec4 c = texture2D(uDye, vUv);
    vec4 blur = (
      texture2D(uDye, vL) +
      texture2D(uDye, vR) +
      texture2D(uDye, vT) +
      texture2D(uDye, vB)
    ) * 0.25;
    float flow = clamp(length(texture2D(uVelocity, vUv).xy) * 0.05, 0.0, 1.0);
    vec4 sharp = c + (c - blur) * (uStrength * flow);
    float a = clamp(sharp.a, 0.0, 1.0);
    vec3 rgb = clamp(sharp.rgb, vec3(0.0), vec3(a));
    gl_FragColor = vec4(rgb, a);
  }
`;

/** 放射状（tangent=0）または接線方向（tangent=1）の力場 */
export const FORCE_FIELD_FRAGMENT = `
  precision highp float;
  precision highp sampler2D;

  varying vec2 vUv;
  uniform sampler2D uTarget;
  uniform vec2 uPoint;
  uniform float uStrength;
  uniform float uRadius;
  uniform float uTangent;

  void main () {
    vec2 d = vUv - uPoint;
    float w = exp(-dot(d, d) / uRadius);
    vec2 dir = normalize(d + vec2(0.00001));
    vec2 tangentDir = vec2(-dir.y, dir.x);
    vec2 force = mix(dir, tangentDir, uTangent) * uStrength * w;
    vec2 base = texture2D(uTarget, vUv).xy;
    gl_FragColor = vec4(base + force, 0.0, 1.0);
  }
`;

/** キャンバスの上に絵の具を重ねて表示する。ごく薄い織り目テクスチャ付き */
export const DISPLAY_FRAGMENT = `
  precision highp float;
  precision highp sampler2D;

  varying vec2 vUv;
  uniform sampler2D uDye;
  uniform vec3 uPaper;
  uniform float uGrain;

  float hash (vec2 p) {
    return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
  }

  void main () {
    vec4 dye = texture2D(uDye, vUv);
    float a = clamp(dye.a, 0.0, 1.0);
    vec3 ink = dye.rgb / max(a, 0.0001);
    // うすい霧は消し、中間の濃度は絵の具らしく持ち上げる
    float coverage = smoothstep(0.02, 0.6, a);
    vec3 color = mix(uPaper, ink, coverage);
    // キャンバス地の織り目 + わずかなむら
    float weave = sin(vUv.x * 1300.0) * sin(vUv.y * 1300.0);
    float n = hash(floor(vUv * 1024.0));
    color *= 1.0 - 0.018 * weave - uGrain * 0.5 * (n - 0.5);
    gl_FragColor = vec4(color, 1.0);
  }
`;
