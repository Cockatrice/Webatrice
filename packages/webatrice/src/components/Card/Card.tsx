import { CardDTO, getScryfallUrl } from '@app/services';
import { ScryfallImageSize } from '@cockatrice/datatrice';
import './Card.css';

interface CardProps {
  card: CardDTO;
}

const Card = ({ card }: CardProps) => {
  if (!card) {
    return null;
  }

  const printing = Array.isArray(card.set) ? card.set[0] : card.set;
  const oracleUrl = printing?.picurl ?? printing?.picURL;
  const name = card.name?.value;
  const src = oracleUrl
    ?? (name ? getScryfallUrl({ name }, ScryfallImageSize.Normal) : null)
    ?? undefined;

  return <img className="card" src={src} alt={name} />;
};

export default Card;
