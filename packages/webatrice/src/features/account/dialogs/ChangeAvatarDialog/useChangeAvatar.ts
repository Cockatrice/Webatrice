import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { usePushToast } from '@app/components';
import { useCommandFailureMessage, useRequestTracker } from '@app/hooks';
import { useWebClient } from '@cockatrice/datatrice/react';

import { changeAvatarErrorMessage } from '../accountResponseMessages';
import { encodeAvatar, loadImage } from './encodeAvatar';

export interface AvatarPreview {
  url: string;
  image: HTMLImageElement;
}

export interface ChangeAvatar {
  preview: AvatarPreview | null;
  pending: boolean;
  decoding: boolean;
  error: string | null;
  pick: (file: File | null) => Promise<boolean | undefined>;
  submit: () => Promise<void>;
}

export function useChangeAvatar(onDone: () => void): ChangeAvatar {
  const { t } = useTranslation();
  const webClient = useWebClient();
  const pushToast = usePushToast();
  const failureMessage = useCommandFailureMessage();
  const request = useRequestTracker();
  const [preview, setPreview] = useState<AvatarPreview | null>(null);
  const [pending, setPending] = useState(false);
  const [decoding, setDecoding] = useState(false);
  const selection = useRef(0);
  const readable = useRef(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => () => {
    if (preview) {
      URL.revokeObjectURL(preview.url);
    }
  }, [preview]);

  useEffect(() => () => {
    selection.current += 1;
  }, []);

  const pick = async (file: File | null) => {
    if (pending) {
      return undefined;
    }
    const version = ++selection.current;
    readable.current = !file;
    setPreview(null);
    setDecoding(!!file);
    if (!file) {
      return true;
    }
    const url = URL.createObjectURL(file);
    try {
      const image = await loadImage(url);
      if (version !== selection.current) {
        URL.revokeObjectURL(url);
        return undefined;
      }
      readable.current = true;
      setPreview({ url, image });
      return true;
    } catch {
      URL.revokeObjectURL(url);
      if (version !== selection.current) {
        return undefined;
      }
      return false;
    } finally {
      if (version === selection.current) {
        setDecoding(false);
      }
    }
  };

  const submit = async () => {
    if (pending || decoding || !readable.current) {
      return;
    }
    const requestId = request.begin();
    setPending(true);
    setError(null);
    let image: Uint8Array;
    try {
      image = preview ? await encodeAvatar(preview.image) : new Uint8Array();
    } catch {
      if (!request.isCurrent(requestId)) {
        return;
      }
      request.cancel();
      setPending(false);
      setError(t('AccountDialogs.error.avatarFailed'));
      return;
    }
    if (!request.isCurrent(requestId)) {
      return;
    }
    webClient.request.session.accountImage(
      image,
      () => {
        if (!request.isCurrent(requestId)) {
          return;
        }
        request.cancel();
        setPending(false);
        pushToast(t('ChangeAvatarDialog.success'));
        onDone();
      },
      (responseCode, failure) => {
        if (!request.isCurrent(requestId)) {
          return;
        }
        request.cancel();
        setPending(false);
        setError(failureMessage(failure, changeAvatarErrorMessage(t, responseCode)));
      },
    );
  };

  return { preview, pending, decoding, error, pick, submit };
}
