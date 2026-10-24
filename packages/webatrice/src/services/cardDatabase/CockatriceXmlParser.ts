import { AllowedCount, Card, CardSourceRecords, Format, FormatException, Info, Set, Token, XmlNode } from '../dexie/types';
export interface ParsedCockatriceXml {
  info?: Info;
  formats?: Format[];
  sets?: Set[];
  cards?: Card[];
  tokens?: Token[];
}

class CockatriceXmlParser {
  private parsedSources = new WeakMap<CardSourceRecords, string>();

  parseSource(text: string, preview?: CardSourceRecords): CardSourceRecords {
    if (preview && this.parsedSources.get(preview) === text) {
      return preview;
    }
    const parsed = this.parse(text);
    const records: CardSourceRecords = {
      cards: parsed.cards ?? [], sets: parsed.sets ?? [], tokens: parsed.tokens ?? [], formats: parsed.formats ?? [], info: parsed.info,
    };
    this.parsedSources.set(records, text);
    return records;
  }

  parse(text: string): ParsedCockatriceXml {
    const dom = new DOMParser().parseFromString(text, 'application/xml');

    if (dom.querySelector('parsererror')) {
      throw new Error('Cockatrice XML is malformed');
    }

    const root = dom.documentElement;
    if (!root) {
      throw new Error('Cockatrice XML has no root element');
    }
    const isLegacyTokenRoot = root.tagName === 'cockatrice_tokens';
    if (!isLegacyTokenRoot && root.tagName !== 'cockatrice_carddatabase') {
      throw new Error('Cockatrice XML has an unsupported root element');
    }
    const isV3 = !isLegacyTokenRoot && root.getAttribute('version') === '3';
    if (!isLegacyTokenRoot && !isV3 && root.getAttribute('version') !== '4') {
      throw new Error('Cockatrice XML has an unsupported version');
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
      const sets = this.directChildren(setsEl, 'set').map(el => {
        const set = this.parseElement(el) as unknown as Set;
        this.requireName(set);
        return set;
      });
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
      const cards: Card[] = [];
      const tokens: Token[] = [];
      const tokenByName = new Map<string, boolean>();

      cardElements.forEach(el => {
        const parsed = (isV3 ? this.parseV3Card(el) : this.parseElement(el)) as unknown as Card;
        if (this.hasNoName(parsed)) {
          return;
        }
        this.requireName(parsed);
        const printings = Array.isArray(parsed.set) ? parsed.set : parsed.set ? [parsed.set] : [];
        if (printings.some(printing => typeof printing.value !== 'string' || !printing.value.trim())) {
          throw new Error('Cockatrice XML contains an invalid printing');
        }
        const isToken = tokenByName.get(parsed.name.value) ?? (isLegacyTokenRoot || parsed.token?.value === '1');
        tokenByName.set(parsed.name.value, isToken);
        if (isToken) {
          tokens.push(parsed as unknown as Token);
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

  private requireName(record: { name?: XmlNode<string> }): void {
    if (typeof record.name?.value !== 'string' || !record.name.value.trim()) {
      throw new Error('Cockatrice XML contains a record without a valid name');
    }
  }

  private hasNoName(record: { name?: XmlNode<string> }): boolean {
    return record.name === undefined || (typeof record.name.value === 'string' && !record.name.value.trim());
  }

  private parseV3Card(el: Element): Record<string, unknown> {
    const card = this.parseElement(el);
    const properties: Record<string, unknown> = {};
    for (const field of ['manacost', 'cmc', 'type', 'pt', 'loyalty']) {
      if (card[field] !== undefined) {
        properties[field] = card[field];
        delete card[field];
      }
    }
    const type = this.directChild(el, 'type')?.textContent;
    if (type != null) {
      properties.maintype = { value: type.split(/-|—|\/\//)[0].trim().split(/\s+/).at(-1) ?? '' };
    }
    properties.colors = {
      value: Array.from(el.children)
        .filter(child => child.tagName === 'color' || child.tagName === 'colors')
        .map(child => child.textContent ?? '').join(''),
    };
    delete card.color;
    delete card.colors;
    card.prop = { value: properties };

    const normalizePrinting = (printing: Record<string, unknown>) => Object.fromEntries(
      Object.entries(printing).map(([key, value]) => [key === 'value' ? key : key.toLowerCase(), value]),
    );
    if (Array.isArray(card.set)) {
      card.set = card.set.map(normalizePrinting);
    } else if (card.set) {
      card.set = normalizePrinting(card.set as Record<string, unknown>);
    }
    return card;
  }

  // @critical Output shape (leaf = `{ value, ...attrs }`, siblings collapse to arrays) is load-bearing — Dexie indexes `name.value`.
  parseElement(dom: Element): Record<string, unknown> {
    return Array.from(dom.children).reduce<Record<string, unknown>>((attributes, child) => {
      const value = child.children.length ? this.parseElement(child) : child.textContent ?? '';

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

  private parseInfo(infoEl: Element): Info {
    const flat = this.parseElement(infoEl) as Record<string, XmlNode<string> | undefined>;
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

  private parseFormat(formatEl: Element): Format {
    const formatName = formatEl.getAttribute('formatName') ?? '';
    if (!formatName.trim()) {
      throw new Error('Cockatrice XML contains a format without a valid name');
    }
    const fields = this.parseElement(formatEl) as Record<string, unknown>;

    const minDeckSize = this.toInt(fields.minDeckSize);
    const maxDeckSize = this.toInt(fields.maxDeckSize);
    const maxSideboardSize = this.toInt(fields.maxSideboardSize);
    const allowedCounts = this.toAllowedCounts(fields.allowedCounts);
    const exceptions = this.parseExceptions(formatEl);

    return {
      formatName,
      ...(minDeckSize !== undefined && { minDeckSize }),
      ...(maxDeckSize !== undefined && { maxDeckSize }),
      ...(maxSideboardSize !== undefined && { maxSideboardSize }),
      ...(allowedCounts && { allowedCounts }),
      ...(exceptions.length > 0 && { exceptions }),
    };
  }

  private parseExceptions(formatEl: Element): FormatException[] {
    const container = this.directChild(formatEl, 'exceptions');
    if (!container) {
      return [];
    }
    return this.directChildren(container, 'exception').map(ex => ({
      maxCopies: this.directChild(ex, 'maxCopies')?.textContent?.trim() || 'unlimited',
      conditions: this.directChildren(ex, 'cardCondition').map(cond => ({
        field: cond.getAttribute('field') ?? '',
        match: cond.getAttribute('match') ?? '',
        value: cond.getAttribute('value') ?? '',
      })),
    }));
  }

  private toInt(node: unknown): number | undefined {
    const raw = (node as XmlNode<string> | undefined)?.value;
    if (raw === undefined || raw === '') {
      return undefined;
    }
    const n = parseInt(raw, 10);
    return Number.isNaN(n) ? undefined : n;
  }

  private toAllowedCounts(node: unknown): AllowedCount[] | undefined {
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
