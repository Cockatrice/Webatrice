import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, FileText, FolderOpen } from 'lucide-react';

import { Button, Menu, MenuItem, type MenuRect } from '@app/components';

export function ImportMenuButton({ onMigrate, onImport, isConnected, className }: {
  onMigrate: () => void;
  onImport: () => void;
  isConnected: boolean;
  className?: string;
}) {
  const { t } = useTranslation();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [rect, setRect] = useState<MenuRect | null>(null);
  return (
    <>
      <Button
        ref={triggerRef}
        className={className}
        iconRight={<ChevronDown size={13} aria-hidden />}
        aria-haspopup="menu"
        aria-expanded={rect != null}
        onClick={(e) => {
          if (rect) {
            setRect(null);
            return;
          }
          const box = e.currentTarget.getBoundingClientRect();
          setRect({ left: box.left, top: box.top, right: box.right, bottom: box.bottom });
        }}
      >
        {t('ImportMenu.import')}
      </Button>
      {rect && (
        <Menu
          anchor={{ rect, placement: 'below', align: 'start' }}
          label={t('ImportMenu.label')}
          triggerRef={triggerRef}
          onClose={() => setRect(null)}
          className="w-72"
        >
          <MenuItem icon={<FolderOpen size={14} />} onSelect={onMigrate}>{t('ImportMenu.fromCockatrice')}</MenuItem>
          <MenuItem
            icon={<FileText size={14} />}
            onSelect={onImport}
            disabled={!isConnected}
            disabledReason={isConnected ? undefined : t('ImportMenu.disconnected')}
          >
            {t('ImportMenu.pasteOrOpen')}
          </MenuItem>
        </Menu>
      )}
    </>
  );
}
