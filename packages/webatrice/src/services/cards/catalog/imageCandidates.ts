export interface ImageCandidateSource {
  imageUri?: string;
  imageUris?: readonly string[];
}

export function imageCandidatesOf(source: ImageCandidateSource | null | undefined): string[] {
  if (!source) {
    return [];
  }
  return [...new Set([...(source.imageUris ?? []), source.imageUri].filter((url): url is string => Boolean(url)))];
}

export function primaryImageUri(source: ImageCandidateSource | null | undefined): string | undefined {
  return imageCandidatesOf(source)[0];
}
