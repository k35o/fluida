import type { PointerEvent } from 'react';
import { useCallback } from 'react';

import {
  ART_SIZE,
  type FluidSession,
  type GestureConfig,
  type Tool,
} from '../engine/session';

import styles from './canvas-stage.module.css';

type CanvasStageProps = {
  session: FluidSession;
  tool: Tool;
  paper: string;
  showWelcome: boolean;
  unsupported: boolean;
  buildConfig: () => GestureConfig;
};

function toArtPoint(
  canvas: HTMLCanvasElement,
  clientX: number,
  clientY: number,
): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((clientX - rect.left) / rect.width) * ART_SIZE,
    y: ((clientY - rect.top) / rect.height) * ART_SIZE,
  };
}

export function CanvasStage({
  session,
  tool,
  paper,
  showWelcome,
  unsupported,
  buildConfig,
}: CanvasStageProps) {
  const attachCanvas = useCallback(
    (node: HTMLCanvasElement | null) => {
      if (!node) return undefined;
      return session.attach(node);
    },
    [session],
  );

  const handlePointerDown = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!event.isPrimary || event.button !== 0) return;
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // ポインタが既に非アクティブな場合（合成イベント等）は捕捉なしで続行する
    }
    const point = toArtPoint(event.currentTarget, event.clientX, event.clientY);
    session.beginGesture(tool, point.x, point.y, buildConfig());
  };

  const handlePointerMove = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!event.isPrimary) return;
    const canvas = event.currentTarget;
    // 滑らかな軌跡のため、フレーム間に間引かれたポインタ位置も拾う
    const moves =
      typeof event.nativeEvent.getCoalescedEvents === 'function'
        ? event.nativeEvent.getCoalescedEvents()
        : [];
    for (const move of moves.length > 0 ? moves : [event.nativeEvent]) {
      const point = toArtPoint(canvas, move.clientX, move.clientY);
      session.moveGesture(point.x, point.y);
    }
  };

  const endGesture = () => {
    session.endGesture();
  };

  return (
    <div className={styles.root}>
      <canvas
        ref={attachCanvas}
        aria-label="えのぐあそびのキャンバス。ポインターでえのぐを落としたり流したりして模様を描く"
        className={styles.canvas}
        style={{ backgroundColor: paper }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endGesture}
        onPointerCancel={endGesture}
        onLostPointerCapture={endGesture}
      />
      <div
        aria-hidden
        className={styles.welcome}
        data-visible={showWelcome && !unsupported}
      >
        <p className={styles.welcomeTitle}>とぷん、とひと滴おとしてみよう</p>
        <p className={styles.welcomeNote}>
          「おまかせで描く」から始めるのもおすすめ
        </p>
      </div>
      {unsupported ? (
        <div className={styles.unsupported}>
          <p className={styles.unsupportedText}>
            お使いのブラウザでは WebGL2 が利用できないため、
            <br />
            えのぐあそびができません。最新のブラウザでお試しください。
          </p>
        </div>
      ) : null}
    </div>
  );
}
