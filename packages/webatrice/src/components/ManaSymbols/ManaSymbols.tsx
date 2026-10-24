import { getScryfallSymbolUrl } from '@app/services';

import { isManaToken, manaCostTokens } from './manaTokens';

export function ManaSymbol({ token, size }: { token: string; size: number | string }) {
  // Size via CSS style, not HTML width/height attrs, so em/rem/% work.
  return (
    <img
      src={getScryfallSymbolUrl(token)}
      alt={token}
      style={{ width: size, height: size }}
      className="inline-block align-text-bottom"
      draggable={false}
    />
  );
}

export function ManaSymbols({
  cost,
  size = 14,
  className,
}: {
  cost: string;
  size?: number | string;
  className?: string;
}) {
  const tokens = manaCostTokens(cost);
  if (tokens.length === 0) {
    return null;
  }
  return (
    <span className={`inline-flex items-center gap-0.5 align-middle ${className ?? ''}`}>
      {tokens.map((tok, i) => (
        <ManaSymbol key={i} token={tok} size={size} />
      ))}
    </span>
  );
}

export function SymbolText({ text, size = 12 }: { text: string; size?: number }) {
  const parts = text.split(/(\{[^}]+\})/g);
  return (
    <>
      {parts.map((p, i) => {
        if (isManaToken(p)) {
          return <ManaSymbol key={i} token={p} size={size} />;
        }
        return <span key={i}>{p}</span>;
      })}
    </>
  );
}
