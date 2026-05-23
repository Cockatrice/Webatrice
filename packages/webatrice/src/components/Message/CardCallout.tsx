import Popover from '@mui/material/Popover';

import CardDetails from '../CardDetails/CardDetails';
import TokenDetails from '../TokenDetails/TokenDetails';

import { useCardCallout } from './useCardCallout';

import './CardCallout.css';

interface CardCalloutProps {
  name: string;
}

const CardCallout = ({ name }: CardCalloutProps) => {
  const { card, token, anchorEl, open, handlePopoverOpen, handlePopoverClose } =
    useCardCallout(name);

  return (
    <span className='callout'>
      <span
        onMouseEnter={handlePopoverOpen}
        onMouseLeave={handlePopoverClose}
      >{card?.name?.value || token?.name?.value || name}</span>

      <Popover
        open={open && Boolean(card || token)}
        anchorEl={anchorEl}
        onClose={handlePopoverClose}
        anchorOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'bottom',
          horizontal: 'left',
        }}
        disableAutoFocus
        disableEnforceFocus
        disableRestoreFocus
        disableScrollLock
        sx={{ pointerEvents: 'none' }}
        slotProps={{ paper: { sx: { pointerEvents: 'none' } } }}
      >
        <div className="callout-card">
          {card && (<CardDetails card={card} />)}
          {token && (<TokenDetails token={token} />)}
        </div>
      </Popover>
    </span>
  );
};

export default CardCallout;
