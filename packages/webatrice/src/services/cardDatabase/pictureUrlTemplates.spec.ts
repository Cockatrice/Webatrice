import {
  correctedCardName,
  DEFAULT_PICTURE_URL_TEMPLATES,
  expandPictureUrlTemplate,
  isValidPictureUrlTemplate,
  percentEncode,
  type PictureTemplateContext,
} from './pictureUrlTemplates';

const uuid = '0a1b2c3d-0000-0000-0000-000000000000';

const ctx = (overrides: Partial<PictureTemplateContext> = {}): PictureTemplateContext => ({
  name: 'Fire // Ice',
  props: { side: 'front' },
  set: { code: 'MH2', longName: 'Modern Horizons 2', printing: { uuid, muid: '522263', num: '290' } },
  lang: 'en',
  ...overrides,
});

describe('pictureUrlTemplates', () => {
  it('ships the desktop default template list', () => {
    expect(DEFAULT_PICTURE_URL_TEMPLATES).toHaveLength(5);
    expect(DEFAULT_PICTURE_URL_TEMPLATES[0]).toContain('cards.scryfall.io');
  });

  it('expands the Scryfall CDN template with substr placeholders', () => {
    expect(expandPictureUrlTemplate(DEFAULT_PICTURE_URL_TEMPLATES[0], ctx())).toBe(
      `https://cards.scryfall.io/large/front/0/a/${uuid}.jpg`,
    );
  });

  it('percent-encodes values like QUrl::toPercentEncoding', () => {
    expect(expandPictureUrlTemplate('https://x/?n=!name!', ctx())).toBe('https://x/?n=Fire%20%2F%2F%20Ice');
    expect(percentEncode('Ach! Hans, Run!')).toBe('Ach%21%20Hans%2C%20Run%21');
  });

  it('fills set name, code and lowercase variants', () => {
    expect(expandPictureUrlTemplate('https://x/!setcode_lower!/!setname!/!set:num!.jpg', ctx())).toBe(
      'https://x/mh2/Modern%20Horizons%202/290.jpg',
    );
  });

  it('left-pads with _fill_with_', () => {
    expect(expandPictureUrlTemplate('https://x/!set:num_fill_with_0000!.jpg', ctx())).toBe('https://x/0290.jpg');
    expect(expandPictureUrlTemplate('https://x/!set:num_fill_with_00!.jpg', ctx())).toBeNull();
  });

  it('returns null when a requested property is missing', () => {
    expect(expandPictureUrlTemplate(DEFAULT_PICTURE_URL_TEMPLATES[0], ctx({ props: {} }))).toBeNull();
    expect(expandPictureUrlTemplate('https://x/!set:multiverseid!', ctx())).toBeNull();
  });

  it('returns null when set placeholders are used without a printing', () => {
    expect(expandPictureUrlTemplate('https://x/!setcode!/!name!', ctx({ set: undefined }))).toBeNull();
    expect(expandPictureUrlTemplate(DEFAULT_PICTURE_URL_TEMPLATES[4], ctx({ set: undefined }))).toBe(
      'https://gatherer.wizards.com/Handlers/Image.ashx?name=Fire%20%2F%2F%20Ice&type=card',
    );
  });

  it('returns null when a substr is longer than the value', () => {
    expect(expandPictureUrlTemplate('https://x/!set:num_substr_2_5!', ctx())).toBeNull();
  });

  it('strips characters reserved in file paths for !corrected_name!', () => {
    expect(correctedCardName('Fire // Ice')).toBe('FireIce');
    expect(correctedCardName('Who/What/When')).toBe('Who What When');
    expect(correctedCardName('Question Elemental?')).toBe('Question Elemental');
    expect(correctedCardName('Back\\slash: "quoted"')).toBe('Backslash quoted');
  });

  it('validates editor input as an absolute http(s) URL', () => {
    expect(isValidPictureUrlTemplate('https://img.example/!name!.jpg')).toBe(true);
    expect(isValidPictureUrlTemplate('ftp://x')).toBe(false);
    expect(isValidPictureUrlTemplate('not a url')).toBe(false);
  });
});
