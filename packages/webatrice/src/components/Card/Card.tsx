import { useCardImageUrls, useImageCandidates } from '@app/hooks';
import { CardDTO } from '@app/services';
import './Card.css';

interface CardProps {
  card: CardDTO;
}

const Card = ({ card }: CardProps) => {
  const { src, onError } = useImageCandidates(useCardImageUrls(card));

  if (!card) {
    return null;
  }

  return <img className="card" src={src ?? undefined} alt={card.name?.value} onError={onError} />;
};

export default Card;
