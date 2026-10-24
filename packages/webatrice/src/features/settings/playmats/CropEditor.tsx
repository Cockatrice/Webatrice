import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { type games } from '@cockatrice/datatrice';
import { PlaymatImage } from '@app/components';
import { CROP_LABEL_KEYS, CROP_SLIDERS, cx, type Size } from '@app/utils';

import CommittedInput from '../controls/CommittedInput';
import { focusRing } from '../controls/fields';

const PREVIEW: Size = { width: 320, height: 120 };

interface CropEditorProps {
  playmat: games.Playmat;
  onChange: (params: games.PlaymatParams) => void;
}

export default function CropEditor({ playmat, onChange }: CropEditorProps) {
  const { t } = useTranslation();
  const baseId = useId();
  const [draft, setDraft] = useState<games.PlaymatParams | null>(null);
  const params = draft ?? playmat.params;

  return (
    <div className="flex flex-wrap items-start gap-x-6 gap-y-3" role="group" aria-label={t('PlaymatSettings.crop.title')}>
      <div
        className="relative shrink-0 overflow-hidden rounded-ui bg-bg-base"
        style={PREVIEW}
        role="img"
        aria-label={t('PlaymatSettings.crop.preview')}
      >
        <PlaymatImage playmat={{ ...playmat, params }} area={PREVIEW} />
      </div>
      <div className="grid min-w-[18rem] flex-1 grid-cols-[auto_1fr_auto] items-center gap-x-3 gap-y-2 text-[12px]">
        {CROP_SLIDERS.map(({ key, min, max, step, format }) => {
          const id = `${baseId}-${key}`;
          return (
            <div key={key} className="contents">
              <label htmlFor={id} className="text-text-secondary">{t(CROP_LABEL_KEYS[key])}</label>
              <CommittedInput
                id={id}
                type="range"
                min={min}
                max={max}
                step={step}
                value={String(params[key])}
                aria-valuetext={format(params[key])}
                className={cx('h-1.5 w-full cursor-pointer accent-accent', focusRing)}
                onDraft={(raw) => setDraft({ ...params, [key]: Number(raw) })}
                onCommit={(raw) => {
                  setDraft(null);
                  onChange({ ...params, [key]: Number(raw) });
                }}
              />
              <output htmlFor={id} className="w-10 text-right font-mono tabular-nums text-text-secondary">
                {format(params[key])}
              </output>
            </div>
          );
        })}
      </div>
    </div>
  );
}
