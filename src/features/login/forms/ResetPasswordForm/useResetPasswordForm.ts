import { useState } from 'react';

import { useReduxEffect } from '@app/hooks';
import { server } from 'datatrice';

export interface ResetPasswordForm {
  errorMessage: boolean;
}

export function useResetPasswordForm(): ResetPasswordForm {
  const [errorMessage, setErrorMessage] = useState(false);

  useReduxEffect(() => {
    setErrorMessage(true);
  }, server.Types.RESET_PASSWORD_FAILED, []);

  return { errorMessage };
}
