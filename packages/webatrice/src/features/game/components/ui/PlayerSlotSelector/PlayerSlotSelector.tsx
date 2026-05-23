import { Select, MenuItem } from '@mui/material';

import './PlayerSlotSelector.css';

export interface PlayerSlotOption {
  playerId: number;
  name: string;
}

export interface PlayerSlotSelectorProps {
  label: string;
  slot: 'a' | 'b';
  players: PlayerSlotOption[];
  selectedPlayerId: number | undefined;
  onSelect: (playerId: number) => void;
}

function PlayerSlotSelector({
  label,
  slot,
  players,
  selectedPlayerId,
  onSelect,
}: PlayerSlotSelectorProps) {
  if (players.length === 0) {
    return null;
  }

  return (
    <div
      className="player-slot-selector"
      data-slot={slot}
      data-testid={`player-slot-selector-${slot}`}
    >
      <label className="player-slot-selector__label">{label}:</label>
      <Select
        className="player-slot-selector__select"
        size="small"
        value={selectedPlayerId ?? ''}
        onChange={(e) => onSelect(Number(e.target.value))}
      >
        {players.map((p) => (
          <MenuItem key={p.playerId} value={p.playerId}>
            {p.name}
          </MenuItem>
        ))}
      </Select>
    </div>
  );
}

export default PlayerSlotSelector;
