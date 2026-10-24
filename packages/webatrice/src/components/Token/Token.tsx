import { useCardImageUrls, useImageCandidates } from '@app/hooks';
import { TokenDTO } from '@app/services';

import './Token.css';

interface TokenProps {
  token: TokenDTO;
}

const Token = ({ token }: TokenProps) => {
  const { src, onError } = useImageCandidates(useCardImageUrls(token));

  if (!token) {
    return null;
  }
  return <img className="token" src={src ?? undefined} alt={token.name?.value} onError={onError} />;
};

export default Token;
