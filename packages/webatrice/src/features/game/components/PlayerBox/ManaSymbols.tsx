/**
 * Renderers for Scryfall mana-cost / oracle-text tokens like `{3}`, `{R}`,
 * `{2/W}`, `{W/U}`, `{T}`, `{X}`. Hybrid/phyrexian tokens on Scryfall's CDN
 * drop the slash — `{W/U}` becomes `WU.svg`, `{2/W}` becomes `2W.svg`.
 *
 * Two entry points:
 *   - <ManaSymbols cost="{3}{R}{G}" />  — pure symbol row, wrapped in flex
 *   - <SymbolText text="{T}: Add {G}" /> — text with symbols interpolated
 *
 * Both share the same primitive `<ManaSymbol token="{X}">` under the hood.
 */

const TOKEN_RE = /\{[^}]+\}/g;
const SINGLE_TOKEN_RE = /^\{[^}]+\}$/;

function ManaSymbol({ token, size }: { token: string; size: number | string }) {
  const inner = token.slice(1, -1).replace(/\//g, "");
  // Size via CSS style, not HTML width/height attrs, so em/rem/% work.
  // HTML width/height expect plain pixel numbers; a string like "2.75em"
  // silently falls back to the SVG's intrinsic 24×24 viewbox size.
  return (
    <img
      src={`https://svgs.scryfall.io/card-symbols/${inner}.svg`}
      alt={token}
      style={{ width: size, height: size }}
      className="inline-block align-text-bottom"
      draggable={false}
    />
  );
}

export function ManaSymbols({
  cost,
  size = 16,
  className,
}: {
  cost: string;
  size?: number | string;
  className?: string;
}) {
  const tokens = cost.match(TOKEN_RE);
  if (!tokens || tokens.length === 0) return null;
  return (
    <span className={`inline-flex items-center gap-0.5 align-middle ${className ?? ""}`}>
      {tokens.map((tok, i) => (
        <ManaSymbol key={i} token={tok} size={size} />
      ))}
    </span>
  );
}

export function SymbolText({ text, size = 12 }: { text: string; size?: number }) {
  // Split preserving the tokens so we can render text chunks as-is and
  // tokens as images. Newlines survive because we render text via <span>s
  // and let the parent's `whitespace-pre-line` (or similar) preserve them.
  const parts = text.split(/(\{[^}]+\})/g);
  return (
    <>
      {parts.map((p, i) => {
        if (SINGLE_TOKEN_RE.test(p)) return <ManaSymbol key={i} token={p} size={size} />;
        return <span key={i}>{p}</span>;
      })}
    </>
  );
}
