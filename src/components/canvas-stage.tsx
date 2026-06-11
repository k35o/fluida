import { cn } from '@k8o/arte-odyssey';
import type { PointerEvent } from 'react';
import { useCallback } from 'react';

import {
  ART_SIZE,
  type FluidSession,
  type GestureConfig,
  type Tool,
} from '../engine/session';

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
    <div className="relative">
      <canvas
        ref={attachCanvas}
        aria-label="えのぐあそびのキャンバス。ポインターでえのぐを落としたり流したりして模様を描く"
        className="block aspect-square w-full cursor-crosshair touch-none rounded-2xl shadow-lg ring-1 shadow-black/5 ring-black/5 select-none"
        style={{ backgroundColor: paper }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endGesture}
        onPointerCancel={endGesture}
        onLostPointerCapture={endGesture}
      />
      <div
        aria-hidden
        className={cn(
          'pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 transition-opacity duration-300 ease-out',
          showWelcome && !unsupported ? 'opacity-100' : 'opacity-0',
        )}
      >
        <p className="text-fg-mute text-lg md:text-xl">
          とぷん、とひと滴おとしてみよう
        </p>
        <p className="text-fg-subtle text-sm">
          「おまかせで描く」から始めるのもおすすめ
        </p>
      </div>
      {unsupported ? (
        <div className="absolute inset-0 flex items-center justify-center p-6">
          <p className="text-fg-mute text-center text-sm leading-relaxed">
            お使いのブラウザでは WebGL2 が利用できないため、
            <br />
            えのぐあそびができません。最新のブラウザでお試しください。
          </p>
        </div>
      ) : null}
    </div>
  );
}
