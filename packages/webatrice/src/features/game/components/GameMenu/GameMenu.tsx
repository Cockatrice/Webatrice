import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Menu as MenuIcon } from 'lucide-react';
import { Menu, MenuItem, MenuSeparator, type MenuAnchor } from '@app/components';
import { useMenuShortcut } from '@app/feature-widgets/shortcuts';

import { useGameId } from '../ui/GameIdContext';
import { useGameMenu } from './useGameMenu';

interface GameMenuProps {
  className: string;
}

export default function GameMenu({ className }: GameMenuProps) {
  const { t } = useTranslation();
  const gameId = useGameId();
  const entries = useGameMenu(gameId);
  const menuShortcut = useMenuShortcut();
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const [anchor, setAnchor] = useState<MenuAnchor | null>(null);
  const close = () => setAnchor(null);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={(e) => setAnchor(anchor ? null : { rect: e.currentTarget.getBoundingClientRect(), placement: 'below' })}
        disabled={gameId == null}
        title={t('GameMenu.title')}
        aria-haspopup="menu"
        aria-expanded={anchor != null}
        className={className}
      >
        <MenuIcon size={12} /> {t('GameMenu.button')}
      </button>
      {anchor && (
        <Menu anchor={anchor} label={t('GameMenu.button')} onClose={close} triggerRef={buttonRef} className="min-w-[240px]">
          {entries.map((entry) =>
            entry.kind === 'divider' ? (
              <MenuSeparator key={entry.id} />
            ) : (
              <MenuItem
                key={entry.id}
                disabled={entry.disabled}
                onSelect={entry.onClick}
                {...menuShortcut(entry.shortcut)}
              >
                {t(`GameMenu.item.${entry.id}`)}
              </MenuItem>
            ),
          )}
        </Menu>
      )}
    </>
  );
}
