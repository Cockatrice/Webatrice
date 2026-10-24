import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { usePreferences } from '@app/hooks';
import { shortcuts, useAppSelector } from '@app/store';

import type { SettingsSection } from './registry';
import { groupDomId, isModalOpen, isTypingTarget, sectionAt, sectionDomId } from './scrollSpy';
import { searchSettings } from './searchSettings';

const FLASH_MS = 1600;

function offsetWithin(scroller: HTMLElement, element: HTMLElement): number {
  return element.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop;
}

export function useSettingsPage(sections: readonly SettingsSection[]) {
  const { t } = useTranslation();
  const preferences = usePreferences();
  const overrides = useAppSelector(shortcuts.Selectors.getOverrides);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState<string>(sections[0]?.id ?? '');
  const [flash, setFlash] = useState<string | null>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const flashTimer = useRef<number | undefined>(undefined);

  const searching = query.trim() !== '';
  const result = useMemo(
    () => searchSettings(sections, query, t, { preferences, overrides }),
    [sections, query, t, preferences, overrides],
  );

  const onScroll = useCallback(() => {
    const scroller = scrollerRef.current;
    if (!scroller) {
      return;
    }
    const tops = sections.flatMap(({ id }) => {
      const element = document.getElementById(sectionDomId(id));
      return element ? [{ id, top: offsetWithin(scroller, element) }] : [];
    });
    const next = sectionAt(tops, scroller);
    if (next) {
      setActive(next);
    }
  }, [sections]);

  const jump = useCallback((sectionId: string, groupId?: string) => {
    const scroller = scrollerRef.current;
    const section = document.getElementById(sectionDomId(sectionId));
    if (!scroller || !section) {
      return;
    }
    const group = groupId ? document.getElementById(groupDomId(groupId)) : null;
    const header = section.querySelector<HTMLElement>('[data-section-header]');
    const top = group ? offsetWithin(scroller, group) - (header?.offsetHeight ?? 0) - 12 : offsetWithin(scroller, section);
    scroller.scrollTop = Math.max(0, top);
    (group ?? section).querySelector<HTMLElement>('h2, h3')?.focus({ preventScroll: true });
    setActive(sectionId);
    setFlash(groupId ?? sectionId);
    window.clearTimeout(flashTimer.current);
    flashTimer.current = window.setTimeout(() => setFlash(null), FLASH_MS);
  }, []);

  useEffect(() => () => window.clearTimeout(flashTimer.current), []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== '/' || event.ctrlKey || event.metaKey || event.altKey || event.defaultPrevented) {
        return;
      }
      if (isTypingTarget(event.target) || isModalOpen()) {
        return;
      }
      event.preventDefault();
      searchRef.current?.focus();
      searchRef.current?.select();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    if (scrollerRef.current) {
      scrollerRef.current.scrollTop = 0;
    }
    if (!query.trim()) {
      onScroll();
    }
  }, [query, onScroll]);

  return { query, setQuery, searching, result, active, flash, jump, onScroll, scrollerRef, searchRef };
}
