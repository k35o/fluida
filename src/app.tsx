import { Button, IconButton, useToast } from '@k8ordo/ui';
import { Download, Eraser, Redo2, Undo2 } from 'lucide-react';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';

import { CanvasStage } from './components/canvas-stage';
import { ControlPanel } from './components/control-panel';
import { DEFAULT_PALETTE, findPalette } from './engine/palettes';
import type { InkChoice } from './engine/palettes';
import { FluidSession } from './engine/session';
import type { GestureConfig, Tool } from './engine/session';
import { saveOrShareImage } from './helpers/share-image';
import {
  CUSTOM_PALETTE_ID,
  useCustomPalette,
} from './hooks/use-custom-palette';

import styles from './app.module.css';

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
  // 一度だけ作って差し替えないので setter を持たない。render 中に ref を読む遅延初期化は
  // React Compiler の規則に触れる
  // oxlint-disable-next-line react/hook-use-state
  const [session] = useState(() => new FluidSession(DEFAULT_PALETTE.paper));

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
  const { open: openToast } = useToast();

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
      const result = await saveOrShareImage(blob, `fluida-${timestamp()}.png`);
      if (result === 'shared') {
        openToast('success', 'シェアしました');
      } else if (result === 'downloaded') {
        openToast('success', 'もようを画像にのこしました');
      }
      // canceled（共有シートを閉じた）ときは何も出さない
    } catch {
      openToast('error', 'のこせませんでした。もう一度ためしてください');
    }
  };

  // まっさらにする操作は「もどす」で完全に復元できるため、
  // 確認ダイアログで止めずに即実行し、トーストで戻し方を案内する
  const handleClear = () => {
    session.clear();
    openToast('info', 'まっさらにしました。「もどす」で戻せます');
  };

  return (
    <div className={styles.root}>
      <div className={styles.container}>
        <header className={styles.header}>
          <div className={styles.brand}>
            <h1 className={styles.wordmark}>fluida</h1>
            <p className={styles.tagline}>ゆらして描く、えのぐあそび</p>
          </div>
          <div className={styles.actions}>
            <IconButton
              color="transparent"
              disabled={!snapshot.canUndo}
              label="もどす"
              onClick={() => {
                session.undo();
              }}
            >
              <Undo2 aria-hidden size={20} />
            </IconButton>
            <IconButton
              color="transparent"
              disabled={!snapshot.canRedo}
              label="やりなおす"
              onClick={() => {
                session.redo();
              }}
            >
              <Redo2 aria-hidden size={20} />
            </IconButton>
            <IconButton
              color="transparent"
              disabled={snapshot.isEmpty}
              label="まっさらにする"
              onClick={handleClear}
            >
              <Eraser aria-hidden size={20} />
            </IconButton>
            <div aria-hidden className={styles.divider} />
            <Button
              color="primary"
              disabled={snapshot.isEmpty}
              size="md"
              startIcon={<Download aria-hidden size={16} />}
              onAction={handleSave}
            >
              画像でのこす
            </Button>
          </div>
        </header>
        <main className={styles.main}>
          <section className={styles.stage}>
            <div className={styles.canvasFrame}>
              <CanvasStage
                buildConfig={buildConfig}
                paper={palette.paper}
                session={session}
                showWelcome={snapshot.isEmpty && !snapshot.canUndo}
                tool={tool}
                unsupported={snapshot.unsupported}
              />
            </div>
            <p className={styles.hint}>{HINTS[tool]}</p>
          </section>
          <div className={styles.panel}>
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
