import { Droplet, Tornado, Waves, Wind } from 'lucide-react';

import type { Tool } from '../engine/session';

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
      <legend className="text-fg-mute mb-2.5 text-sm font-medium">
        どうぐ
      </legend>
      <div className="grid grid-cols-4 gap-2">
        {TOOLS.map(({ id, label, icon: Icon }) => (
          <label
            key={id}
            className="border-border-mute text-fg-mute has-[:checked]:border-primary-border has-[:checked]:bg-primary-bg-subtle has-[:checked]:text-fg-base hover:bg-bg-subtle hover:has-[:checked]:bg-primary-bg-subtle has-[:focus-visible]:ring-primary-border flex cursor-pointer flex-col items-center gap-1.5 rounded-2xl border px-1 py-3.5 transition-colors duration-150 ease-out has-[:focus-visible]:ring-2"
          >
            <input
              aria-label={label}
              checked={tool === id}
              className="sr-only"
              name="tool"
              type="radio"
              value={id}
              onChange={() => {
                onToolChange(id);
              }}
            />
            <Icon aria-hidden className="size-5" />
            <span className="text-xs font-medium">{label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
