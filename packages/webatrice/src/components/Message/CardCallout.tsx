import { useId } from 'react';
import Paper from '@mui/material/Paper';
import Popper from '@mui/material/Popper';

import CardDetails from '../CardDetails/CardDetails';
import TokenDetails from '../TokenDetails/TokenDetails';

import { useCardCallout } from './useCardCallout';

import './CardCallout.css';

interface CardCalloutProps {
  name: string;
}

const POPPER_MODIFIERS = [
  { name: 'offset', options: { offset: ({ reference }: { reference: { width: number } }) => [reference.width, 0] } },
];

const CardCallout = ({ name }: CardCalloutProps) => {
  const { card, token, anchorEl, open, handlePopoverOpen, handlePopoverClose } =
    useCardCallout(name);
  const previewId = useId();
  const summaryId = useId();
  const showPreview = open && Boolean(card || token);
  const props = (card ?? token)?.prop?.value;
  const summary = [props?.type?.value || props?.maintype?.value, props?.pt?.value].filter(Boolean).join(', ');

  return (
    <span className='callout'>
      <button
        type="button"
        className="callout__name"
        aria-describedby={showPreview && summary ? summaryId : undefined}
        onMouseEnter={handlePopoverOpen}
        onMouseLeave={handlePopoverClose}
        onFocus={handlePopoverOpen}
        onBlur={handlePopoverClose}
        onKeyDown={(event) => {
          if (event.key === 'Escape' && open) {
            event.stopPropagation();
            handlePopoverClose();
          }
        }}
      >{card?.name?.value || token?.name?.value || name}</button>

      <Popper
        id={previewId}
        open={showPreview}
        anchorEl={anchorEl}
        placement="top-start"
        modifiers={POPPER_MODIFIERS}
        sx={{ pointerEvents: 'none', zIndex: (theme) => theme.zIndex.tooltip }}
      >
        <Paper className="callout-card">
          {summary && <span id={summaryId} className="sr-only">{summary}</span>}
          {card && (<CardDetails card={card} />)}
          {token && (<TokenDetails token={token} />)}
        </Paper>
      </Popper>
    </span>
  );
};

export default CardCallout;
