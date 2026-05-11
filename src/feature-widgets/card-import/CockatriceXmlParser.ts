import { App } from '@app/types';

export interface ParsedCockatriceXml {
  info?: App.Info;
  formats?: App.Format[];
  sets?: App.Set[];
  cards?: App.Card[];
  tokens?: App.Token[];
}

class CockatriceXmlParser {
  parse(text: string): ParsedCockatriceXml {
    const dom = new DOMParser().parseFromString(text, 'application/xml');

    if (dom.querySelector('parsererror')) {
      throw new Error('Cockatrice XML is malformed');
    }

    const root = dom.documentElement;
    if (!root) {
      throw new Error('Cockatrice XML has no root element');
    }

    const result: ParsedCockatriceXml = {};

    const infoEl = this.directChild(root, 'info');
    if (infoEl) {
      result.info = this.parseInfo(infoEl);
    }

    const formatsEl = this.directChild(root, 'formats');
    if (formatsEl) {
      const formats = this.directChildren(formatsEl, 'format').map(el => this.parseFormat(el));
      if (formats.length) {
        result.formats = formats;
      }
    }

    const setsEl = this.directChild(root, 'sets');
    if (setsEl) {
      const sets = this.directChildren(setsEl, 'set').map(el => this.parseElement(el) as unknown as App.Set);
      if (sets.length) {
        result.sets = sets;
      }
    }

    const cardElements: Element[] = [];
    const cardsEl = this.directChild(root, 'cards');
    if (cardsEl) {
      cardElements.push(...this.directChildren(cardsEl, 'card'));
    }
    cardElements.push(...this.directChildren(root, 'card'));

    if (cardElements.length) {
      const isLegacyTokenRoot = root.tagName === 'cockatrice_tokens';
      const cards: App.Card[] = [];
      const tokens: App.Token[] = [];

      cardElements.forEach(el => {
        const parsed = this.parseElement(el) as unknown as App.Card & { token?: App.XmlNode<string> };
        const isToken = isLegacyTokenRoot || parsed.token?.value === '1';
        if (isToken) {
          tokens.push(parsed as unknown as App.Token);
        } else {
          cards.push(parsed);
        }
      });

      if (cards.length) {
        result.cards = cards;
      }
      if (tokens.length) {
        result.tokens = tokens;
      }
    }

    return result;
  }

  // @critical Output shape (leaf = `{ value, ...attrs }`, siblings collapse to arrays) is load-bearing — Dexie indexes `name.value`.
  parseElement(dom: Element): Record<string, unknown> {
    return Array.from(dom.children).reduce<Record<string, unknown>>((attributes, child) => {
      const value = child.children.length ? this.parseElement(child) : child.innerHTML;

      let parsedAttributes: Record<string, unknown> = { value };

      if (child.attributes.length) {
        const childAttributes = Array.from(child.attributes).reduce<Record<string, string>>((acc, { name, value: attrValue }) => {
          acc[name] = attrValue;
          return acc;
        }, {});

        parsedAttributes = { ...parsedAttributes, ...childAttributes };
      }

      const existing = attributes[child.tagName];
      if (existing !== undefined) {
        if (Array.isArray(existing)) {
          existing.push(parsedAttributes);
        } else {
          attributes[child.tagName] = [existing, parsedAttributes];
        }
      } else {
        attributes[child.tagName] = parsedAttributes;
      }

      return attributes;
    }, {});
  }

  private parseInfo(infoEl: Element): App.Info {
    const flat = this.parseElement(infoEl) as Record<string, App.XmlNode<string> | undefined>;
    return {
      id: 'singleton',
      source: 'oracle-local-fs',
      author: flat.author?.value,
      createdAt: flat.createdAt?.value,
      sourceUrl: flat.sourceUrl?.value,
      sourceVersion: flat.sourceVersion?.value,
      importedAt: new Date().toISOString(),
    };
  }

  private parseFormat(formatEl: Element): App.Format {
    const formatName = formatEl.getAttribute('formatName') ?? '';
    const fields = this.parseElement(formatEl) as Record<string, unknown>;

    const minDeckSize = this.toInt(fields.minDeckSize);
    const maxDeckSize = this.toInt(fields.maxDeckSize);
    const maxSideboardSize = this.toInt(fields.maxSideboardSize);
    const allowedCounts = this.toAllowedCounts(fields.allowedCounts);

    return {
      formatName,
      ...(minDeckSize !== undefined && { minDeckSize }),
      ...(maxDeckSize !== undefined && { maxDeckSize }),
      ...(maxSideboardSize !== undefined && { maxSideboardSize }),
      ...(allowedCounts && { allowedCounts }),
    };
  }

  private toInt(node: unknown): number | undefined {
    const raw = (node as App.XmlNode<string> | undefined)?.value;
    if (raw === undefined || raw === '') {
      return undefined;
    }
    const n = parseInt(raw, 10);
    return Number.isNaN(n) ? undefined : n;
  }

  private toAllowedCounts(node: unknown): App.AllowedCount[] | undefined {
    const allowed = node as { value?: { count?: unknown } } | undefined;
    const countNode = allowed?.value?.count;
    if (!countNode) {
      return undefined;
    }
    const arr = Array.isArray(countNode) ? countNode : [countNode];
    return arr.map((c: Record<string, string>) => ({
      max: c.max ?? '',
      label: typeof c.value === 'string' ? c.value : '',
    }));
  }

  private directChild(parent: Element, tagName: string): Element | null {
    return Array.from(parent.children).find(c => c.tagName === tagName) ?? null;
  }

  private directChildren(parent: Element, tagName: string): Element[] {
    return Array.from(parent.children).filter(c => c.tagName === tagName);
  }
}

export const cockatriceXmlParser = new CockatriceXmlParser();
