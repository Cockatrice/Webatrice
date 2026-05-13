import type { FieldRenderProps } from 'react-final-form';

// Bridges react-final-form's render-prop output to the library-agnostic
// prop shape our field wrappers (InputField, CheckboxField, etc.) accept.
// Temporary: deleted once every form has migrated to react-hook-form.
export function adaptRffField<V, E extends HTMLElement = HTMLElement>({
  input,
  meta,
}: FieldRenderProps<V, E>) {
  const error = typeof meta.error === 'string' ? meta.error : undefined;
  return {
    value: input.value,
    onChange: input.onChange,
    onBlur: input.onBlur,
    onFocus: input.onFocus,
    name: input.name,
    error,
    touched: Boolean(meta.touched),
  };
}
