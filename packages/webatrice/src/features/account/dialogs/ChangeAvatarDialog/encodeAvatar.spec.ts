import { encodeAvatar, fitWithin, MAX_AVATAR_BYTES, MAX_AVATAR_DIMENSION } from './encodeAvatar';

describe('fitWithin', () => {
  it('leaves images that already fit untouched', () => {
    expect(fitWithin({ width: 800, height: 600 }, 1024)).toEqual({ width: 800, height: 600 });
  });

  it('downscales the longer side to the limit, keeping the aspect ratio', () => {
    expect(fitWithin({ width: 4096, height: 2048 }, 1024)).toEqual({ width: 1024, height: 512 });
    expect(fitWithin({ width: 1000, height: 3000 }, 1024)).toEqual({ width: 341, height: 1024 });
  });
});

describe('encodeAvatar', () => {
  const drawImage = vi.fn();
  let encodedSizes: number[];
  let canvases: HTMLCanvasElement[];

  beforeEach(() => {
    encodedSizes = [];
    canvases = [];
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function fakeGetContext(this: HTMLCanvasElement) {
      canvases.push(this);
      return { drawImage, imageSmoothingQuality: 'low' } as unknown as CanvasRenderingContext2D;
    } as never);
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function fakeToBlob(
      this: HTMLCanvasElement,
      callback: BlobCallback,
      type?: string,
    ) {
      expect(type).toBe('image/jpeg');
      const size = encodedSizes.shift() ?? 10;
      callback({ arrayBuffer: async () => new ArrayBuffer(size) } as Blob);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const image = (width: number, height: number) =>
    ({ naturalWidth: width, naturalHeight: height }) as HTMLImageElement;

  it('downscales to MAX_AVATAR_DIMENSION and encodes JPEG', async () => {
    encodedSizes = [1234];
    const bytes = await encodeAvatar(image(2048, 1024));
    expect(bytes).toHaveLength(1234);
    expect(canvases[0]).toMatchObject({ width: MAX_AVATAR_DIMENSION, height: 512 });
    expect(drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, MAX_AVATAR_DIMENSION, 512);
  });

  it('halves the image until the encoded bytes fit Servatrice’s file limit', async () => {
    encodedSizes = [MAX_AVATAR_BYTES + 1, MAX_AVATAR_BYTES + 1, 500];
    const bytes = await encodeAvatar(image(1000, 800));
    expect(bytes).toHaveLength(500);
    expect(canvases.map(({ width, height }) => [width, height])).toEqual([[1000, 800], [500, 400], [250, 200]]);
  });
});
