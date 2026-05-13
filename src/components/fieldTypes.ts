import type { FieldRenderProps } from 'react-final-form';

// final-form 7.x dropped `meta.warning` from `FieldState`, but the runtime
// still surfaces warnings produced by async validators / Field-level
// `validate` returning warnings. Reintroduce the optional field at the
// Webatrice boundary so InputField + KnownHosts can render warnings
// without casting at every call site.
type WarningMeta = { warning?: string };

export type FinalFormFieldProps<T, E extends HTMLElement = HTMLElement> = Omit<FieldRenderProps<T, E>, 'meta'> & {
  meta: FieldRenderProps<T, E>['meta'] & WarningMeta;
};
