import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronsLeft, ChevronsRight, FastForward, Pause, Play, Settings2, StepBack, StepForward } from 'lucide-react';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import IconButton from '@mui/material/IconButton';
import Popover from '@mui/material/Popover';
import TextField from '@mui/material/TextField';

import { BIG_SKIP_MS, SMALL_SKIP_MS } from '@app/services';

import ReplayTimeline from './ReplayTimeline';
import { formatReplayTime } from '@app/utils';
import type { ReplayPlayback } from './useReplayPlayback';

import './ReplayControls.css';

const MIN_FAST_FORWARD_SPEED = 1;
const MAX_FAST_FORWARD_SPEED = 99.9;

export interface ReplayControlsProps {
  playback: ReplayPlayback;
}

function ReplayControls({ playback }: ReplayControlsProps) {
  const { t } = useTranslation();
  const [settingsAnchor, setSettingsAnchor] = useState<HTMLElement | null>(null);
  const { state, timeline, fastForward, fastForwardSpeed } = playback;
  const [speedDraft, setSpeedDraft] = useState<string | null>(null);

  const editSpeed = (draft: string) => {
    setSpeedDraft(draft);
    const value = Number(draft);
    if (draft.trim() !== '' && value >= MIN_FAST_FORWARD_SPEED && value <= MAX_FAST_FORWARD_SPEED) {
      playback.setFastForwardSpeed(Math.round(value * 10) / 10);
    }
  };

  const commitSpeed = () => {
    if (speedDraft == null) {
      return;
    }
    const value = Number(speedDraft);
    if (Number.isFinite(value)) {
      const clamped = Math.min(MAX_FAST_FORWARD_SPEED, Math.max(MIN_FAST_FORWARD_SPEED, Math.round(value * 10) / 10));
      playback.setFastForwardSpeed(clamped);
    }
    setSpeedDraft(null);
  };

  return (
    <div className="replay-controls" data-testid="replay-controls">
      <IconButton
        size="small"
        aria-label={t('GameReplay.controls.skipBackwardBig')}
        title={t('GameReplay.controls.skipBackwardBig')}
        onClick={() => playback.skipBy(-BIG_SKIP_MS)}
      >
        <ChevronsLeft size={18} />
      </IconButton>
      <IconButton
        size="small"
        aria-label={t('GameReplay.controls.skipBackward')}
        title={t('GameReplay.controls.skipBackward')}
        onClick={() => playback.skipBy(-SMALL_SKIP_MS)}
      >
        <StepBack size={18} />
      </IconButton>
      <IconButton
        size="small"
        aria-label={state.playing ? t('GameReplay.controls.pause') : t('GameReplay.controls.play')}
        title={state.playing ? t('GameReplay.controls.pause') : t('GameReplay.controls.play')}
        aria-pressed={state.playing}
        onClick={playback.togglePlay}
      >
        {state.playing ? <Pause size={20} /> : <Play size={20} />}
      </IconButton>
      <IconButton
        size="small"
        aria-label={t('GameReplay.controls.skipForward')}
        title={t('GameReplay.controls.skipForward')}
        onClick={() => playback.skipBy(SMALL_SKIP_MS)}
      >
        <StepForward size={18} />
      </IconButton>
      <IconButton
        size="small"
        aria-label={t('GameReplay.controls.skipForwardBig')}
        title={t('GameReplay.controls.skipForwardBig')}
        onClick={() => playback.skipBy(BIG_SKIP_MS)}
      >
        <ChevronsRight size={18} />
      </IconButton>

      <ReplayTimeline
        timeline={timeline}
        currentTime={state.currentTime}
        maxTime={state.maxTime}
        onSeek={playback.seek}
      />

      <span className="replay-controls__time" data-testid="replay-time">
        {formatReplayTime(state.currentTime)} / {formatReplayTime(state.maxTime)}
      </span>

      <IconButton
        size="small"
        aria-label={t('GameReplay.controls.fastForward', { speed: fastForwardSpeed })}
        title={t('GameReplay.controls.fastForward', { speed: fastForwardSpeed })}
        aria-pressed={fastForward}
        color={fastForward ? 'primary' : 'default'}
        onClick={playback.toggleFastForward}
      >
        <FastForward size={18} />
      </IconButton>
      <IconButton
        size="small"
        aria-label={t('GameReplay.controls.settings')}
        title={t('GameReplay.controls.settings')}
        onClick={(event) => setSettingsAnchor(event.currentTarget)}
      >
        <Settings2 size={18} />
      </IconButton>

      <Popover
        open={settingsAnchor != null}
        anchorEl={settingsAnchor}
        onClose={() => {
          commitSpeed();
          setSettingsAnchor(null);
        }}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        transformOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <div className="replay-controls__settings">
          <TextField
            size="small"
            type="number"
            label={t('GameReplay.settings.fastForwardSpeed')}
            value={speedDraft ?? String(fastForwardSpeed)}
            onChange={(event) => editSpeed(event.target.value)}
            onBlur={commitSpeed}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                commitSpeed();
              }
            }}
            slotProps={{
              htmlInput: { min: MIN_FAST_FORWARD_SPEED, max: MAX_FAST_FORWARD_SPEED, step: 0.1 },
              input: { endAdornment: <span>x</span> },
            }}
          />
          <FormControlLabel
            control={(
              <Checkbox
                size="small"
                checked={state.skipEmptySections}
                onChange={(event) => playback.setSkipEmptySections(event.target.checked)}
              />
            )}
            label={t('GameReplay.settings.skipEmptySections')}
          />
        </div>
      </Popover>
    </div>
  );
}

export default ReplayControls;
