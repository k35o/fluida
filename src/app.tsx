import { Button, IconButton, useToast } from '@k8o/arte-odyssey';
import { Download, Eraser, Redo2, Undo2 } from 'lucide-react';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';

import { CanvasStage } from './components/canvas-stage';
import { ControlPanel } from './components/control-panel';
import {
  DEFAULT_PALETTE,
  findPalette,
  type InkChoice,
} from './engine/palettes';
import { FluidSession, type GestureConfig, type Tool } from './engine/session';
import {
  CUSTOM_PALETTE_ID,
  useCustomPalette,
} from './hooks/use-custom-palette';

const HINTS: Record<Tool, string> = {
  drop: 'とん、とタップでしずくがひろがる。おしたまま動かすと連なる',
  flow: 'ゆっくりなぞると、もようが流れる',
  comb: 'すーっと引くと、画面ぜんたいに櫛目がはしる',
  vortex: 'まるく回すように動かすと、渦がまきおこる',
};

const pad = (value: number) => String(value).padStart(2, '0');

function timestamp(): string {
  const now = new Date();
  return [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate()),
    '-',
    pad(now.getHours()),
    pad(now.getMinutes()),
    pad(now.getSeconds()),
  ].join('');
}

export function App() {
  const sessionRef = useRef<FluidSession | null>(null);
  sessionRef.current ??= new FluidSession(DEFAULT_PALETTE.paper);
  const session = sessionRef.current;

  const [tool, setTool] = useState<Tool>('drop');
  const [paletteId, setPaletteId] = useState(DEFAULT_PALETTE.id);
  const [ink, setInk] = useState<InkChoice>('auto');
  const [params, setParams] = useState<Record<Tool, number>>({
    drop: 48,
    flow: 110,
    comb: 120,
    vortex: 220,
  });
  const inkCursor = useRef(0);

  const snapshot = useSyncExternalStore(session.subscribe, session.getSnapshot);
  const [customPalette, setCustomPalette] = useCustomPalette();
  const palette =
    paletteId === CUSTOM_PALETTE_ID ? customPalette : findPalette(paletteId);
  const { onOpen } = useToast();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey)) return;
      if (event.key.toLowerCase() !== 'z') return;
      event.preventDefault();
      if (event.shiftKey) {
        session.redo();
      } else {
        session.undo();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [session]);

  const buildConfig = (): GestureConfig => ({
    value: params[tool],
    nextColor: () => {
      if (ink === 'paper') return palette.paper;
      if (typeof ink === 'number') {
        return palette.inks[ink] ?? palette.paper;
      }
      const color =
        palette.inks[inkCursor.current % palette.inks.length] ?? palette.paper;
      inkCursor.current += 1;
      return color;
    },
  });

  const handlePaletteChange = (id: string) => {
    setPaletteId(id);
    const next = id === CUSTOM_PALETTE_ID ? customPalette : findPalette(id);
    session.setPaper(next.paper);
  };

  const handleCustomChange = (paper: string, inks: readonly string[]) => {
    setCustomPalette(paper, inks);
    if (paletteId === CUSTOM_PALETTE_ID) {
      session.setPaper(paper);
    }
  };

  const handleSave = async () => {
    try {
      const blob = await session.exportPng();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `fluida-${timestamp()}.png`;
      anchor.click();
      URL.revokeObjectURL(url);
      onOpen('success', 'もようを画像にのこしました');
    } catch {
      onOpen('error', 'のこせませんでした。もう一度ためしてください');
    }
  };

  // まっさらにする操作は「もどす」で完全に復元できるため、
  // 確認ダイアログで止めずに即実行し、トーストで戻し方を案内する
  const handleClear = () => {
    session.clear();
    onOpen('info', 'まっさらにしました。「もどす」で戻せます');
  };

  return (
    <div className="bg-bg-subtle text-fg-base min-h-dvh">
      <div className="mx-auto max-w-6xl px-4 pt-7 pb-16 md:px-8 md:pt-10">
        <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-4 pb-8 md:pb-10">
          <div className="flex flex-wrap items-baseline gap-x-3.5 gap-y-1">
            <h1 className="font-wordmark text-3xl leading-none italic md:text-4xl">
              fluida
            </h1>
            <p className="text-fg-mute text-sm">ゆらして描く、えのぐあそび</p>
          </div>
          <div className="flex items-center gap-1.5">
            <IconButton
              color="transparent"
              disabled={!snapshot.canUndo}
              label="もどす"
              onClick={() => {
                session.undo();
              }}
            >
              <Undo2 aria-hidden className="size-5" />
            </IconButton>
            <IconButton
              color="transparent"
              disabled={!snapshot.canRedo}
              label="やりなおす"
              onClick={() => {
                session.redo();
              }}
            >
              <Redo2 aria-hidden className="size-5" />
            </IconButton>
            <IconButton
              color="transparent"
              disabled={snapshot.isEmpty}
              label="まっさらにする"
              onClick={handleClear}
            >
              <Eraser aria-hidden className="size-5" />
            </IconButton>
            <div aria-hidden className="bg-border-mute mx-1.5 h-6 w-px" />
            <Button
              color="primary"
              disabled={snapshot.isEmpty}
              size="md"
              startIcon={<Download aria-hidden className="size-4" />}
              onAction={handleSave}
            >
              画像でのこす
            </Button>
          </div>
        </header>
        <main className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-10">
          <section className="flex flex-col gap-4">
            {/* デスクトップでは作品全体が一望できる高さに収める */}
            <div className="mx-auto w-full lg:max-w-[calc(100dvh-15rem)]">
              <CanvasStage
                buildConfig={buildConfig}
                paper={palette.paper}
                session={session}
                showWelcome={snapshot.isEmpty && !snapshot.canUndo}
                tool={tool}
                unsupported={snapshot.unsupported}
              />
            </div>
            <p className="text-fg-mute text-center text-sm">{HINTS[tool]}</p>
          </section>
          <div className="lg:sticky lg:top-8">
            <ControlPanel
              customPalette={customPalette}
              ink={ink}
              palette={palette}
              paletteId={paletteId}
              params={params}
              tool={tool}
              onAuto={() => {
                session.applyAuto(palette);
              }}
              onCustomChange={handleCustomChange}
              onInkChange={setInk}
              onParamChange={(target, value) => {
                setParams((prev) => ({ ...prev, [target]: value }));
              }}
              onPaletteChange={handlePaletteChange}
              onToolChange={setTool}
            />
          </div>
        </main>
      </div>
    </div>
  );
}
