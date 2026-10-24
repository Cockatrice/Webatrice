import { createContext } from 'react';
import { server } from '@cockatrice/datatrice';
import { ServerInfo_User_UserLevelFlag } from '@cockatrice/sockatrice/generated';

import type { RootState } from '@app/store';

export interface AvatarStoreLike {
  getState(): RootState;
  subscribe(listener: () => void): () => void;
}

export interface AvatarServiceOptions {
  batchSize?: number;
  intervalMs?: number;
  rootMargin?: string;
}

export interface UserAvatarLookup {
  bmp: Uint8Array | undefined;
  known: boolean;
  unregistered: boolean;
}

interface CachedUrl {
  bmp: Uint8Array;
  url: string;
}

const DEFAULT_BATCH_SIZE = 6;
const DEFAULT_INTERVAL_MS = 250;
const DEFAULT_ROOT_MARGIN = '120px';
const RETIRE_DELAY_MS = 1000;

function hasBytes(bmp: Uint8Array | undefined | null): bmp is Uint8Array {
  return Boolean(bmp && bmp.byteLength > 0);
}

function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a === b) {
    return true;
  }
  if (a.byteLength !== b.byteLength) {
    return false;
  }
  for (let i = 0; i < a.byteLength; i += 1) {
    if (a[i] !== b[i]) {
      return false;
    }
  }
  return true;
}

export function lookupUserAvatar(state: RootState, name: string): UserAvatarLookup {
  const info = server.Selectors.getUserInfoByName(state, name);
  if (info) {
    return { bmp: hasBytes(info.avatarBmp) ? info.avatarBmp : undefined, known: true, unregistered: false };
  }
  const self = server.Selectors.getUser(state);
  if (self && self.name === name) {
    return { bmp: hasBytes(self.avatarBmp) ? self.avatarBmp : undefined, known: true, unregistered: false };
  }
  const online = server.Selectors.getUsers(state)[name];
  if (online && hasBytes(online.avatarBmp)) {
    return { bmp: online.avatarBmp, known: true, unregistered: false };
  }
  const unregistered = online !== undefined
    && ((online.userLevel ?? 0) & ServerInfo_User_UserLevelFlag.IsRegistered) === 0;
  return { bmp: undefined, known: false, unregistered };
}

export class UserAvatarService {
  private readonly urls = new Map<string, CachedUrl>();
  private readonly retiring = new Map<string, ReturnType<typeof setTimeout>>();
  private nextSendAt = 0;
  private readonly requested = new Set<string>();
  private queue: string[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;
  private observer: IntersectionObserver | null = null;
  private readonly observed = new Map<Element, string>();
  private readonly batchSize: number;
  private readonly intervalMs: number;
  private readonly rootMargin: string;

  constructor(
    private readonly store: AvatarStoreLike,
    private readonly request: (name: string) => void,
    options: AvatarServiceOptions = {},
  ) {
    this.batchSize = options.batchSize ?? DEFAULT_BATCH_SIZE;
    this.intervalMs = options.intervalMs ?? DEFAULT_INTERVAL_MS;
    this.rootMargin = options.rootMargin ?? DEFAULT_ROOT_MARGIN;
  }

  subscribe = (listener: () => void): (() => void) => this.store.subscribe(listener);

  getSrc(name: string): string | null {
    if (!name) {
      return null;
    }
    const { bmp } = lookupUserAvatar(this.store.getState(), name);
    if (!bmp) {
      this.forget(name);
      return null;
    }
    return this.urlFor(name, bmp);
  }

  want(name: string): void {
    if (!name || this.requested.has(name)) {
      return;
    }
    const { known, unregistered } = lookupUserAvatar(this.store.getState(), name);
    if (known || unregistered) {
      return;
    }
    this.requested.add(name);
    this.queue.push(name);
    this.schedule();
  }

  observe(element: Element, name: string): () => void {
    const observer = this.intersectionObserver();
    if (!observer) {
      this.want(name);
      return () => {};
    }
    this.observed.set(element, name);
    observer.observe(element);
    return () => {
      this.observed.delete(element);
      observer.unobserve(element);
    };
  }

  pendingCount(): number {
    return this.queue.length;
  }

  clear(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.queue = [];
    this.requested.clear();
    this.nextSendAt = 0;
    for (const entry of this.urls.values()) {
      URL.revokeObjectURL(entry.url);
    }
    this.urls.clear();
    for (const [url, timer] of this.retiring) {
      clearTimeout(timer);
      URL.revokeObjectURL(url);
    }
    this.retiring.clear();
  }

  private urlFor(name: string, bmp: Uint8Array): string {
    const current = this.urls.get(name);
    if (current && sameBytes(current.bmp, bmp)) {
      current.bmp = bmp;
      return current.url;
    }
    if (current) {
      this.retire(current.url);
    }
    const url = URL.createObjectURL(new Blob([bmp as BlobPart]));
    this.urls.set(name, { bmp, url });
    return url;
  }

  private forget(name: string): void {
    const current = this.urls.get(name);
    if (current) {
      this.urls.delete(name);
      this.retire(current.url);
    }
  }

  private retire(url: string): void {
    this.retiring.set(url, setTimeout(() => {
      this.retiring.delete(url);
      URL.revokeObjectURL(url);
    }, RETIRE_DELAY_MS));
  }

  private schedule(): void {
    if (this.timer !== null || this.queue.length === 0) {
      return;
    }
    this.timer = setTimeout(() => this.pump(), Math.max(0, this.nextSendAt - Date.now()));
  }

  private pump(): void {
    this.timer = null;
    const batch = this.queue.splice(0, this.batchSize);
    let sent = false;
    for (const name of batch) {
      if (!lookupUserAvatar(this.store.getState(), name).known) {
        this.request(name);
        sent = true;
      }
    }
    if (sent) {
      this.nextSendAt = Date.now() + this.intervalMs;
    }
    this.schedule();
  }

  private intersectionObserver(): IntersectionObserver | null {
    if (this.observer) {
      return this.observer;
    }
    if (typeof IntersectionObserver === 'undefined') {
      return null;
    }
    this.observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const name = this.observed.get(entry.target);
        if (entry.isIntersecting && name) {
          this.want(name);
        }
      }
    }, { rootMargin: this.rootMargin });
    return this.observer;
  }
}

export const UserAvatarContext = createContext<UserAvatarService | null>(null);
UserAvatarContext.displayName = 'UserAvatarContext';
