import { ChevronDown, ChevronUp, Megaphone } from 'lucide-react';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';

import { Button, Panel } from '@app/components';
import { cx } from '@app/utils';

import { useClippedContent } from '../useClippedContent';

const MESSAGE_CLASS = [
  'text-[13px] leading-relaxed text-text-secondary',
  'ui-links',
  '[&_p]:my-1 [&_b]:text-text-primary [&_strong]:text-text-primary',
].join(' ');

export default function ServerAnnouncement({ message }: { message: string | null }) {
  const { t } = useTranslation();
  const id = useId();
  const clip = useClippedContent(message);
  const faded = clip.clipped && !clip.expanded;

  return (
    <div
      ref={clip.frameRef}
      className={cx('flex min-h-0 flex-col', clip.expanded && 'shrink-0')}
      style={clip.frameMinHeight !== undefined ? { minHeight: clip.frameMinHeight } : undefined}
    >
      <Panel
        eyebrow
        className="flex-1"
        bodyClassName="flex flex-col"
        title={(
          <span className="inline-flex items-center gap-2">
            <Megaphone size={14} className="text-text-muted" aria-hidden /> {t('ServerAnnouncement.title')}
          </span>
        )}
      >
        {message ? (
          <>
            <div
              ref={clip.viewportRef}
              className={cx('relative min-h-0 flex-1 overflow-hidden', !clip.expanded && 'max-h-[560px]')}
            >
              <div id={id} ref={clip.contentRef} className={MESSAGE_CLASS} dangerouslySetInnerHTML={{ __html: message }} />
              {faded && (
                <span aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-bg-surface" />
              )}
            </div>
            {(clip.clipped || clip.expanded) && (
              <Button
                size="sm"
                variant="ghost"
                className="mt-2 shrink-0 self-start"
                aria-expanded={clip.expanded}
                aria-controls={id}
                iconRight={clip.expanded ? <ChevronUp size={14} aria-hidden /> : <ChevronDown size={14} aria-hidden />}
                onClick={clip.toggle}
              >
                {clip.expanded ? t('ServerAnnouncement.showLess') : t('ServerAnnouncement.showMore')}
              </Button>
            )}
          </>
        ) : (
          <p className="text-[13px] text-text-muted">{t('ServerAnnouncement.empty')}</p>
        )}
      </Panel>
    </div>
  );
}
