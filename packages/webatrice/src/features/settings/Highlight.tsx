import { highlightParts } from './searchSettings';

export default function Highlight({ text, query }: { text: string; query?: string }) {
  if (!query?.trim()) {
    return <>{text}</>;
  }
  return (
    <>
      {highlightParts(text, query).map((part, index) => (part.match
        ? <mark key={index} className="rounded-[3px] bg-warning/30 px-[1px] text-text-primary">{part.text}</mark>
        : part.text))}
    </>
  );
}
