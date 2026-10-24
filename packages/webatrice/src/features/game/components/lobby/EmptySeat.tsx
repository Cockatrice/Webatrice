import { useTranslation } from 'react-i18next';

export default function EmptySeat() {
  const { t } = useTranslation();
  return (
    <div
      className="flex items-center gap-4 px-4 py-3 rounded-lg border border-dashed border-border-subtle bg-bg-surface/30"
    >
      <div className="h-11 w-11 rounded-full border-2 border-dashed border-border-subtle" />
      <span className="text-sm italic text-text-muted">{t('GameLobby.player.waiting')}</span>
    </div>
  );
}
