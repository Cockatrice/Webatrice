import { useCallback, useEffect, useRef, useState } from 'react';

import { server } from '@cockatrice/datatrice';
import { useWebClient } from '@cockatrice/datatrice/react';
import type { ServerInfo_Report } from '@cockatrice/sockatrice/generated';
import type { RequestId, WebsocketTypes } from '@cockatrice/sockatrice/types';
import { useReduxEffect, useRequestTracker, type ReduxEffectAction } from '@app/hooks';
import { useAppSelector } from '@app/store';

export interface ReportThread {
  details: ServerInfo_Report | undefined;
  detailsFailed: boolean;
  reloadDetails: () => void;
  commentDraft: string;
  setCommentDraft: (value: string) => void;
  sendComment: () => void;
  commentBusy: boolean;
  commentFailed: boolean;
}

export function useReportThread(selectedId: number | null, onCommentAdded: () => void): ReportThread {
  const webClient = useWebClient();
  const details = useAppSelector((state) =>
    (selectedId != null ? server.Selectors.getReportDetails(state, selectedId) : undefined));
  const [failedId, setFailedId] = useState<number | null>(null);
  const [commentDraft, setCommentDraft] = useState('');
  const [commentBusy, setCommentBusy] = useState(false);
  const [commentFailed, setCommentFailed] = useState(false);

  const detailsRequest = useRequestTracker();
  const commentRequest = useRequestTracker();

  const reloadDetails = useCallback(() => {
    detailsRequest.cancel();
    commentRequest.cancel();
    setCommentBusy(false);
    setCommentFailed(false);
    setFailedId(null);
    if (selectedId != null) {
      webClient.request.session.reportDetails(selectedId, detailsRequest.begin());
    }
  }, [selectedId, webClient, detailsRequest, commentRequest]);

  useReduxEffect((action: ReduxEffectAction<{ requestId?: RequestId }>) => {
    if (detailsRequest.isCurrent(action.payload.requestId)) {
      detailsRequest.cancel();
    }
  }, server.Actions.reportDetails.type, [detailsRequest]);

  useReduxEffect((action: ReduxEffectAction<{
    command: WebsocketTypes.SessionCommandName; target: string; requestId?: RequestId;
  }>) => {
    if (action.payload.command === 'reportDetails' && action.payload.target === String(selectedId)
      && detailsRequest.isCurrent(action.payload.requestId)) {
      detailsRequest.cancel();
      setFailedId(Number(action.payload.target));
    }
  }, server.Types.SESSION_COMMAND_FAILED, [selectedId, detailsRequest]);

  useEffect(() => {
    reloadDetails();
    return () => {
      detailsRequest.cancel();
      commentRequest.cancel();
    };
  }, [reloadDetails, detailsRequest, commentRequest]);

  const onAddedRef = useRef(onCommentAdded);
  useEffect(() => {
    onAddedRef.current = onCommentAdded;
  }, [onCommentAdded]);

  const sendComment = useCallback(() => {
    const text = commentDraft.trim();
    if (selectedId == null || !text) {
      return;
    }
    const requestId = commentRequest.begin();
    setCommentBusy(true);
    setCommentFailed(false);
    webClient.request.session.reportAddComment(
      selectedId,
      text,
      () => {
        if (commentRequest.isCurrent(requestId)) {
          commentRequest.cancel();
          setCommentBusy(false);
          setCommentDraft('');
          onAddedRef.current();
        }
      },
      () => {
        if (commentRequest.isCurrent(requestId)) {
          commentRequest.cancel();
          setCommentBusy(false);
          setCommentFailed(true);
        }
      },
    );
  }, [commentDraft, selectedId, webClient, commentRequest]);

  return {
    details,
    detailsFailed: failedId != null && failedId === selectedId,
    reloadDetails,
    commentDraft,
    setCommentDraft,
    sendComment,
    commentBusy,
    commentFailed,
  };
}
