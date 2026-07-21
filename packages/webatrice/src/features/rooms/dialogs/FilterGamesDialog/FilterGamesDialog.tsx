import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X, Check, ChevronDown } from 'lucide-react';

import { rooms, type GameFilters } from '@cockatrice/datatrice';
import { GametypeMap } from '@cockatrice/datatrice';

export interface FilterGamesDialogProps {
  isOpen: boolean;
  // MUST be a stable reference: an unstable reference resets the draft form on every parent render.
  initialFilters: GameFilters;
  gametypeMap: GametypeMap;
  onCancel: () => void;
  onSubmit: (filters: GameFilters) => void;
}

interface MaxAgeOption {
  label: string;
  seconds: number;
}

const MAX_AGE_OPTIONS: MaxAgeOption[] = [
  { label: 'No limit', seconds: 0 },
  { label: '5 minutes', seconds: 5 * 60 },
  { label: '10 minutes', seconds: 10 * 60 },
  { label: '30 minutes', seconds: 30 * 60 },
  { label: '1 hour', seconds: 60 * 60 },
  { label: '2 hours', seconds: 2 * 60 * 60 },
];

export default function FilterGamesDialog({
  isOpen,
  initialFilters,
  gametypeMap,
  onCancel,
  onSubmit,
}: FilterGamesDialogProps) {
  const [form, setForm] = useState<GameFilters>(initialFilters);
  const [creatorNamesText, setCreatorNamesText] = useState<string>(
    initialFilters.creatorNameFilters.join(', '),
  );

  useEffect(() => {
    if (isOpen) {
      setForm(initialFilters);
      setCreatorNamesText(initialFilters.creatorNameFilters.join(', '));
    }
  }, [isOpen, initialFilters]);

  // Close on Escape.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onCancel]);

  const gameTypes = useMemo(
    () => Object.entries(gametypeMap).map(([id, name]) => ({ id: Number(id), name })),
    [gametypeMap],
  );

  const update = <K extends keyof GameFilters>(key: K, value: GameFilters[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const toggleGameType = (id: number) => {
    setForm((prev) => {
      const set = new Set(prev.gameTypeFilter);
      if (set.has(id)) set.delete(id);
      else set.add(id);
      return { ...prev, gameTypeFilter: Array.from(set) };
    });
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const creatorNameFilters = creatorNamesText
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    onSubmit({ ...form, creatorNameFilters });
  };

  const handleReset = () => {
    setForm(rooms.DEFAULT_GAME_FILTERS);
    setCreatorNamesText('');
  };

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Filter games"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-[2px]"
        onClick={onCancel}
      />

      {/* Card */}
      <div className="relative z-10 w-full max-w-lg max-h-[90vh] flex flex-col rounded-xl bg-bg-surface border border-border-subtle shadow-glow overflow-hidden">
        <header className="shrink-0 flex items-center justify-between px-5 py-4 border-b border-border-subtle">
          <h2 className="font-modern text-lg font-semibold text-text-primary">Filter games</h2>
          <button
            type="button"
            onClick={onCancel}
            className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-bg-elevated transition-colors"
            title="Close"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </header>

        <form onSubmit={handleSubmit} className="flex flex-col min-h-0 flex-1">
          <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-4">
            <TextInput
              label="Game description contains"
              value={form.gameNameFilter}
              onChange={(v) => update('gameNameFilter', v)}
              autoFocus
            />
            <TextInput
              label="Creator names (comma-separated)"
              value={creatorNamesText}
              onChange={setCreatorNamesText}
            />
            <div className="grid grid-cols-2 gap-3">
              <NumberInput
                label="Min players"
                value={form.maxPlayersFilterMin}
                onChange={(v) => update('maxPlayersFilterMin', v)}
                min={0}
                max={99}
              />
              <NumberInput
                label="Max players"
                value={form.maxPlayersFilterMax}
                onChange={(v) => update('maxPlayersFilterMax', v)}
                min={0}
                max={99}
              />
            </div>

            <SelectInput
              label="Max age"
              value={form.maxGameAgeSeconds}
              onChange={(v) => update('maxGameAgeSeconds', v)}
              options={MAX_AGE_OPTIONS.map((o) => ({ value: o.seconds, label: o.label }))}
            />

            {gameTypes.length > 0 && (
              <Section title="Game types">
                {gameTypes.map(({ id, name }) => (
                  <Checkbox
                    key={id}
                    label={name}
                    checked={form.gameTypeFilter.includes(id)}
                    onChange={() => toggleGameType(id)}
                  />
                ))}
              </Section>
            )}

            <Section title="Hide">
              <Checkbox
                label="Hide full games"
                checked={form.hideFullGames}
                onChange={(c) => update('hideFullGames', c)}
              />
              <Checkbox
                label="Hide games that started"
                checked={form.hideGamesThatStarted}
                onChange={(c) => update('hideGamesThatStarted', c)}
              />
              <Checkbox
                label="Hide password-protected games"
                checked={form.hidePasswordProtectedGames}
                onChange={(c) => update('hidePasswordProtectedGames', c)}
              />
              <Checkbox
                label="Hide buddies-only games"
                checked={form.hideBuddiesOnlyGames}
                onChange={(c) => update('hideBuddiesOnlyGames', c)}
              />
              <Checkbox
                label="Hide games created by ignored users"
                checked={form.hideIgnoredUserGames}
                onChange={(c) => update('hideIgnoredUserGames', c)}
              />
              <Checkbox
                label="Hide games not created by buddies"
                checked={form.hideNotBuddyCreatedGames}
                onChange={(c) => update('hideNotBuddyCreatedGames', c)}
              />
              <Checkbox
                label="Hide open-decklist games"
                checked={form.hideOpenDecklistGames}
                onChange={(c) => update('hideOpenDecklistGames', c)}
              />
            </Section>

            <Section title="Spectator filters">
              <Checkbox
                label="Show only games where spectators can watch"
                checked={form.showOnlyIfSpectatorsCanWatch}
                onChange={(c) => update('showOnlyIfSpectatorsCanWatch', c)}
              />
              <Checkbox
                label="Show games where spectators need a password"
                checked={form.showSpectatorPasswordProtected}
                onChange={(c) => update('showSpectatorPasswordProtected', c)}
                disabled={!form.showOnlyIfSpectatorsCanWatch}
              />
              <Checkbox
                label="Show only games where spectators can chat"
                checked={form.showOnlyIfSpectatorsCanChat}
                onChange={(c) => update('showOnlyIfSpectatorsCanChat', c)}
                disabled={!form.showOnlyIfSpectatorsCanWatch}
              />
              <Checkbox
                label="Show only games where spectators see hands"
                checked={form.showOnlyIfSpectatorsCanSeeHands}
                onChange={(c) => update('showOnlyIfSpectatorsCanSeeHands', c)}
                disabled={!form.showOnlyIfSpectatorsCanWatch}
              />
            </Section>
          </div>

          <footer className="shrink-0 flex items-center justify-end gap-2 px-5 py-3 border-t border-border-subtle bg-bg-surface">
            <button
              type="button"
              onClick={handleReset}
              className="px-4 py-1.5 rounded-md text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-bg-elevated transition-colors"
            >
              Reset
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-1.5 rounded-md text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-bg-elevated transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 rounded-md text-sm font-semibold bg-accent text-white hover:bg-accent-hover shadow-glow transition-colors"
            >
              Apply
            </button>
          </footer>
        </form>
      </div>
    </div>,
    document.body,
  );
}

/* --- Field primitives, kept in-file since only this dialog uses them
       right now. When we build another Tailwind dialog we'll lift the
       shared ones into `dialogs/` or `components/`. --- */

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h3 className="font-modern text-xs font-bold uppercase tracking-wider text-text-muted mb-2">
        {title}
      </h3>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

interface TextInputProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  autoFocus?: boolean;
}

