import { Droplet, Tornado, Waves, Wind } from 'lucide-react';

import type { Tool } from '../engine/session';

import picker from './picker.module.css';
import styles from './tool-picker.module.css';

type ToolPickerProps = {
  tool: Tool;
  onToolChange: (tool: Tool) => void;
};

const TOOLS = [
  { id: 'drop', label: 'しずく', icon: Droplet },
  { id: 'flow', label: 'ながし', icon: Waves },
  { id: 'comb', label: 'くし', icon: Wind },
  { id: 'vortex', label: 'うず', icon: Tornado },
] as const;

export function ToolPicker({ tool, onToolChange }: ToolPickerProps) {
  return (
    <fieldset>
      <legend className={picker.legend}>どうぐ</legend>
      <div className={styles.grid}>
        {TOOLS.map(({ id, label, icon: Icon }) => (
          <label key={id} className={`${picker.option} ${styles.tool}`}>
            <input
              aria-label={label}
              checked={tool === id}
              className={picker.srOnly}
              name="tool"
              type="radio"
              value={id}
              onChange={() => {
                onToolChange(id);
              }}
            />
            <Icon aria-hidden size={20} />
            <span className={styles.label}>{label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
