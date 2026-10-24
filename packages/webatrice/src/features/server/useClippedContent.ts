import { useCallback, useEffect, useState } from 'react';

export const NEWS_MIN_VISIBLE = 140;

export interface ClipState {
  clipped: boolean;
  frameMinHeight: number;
}

export interface ClipHeights {
  content: number;
  viewport: number;
  frame: number;
}

export function clipState({ content, viewport, frame }: ClipHeights, minVisible: number): ClipState {
  return {
    clipped: content > viewport + 1,
    frameMinHeight: Math.max(0, frame - viewport) + Math.min(content, minVisible),
  };
}

export interface ClippedContent {
  frameRef: (node: HTMLElement | null) => void;
  viewportRef: (node: HTMLElement | null) => void;
  contentRef: (node: HTMLElement | null) => void;
  clipped: boolean;
  expanded: boolean;
  frameMinHeight: number | undefined;
  toggle: () => void;
}

export function useClippedContent(resetKey: unknown, minVisible = NEWS_MIN_VISIBLE): ClippedContent {
  const [frame, setFrame] = useState<HTMLElement | null>(null);
  const [viewport, setViewport] = useState<HTMLElement | null>(null);
  const [content, setContent] = useState<HTMLElement | null>(null);
  const [state, setState] = useState<ClipState>({ clipped: false, frameMinHeight: 0 });
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    setExpanded(false);
  }, [resetKey]);

  useEffect(() => {
    if (!frame || !viewport || !content) {
      return undefined;
    }
    const measure = () => {
      const next = clipState(
        { content: content.scrollHeight, viewport: viewport.clientHeight, frame: frame.offsetHeight },
        minVisible,
      );
      setState((prev) => (prev.clipped === next.clipped && prev.frameMinHeight === next.frameMinHeight ? prev : next));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(viewport);
    observer.observe(content);
    return () => observer.disconnect();
  }, [frame, viewport, content, minVisible, resetKey]);

  const toggle = useCallback(() => setExpanded((open) => !open), []);

  return {
    frameRef: setFrame,
    viewportRef: setViewport,
    contentRef: setContent,
    clipped: state.clipped,
    expanded,
    frameMinHeight: expanded ? undefined : state.frameMinHeight,
    toggle,
  };
}
