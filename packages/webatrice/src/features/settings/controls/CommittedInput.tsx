import { type InputHTMLAttributes, useEffect, useRef, useState } from 'react';

export type CommittedInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> & {
  value: string;
  onDraft?: (value: string) => void;
  onCommit: (value: string) => void;
};

export default function CommittedInput({ value, onDraft, onCommit, ...props }: CommittedInputProps) {
  const ref = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState<string | null>(null);
  const commitRef = useRef(onCommit);
  commitRef.current = onCommit;

  useEffect(() => {
    const input = ref.current;
    if (!input) {
      return;
    }
    const commit = () => {
      setDraft(null);
      commitRef.current(input.value);
    };
    input.addEventListener('change', commit);
    return () => input.removeEventListener('change', commit);
  }, []);

  return (
    <input
      ref={ref}
      {...props}
      value={draft ?? value}
      onChange={(e) => {
        if (e.nativeEvent.type !== 'input') {
          return;
        }
        setDraft(e.target.value);
        onDraft?.(e.target.value);
      }}
    />
  );
}