function TextInput({ label, value, onChange, autoFocus }: TextInputProps) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-text-muted mb-1">{label}</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoFocus={autoFocus}
        className="w-full px-3 py-2 rounded-md bg-bg-elevated border border-border-subtle text-sm text-text-primary focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-colors"
      />
    </label>
  );
}

interface NumberInputProps {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
}

function NumberInput({ label, value, onChange, min, max }: NumberInputProps) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-text-muted mb-1">{label}</span>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full px-3 py-2 rounded-md bg-bg-elevated border border-border-subtle text-sm text-text-primary tabular-nums focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-colors"
      />
    </label>
  );
}

interface SelectInputProps<V extends string | number> {
  label: string;
  value: V;
  onChange: (v: V) => void;
  options: Array<{ value: V; label: string }>;
}

function SelectInput<V extends string | number>({
  label,
  value,
  onChange,
  options,
}: SelectInputProps<V>) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-text-muted mb-1">{label}</span>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => {
            const raw = e.target.value;
            const casted = typeof value === 'number' ? (Number(raw) as V) : (raw as V);
            onChange(casted);
          }}
          className="w-full appearance-none px-3 py-2 pr-8 rounded-md bg-bg-elevated border border-border-subtle text-sm text-text-primary focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-colors"
        >
          {options.map((opt) => (
            <option
              key={String(opt.value)}
              value={opt.value}
              className="bg-bg-surface text-text-primary"
            >
              {opt.label}
            </option>
          ))}
        </select>
        <ChevronDown
          size={14}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none"
        />
      </div>
    </label>
  );
}

interface CheckboxProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

/** Custom checkbox with visible checked/unchecked/disabled states.
 *  Disabled dims the whole row (box + label) to 60% so it reads as
 *  "off" without the MUI-era feeling of being broken. */
function Checkbox({ label, checked, onChange, disabled }: CheckboxProps) {
  return (
    <label
      className={[
        'flex items-center gap-2 py-1 select-none transition-opacity',
        disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer',
      ].join(' ')}
    >
      <span className="relative inline-flex shrink-0">
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
          className="peer sr-only"
        />
        <span
          className={[
            'h-4 w-4 rounded border flex items-center justify-center transition-colors',
            checked
              ? 'bg-accent border-accent'
              : 'bg-bg-elevated border-border-strong',
            !disabled && !checked && 'peer-hover:border-accent',
            !disabled && 'peer-focus-visible:ring-2 peer-focus-visible:ring-accent peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-bg-surface',
          ]
            .filter(Boolean)
            .join(' ')}
        >
          {checked && <Check size={11} strokeWidth={3} className="text-white" />}
        </span>
      </span>
      <span className="text-sm text-text-secondary">{label}</span>
    </label>
  );
}
