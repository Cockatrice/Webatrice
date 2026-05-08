import { CardDTO, getScryfallUrl } from '@app/services';
import { App } from '@app/types';

import './Card.css';

interface CardProps {
  card: CardDTO;
}

const Card = ({ card }: CardProps) => {
  if (!card) {
    return null;
  }

  // Prefer Oracle's per-printing `picurl` when present; fall back to a
  // Scryfall by-name lookup. Oracle frequently leaves `picurl` blank — name
  // lookup keeps the image working without a Scryfall ID we don't store.
  const printing = Array.isArray(card.set) ? card.set[0] : card.set;
  const oracleUrl = printing?.picurl ?? printing?.picURL;
  const name = card.name?.value;
  const src = oracleUrl
    ?? (name ? getScryfallUrl({ name }, App.ScryfallImageSize.Normal) : null)
    ?? undefined;

  return <img className="card" src={src} alt={name} />;
};

export default Card;
