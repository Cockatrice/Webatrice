import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, MessageSquareText, Send } from 'lucide-react';

import { server } from '@cockatrice/datatrice';
import type { ServerInfo_Report } from '@cockatrice/sockatrice/generated';
import { Avatar, Button } from '@app/components';
import { sectionLabelClass } from '@app/feature-wrappers/staff';
import { cx } from '@app/utils';

import { formatReportTime, parseChatLog } from '../reportFormat';

export interface ReportThreadProps {
  report: ServerInfo_Report;
  details: ServerInfo_Report | undefined;
  detailsFailed: boolean;
  reporterPrefix: string;
  commentsTitle: string;
  openPlaceholder: string;
  commentDraft: string;
  onCommentDraftChange: (value: string) => void;
  onSendComment: () => void;
  commentBusy: boolean;
  evidenceNote?: string;
  userContext?: ReactNode;
}

function ChatEvidence({ chatLog, placeholder, reportedUser, note }: {
  chatLog: string | null;
  placeholder: string;
  reportedUser: string;
  note?: string;
}) {
  const { t } = useTranslation();
  const lines = chatLog ? parseChatLog(chatLog) : [];
  let body: ReactNode;
  if (chatLog === null) {
    body = <span className="block px-3 py-3 text-[12px] text-text-muted">{placeholder}</span>;
  } else if (lines.length === 0) {
    body = <span className="block px-3 py-3 text-[12px] text-text-muted">{t('Reports.thread.noChatLog')}</span>;
  } else {
    body = (
      <ol className="flex flex-col gap-0.5 px-3 py-2 font-mono text-[11.5px] leading-relaxed">
        {lines.map((line, index) => {
          const theirs = line.from !== '' && line.from.toLowerCase() === reportedUser.toLowerCase();
          return (
            <li key={index} className={cx('-mx-1.5 flex gap-2 rounded-ui-sm px-1.5', theirs && 'bg-danger/10')}>
              {line.time && <span className="shrink-0 tabular-nums text-text-muted">{line.time}</span>}
              {line.from && (
                <span className={cx('shrink-0 font-semibold', theirs ? 'text-danger' : 'text-text-secondary')}>{line.from}:</span>
              )}
              <span className="min-w-0 break-words text-text-primary">{line.text}</span>
            </li>
          );
        })}
      </ol>
    );
  }

  return (
    <section
      aria-label={t('Reports.thread.chatGroup')}
      className="flex flex-col overflow-hidden rounded-ui border border-border-subtle bg-bg-sunken"
    >
      {note && (
        <div
          className={cx(
            'flex items-start gap-2 border-b border-border-subtle bg-warning/10 px-3 py-2',
            'text-[12px] leading-snug text-text-secondary',
          )}
        >
          <AlertTriangle size={14} className="mt-[1px] shrink-0 text-warning" aria-hidden />
          <span>{note}</span>
        </div>
      )}
      <div className="max-h-64 overflow-y-auto" data-testid="report-chat-log">{body}</div>
    </section>
  );
}

export default function ReportThread({
  report,
  details,
  detailsFailed,
  reporterPrefix,
  commentsTitle,
  openPlaceholder,
  commentDraft,
  onCommentDraftChange,
  onSendComment,
  commentBusy,
  evidenceNote,
  userContext,
}: ReportThreadProps) {
  const { t } = useTranslation();
  const canComment = server.isReportOpen(report.status);
  const loaded = details && !detailsFailed;
  const placeholder = detailsFailed ? t('Reports.thread.detailsFailed') : t('Reports.loading');

  const send = (e: React.FormEvent) => {
    e.preventDefault();
    if (canComment && !commentBusy && commentDraft.trim()) {
      onSendComment();
    }
  };

  return (
    <>
      <div className="flex flex-col gap-1.5">
        <p className="whitespace-pre-wrap break-words text-[13px] leading-snug text-text-primary" data-testid="report-description">
          {report.description || <span className="text-text-muted">{t('Reports.thread.noDescription')}</span>}
        </p>
        {report.resolutionNote && (
          <p className="rounded-ui-sm bg-bg-base/60 px-2 py-1.5 text-[12px] text-text-secondary" data-testid="report-resolution">
            <span className="font-semibold text-text-muted">{t('Reports.thread.resolution')}</span> {report.resolutionNote}
          </p>
        )}
      </div>

      <ChatEvidence
        chatLog={loaded ? details.chatLog : null}
        placeholder={placeholder}
        reportedUser={report.reportedUserName}
        note={evidenceNote}
      />

      {userContext}

      <section className="flex flex-col gap-2" aria-label={commentsTitle}>
        <h3 className={sectionLabelClass}>{commentsTitle}</h3>
        <div data-testid="report-thread">
          {!loaded ? (
            <span className="text-[12px] text-text-muted">{placeholder}</span>
          ) : details.comments.length === 0 ? (
            <span className="text-[12px] text-text-muted">{t('Reports.thread.noComments')}</span>
          ) : (
            <ol className="flex flex-col gap-2">
              {details.comments.map((c, i) => (
                <li key={i} className="flex gap-2.5" data-testid="report-comment">
                  <Avatar name={c.authorName} size={26} />
                  <div className="flex min-w-0 flex-1 flex-col rounded-ui border border-border-subtle bg-bg-base/60 px-3 py-2">
                    <span className="flex flex-wrap items-center gap-2 text-[12px]">
                      <span className="font-semibold text-text-primary">{c.authorName}</span>
                      <span
                        className={cx(
                          'rounded-full px-1.5 text-[10px] font-semibold uppercase tracking-[0.06em]',
                          c.isModerator ? 'bg-info/15 text-info' : 'bg-bg-elevated text-text-secondary',
                        )}
                      >
                        {c.isModerator ? t('Reports.thread.moderatorPrefix') : reporterPrefix}
                      </span>
                      <span className="ml-auto tabular-nums text-text-muted">{formatReportTime(c.commentTime)}</span>
                    </span>
                    <span className="whitespace-pre-wrap break-words text-[13px] leading-snug text-text-primary">{c.commentText}</span>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
        <form className="flex items-center gap-2" onSubmit={send}>
          <label className={cx(
            'flex h-9 min-w-0 flex-1 items-center gap-2 rounded-ui border border-border-control bg-bg-sunken px-2.5',
            'text-text-muted focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/25',
            !canComment && 'opacity-60',
          )}
          >
            <MessageSquareText size={14} aria-hidden />
            <input
              aria-label={t('Reports.thread.addComment')}
              className={cx(
                'h-full min-w-0 flex-1 bg-transparent text-[13px] text-text-primary placeholder:text-text-muted',
                'focus:outline-none disabled:cursor-not-allowed',
              )}
              placeholder={canComment ? openPlaceholder : t('Reports.thread.closedPlaceholder')}
              value={canComment ? commentDraft : ''}
              disabled={!canComment}
              onChange={(e) => onCommentDraftChange(e.target.value)}
            />
          </label>
          <Button type="submit" icon={<Send size={13} aria-hidden />} disabled={!canComment || commentBusy || !commentDraft.trim()}>
            {t('Reports.thread.send')}
          </Button>
        </form>
      </section>
    </>
  );
}
