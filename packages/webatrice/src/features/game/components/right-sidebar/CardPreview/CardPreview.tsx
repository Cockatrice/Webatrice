import { useEffect, useState } from 'react';
import { ServerInfo_Card } from '@cockatrice/sockatrice/generated';
import IconButton from '@mui/material/IconButton';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';

import { CardDTO } from '@app/services';

import { useScryfallCard } from '../../../hooks/useScryfallCard';

import './CardPreview.css';

export interface CardPreviewProps {
  card: ServerInfo_Card | null | undefined;
}

function CardPreview({ card }: CardPreviewProps) {
  const { smallUrl, normalUrl, ready } = useScryfallCard(card ?? null);
  const [normalLoaded, setNormalLoaded] = useState(false);
  const [flipped, setFlipped] = useState(false);
  const [dto, setDto] = useState<CardDTO | null>(null);

  useEffect(() => {
    setNormalLoaded(false);
  }, [normalUrl]);

  useEffect(() => {
    setDto(null);
    const name = card?.name;
    if (!name) return;
    let cancelled = false;
    CardDTO.get(name).then((found) => {
      if (!cancelled) setDto(found ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [card?.name]);

  return (
    <div className="card-preview" data-testid="card-preview">
      {!ready && (
        <div className="card-preview__empty">Hover a card to preview</div>
      )}
      {ready && smallUrl && (
        <div className="card-preview__frame">
          <div
            className={
              'card-preview__flipper' +
              (flipped ? ' card-preview__flipper--flipped' : '')
            }
          >
            <div className="card-preview__face card-preview__face--front">
              <img
                className="card-preview__image card-preview__image--small"
                src={smallUrl}
                alt={card?.name ?? ''}
              />
              {normalUrl && (
                <img
                  className={
                    'card-preview__image card-preview__image--normal' +
                    (normalLoaded ? ' card-preview__image--loaded' : '')
                  }
                  src={normalUrl}
                  alt={card?.name ?? ''}
                  onLoad={() => setNormalLoaded(true)}
                  data-testid="card-preview-normal"
                />
              )}
            </div>
            <div
              className="card-preview__face card-preview__face--back"
              data-testid="card-preview-back"
            >
              <CardBackContent dto={dto} fallbackName={card?.name} />
            </div>
          </div>
          <IconButton
            className="card-preview__info-button"
            size="small"
            aria-label="Toggle card info"
            aria-pressed={flipped}
            data-testid="card-preview-info-button"
            onClick={(e) => {
              e.stopPropagation();
              setFlipped((f) => !f);
            }}
          >
            <InfoOutlinedIcon fontSize="small" />
          </IconButton>
        </div>
      )}
    </div>
  );
}

interface CardBackContentProps {
  dto: CardDTO | null;
  fallbackName: string | undefined;
}

function CardBackContent({ dto, fallbackName }: CardBackContentProps) {
  if (!dto) {
    return (
      <div className="card-preview__no-data">
        {fallbackName && (
          <div className="card-preview__back-name">{fallbackName}</div>
        )}
        <div className="card-preview__back-empty">No card data</div>
      </div>
    );
  }

  const props = dto.prop?.value;
  const manacost = props?.manacost?.value;
  const cmc = props?.cmc?.value;
  const coloridentity = props?.coloridentity?.value;
  const colors = props?.colors?.value;
  const maintype = props?.maintype?.value;
  const type = props?.type?.value;
  const side = props?.side?.value;
  const layout = props?.layout?.value;
  const pt = props?.pt?.value;

  return (
    <div className="card-preview__back-body">
      <div className="card-preview__back-attrs">
        <Attr label="Name" value={dto.name?.value} />
        <Attr label="P/T" value={pt} />
        <Attr label="Cost" value={manacost?.replace(/\{|\}/g, '')} />
        <Attr label="CMC" value={cmc} />
        <Attr label="Identity" value={coloridentity} />
        <Attr label="Color(s)" value={colors} />
        <Attr label="Main Type" value={maintype} />
        <Attr label="Type" value={type} />
        <Attr label="Side" value={side} />
        <Attr label="Layout" value={layout} />
      </div>
      {dto.text?.value && (
        <div className="card-preview__back-text">{dto.text.value.trim()}</div>
      )}
    </div>
  );
}

function Attr({
  label,
  value,
}: {
  label: string;
  value: string | number | undefined | null;
}) {
  if (value === undefined || value === null || value === '') return null;
  return (
    <div className="card-preview__back-attr">
      <span className="card-preview__back-attr-label">{label}:</span>
      <span className="card-preview__back-attr-value">{value}</span>
    </div>
  );
}

export default CardPreview;
