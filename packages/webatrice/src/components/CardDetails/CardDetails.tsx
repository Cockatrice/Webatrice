import { CardDTO } from '@app/services';

import Card from '../Card/Card';

import './CardDetails.css';

interface CardProps {
  card: CardDTO;
}

const CardDetails = ({ card }: CardProps) => {
  const props = card?.prop?.value;
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
    <div className='cardDetails'>
      <div className='cardDetails-card'>
        <Card card={card} />
      </div>

      {
        card && (
          <div>
            <div className='cardDetails-attributes'>
              <div className='cardDetails-attribute'>
                <span className='cardDetails-attribute__label'>Name:</span>
                <span className='cardDetails-attribute__value'>{card.name?.value}</span>
              </div>

              {pt && (
                <div className='cardDetails-attribute'>
                  <span className='cardDetails-attribute__label'>P/T:</span>
                  <span className='cardDetails-attribute__value'>{pt}</span>
                </div>
              )}

              {manacost && (
                <div className='cardDetails-attribute'>
                  <span className='cardDetails-attribute__label'>Cost:</span>
                  <span className='cardDetails-attribute__value'>{manacost.replace(/\{|\}/g, '')}</span>
                </div>
              )}

              {cmc && (
                <div className='cardDetails-attribute'>
                  <span className='cardDetails-attribute__label'>CMC:</span>
                  <span className='cardDetails-attribute__value'>{cmc}</span>
                </div>
              )}

              {coloridentity && (
                <div className='cardDetails-attribute'>
                  <span className='cardDetails-attribute__label'>Identity:</span>
                  <span className='cardDetails-attribute__value'>{coloridentity}</span>
                </div>
              )}

              {colors && (
                <div className='cardDetails-attribute'>
                  <span className='cardDetails-attribute__label'>Color(s):</span>
                  <span className='cardDetails-attribute__value'>{colors}</span>
                </div>
              )}

              {maintype && (
                <div className='cardDetails-attribute'>
                  <span className='cardDetails-attribute__label'>Main Type:</span>
                  <span className='cardDetails-attribute__value'>{maintype}</span>
                </div>
              )}

              {type && (
                <div className='cardDetails-attribute'>
                  <span className='cardDetails-attribute__label'>Type:</span>
                  <span className='cardDetails-attribute__value'>{type}</span>
                </div>
              )}

              {side && (
                <div className='cardDetails-attribute'>
                  <span className='cardDetails-attribute__label'>Side:</span>
                  <span className='cardDetails-attribute__value'>{side}</span>
                </div>
              )}

              {layout && (
                <div className='cardDetails-attribute'>
                  <span className='cardDetails-attribute__label'>Layout:</span>
                  <span className='cardDetails-attribute__value'>{layout}</span>
                </div>
              )}
            </div>

            {card.text?.value && (
              <div className='cardDetails-text'>
                <div className='cardDetails-text__current'>
                  {card.text.value.trim()}
                </div>
              </div>
            )}
          </div>
        )
      }
    </div>
  );
};

export default CardDetails;
