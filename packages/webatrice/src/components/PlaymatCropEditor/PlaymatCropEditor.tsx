import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Slider from '@mui/material/Slider';

import { type games } from '@cockatrice/datatrice';
import PlaymatImage from '../PlaymatImage/PlaymatImage';
import { CROP_LABEL_KEYS, CROP_SLIDERS, type Size } from '@app/utils';

const PREVIEW: Size = { width: 320, height: 120 };

interface PlaymatCropEditorProps {
  playmat: games.Playmat;
  onChange: (params: games.PlaymatParams) => void;
}

export default function PlaymatCropEditor({ playmat, onChange }: PlaymatCropEditorProps) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<games.PlaymatParams | null>(null);
  const params = draft ?? playmat.params;

  const sliders = CROP_SLIDERS.map((slider) => ({ ...slider, label: t(CROP_LABEL_KEYS[slider.key]) }));

  return (
    <div className="flex flex-col gap-1 py-2 pl-4" role="group" aria-label={t('PlaymatSettings.crop.title')}>
      <div className="relative overflow-hidden rounded bg-bg-base" style={PREVIEW}
        aria-label={t('PlaymatSettings.crop.preview')} role="img">
        <PlaymatImage playmat={{ ...playmat, params }} area={PREVIEW} />
      </div>
      {sliders.map(({ key, label, min, max, step, format }) => (
        <label key={key} className="grid grid-cols-[160px_1fr] items-center gap-3 max-w-[480px]">
          <span>{label}</span>
          <Slider
            size="small"
            min={min}
            max={max}
            step={step}
            value={params[key]}
            valueLabelDisplay="auto"
            valueLabelFormat={format}
            getAriaValueText={format}
            onChange={(_, value) => setDraft({ ...params, [key]: value as number })}
            onChangeCommitted={(_, value) => {
              setDraft(null);
              onChange({ ...params, [key]: value as number });
            }}
            slotProps={{ input: { 'aria-label': label } }}
          />
        </label>
      ))}
    </div>
  );
}
