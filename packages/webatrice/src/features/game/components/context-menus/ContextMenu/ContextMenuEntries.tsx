import { MenuCheckboxItem, MenuItem, MenuSeparator, MenuSubmenu } from '@app/components';
import { usePreference } from '@app/hooks';

import type { ContextMenuItem } from './ContextMenu';

const dividerKey = (index: number) => `divider-${index}`;
const itemKey = (index: number) => `item-${index}`;

function Swatch({ color }: { color: string }) {
  return <span className="inline-block w-2.5 h-2.5 rounded-full shrink-0" style={{ background: color }} aria-hidden />;
}

export default function ContextMenuEntries({ items }: { items: readonly ContextMenuItem[] }) {
  const showShortcuts = usePreference('showShortcutsInMenus');
  return (
    <>
      {items.map((item, i) => {
        if ('divider' in item) {
          return <MenuSeparator key={dividerKey(i)} />;
        }
        const key = itemKey(i);
        if (item.submenu && item.submenu.length > 0) {
          return (
            <MenuSubmenu key={key} label={item.label} disabled={item.disabled}>
              <ContextMenuEntries items={item.submenu} />
            </MenuSubmenu>
          );
        }
        const disabled = item.disabled || !item.onClick;
        const shortcut = showShortcuts ? item.shortcut : undefined;
        const icon = item.swatch !== undefined ? <Swatch color={item.swatch} /> : undefined;
        if (item.checked !== undefined) {
          return (
            <MenuCheckboxItem
              key={key}
              checked={item.checked}
              onChange={() => item.onClick?.()}
              closeOnSelect
              disabled={disabled}
              shortcut={shortcut}
              keyShortcuts={item.keyShortcuts}
              icon={icon}
            >
              {item.label}
            </MenuCheckboxItem>
          );
        }
        return (
          <MenuItem
            key={key}
            onSelect={() => item.onClick?.()}
            disabled={disabled}
            shortcut={shortcut}
            keyShortcuts={item.keyShortcuts}
            icon={icon}
          >
            {item.label}
          </MenuItem>
        );
      })}
    </>
  );
}
