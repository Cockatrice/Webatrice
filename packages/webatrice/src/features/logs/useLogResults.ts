import { useState } from 'react';

export interface LogResults {
  value: number;
  handleChange: (event: unknown, newValue: number) => void;
  selectedKey: string | null;
  select: (key: string | null) => void;
}

export function useLogResults(): LogResults {
  const [value, setValue] = useState(0);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const handleChange = (_event: unknown, newValue: number) => {
    setValue(newValue);
    setSelectedKey(null);
  };

  return { value, handleChange, selectedKey, select: setSelectedKey };
}
