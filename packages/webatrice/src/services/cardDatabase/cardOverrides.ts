export function cardOverride(overrides: Readonly<Record<string, string>> | undefined, name: string): string | undefined {
  if (!overrides || !Object.prototype.hasOwnProperty.call(overrides, name)) {
    return undefined;
  }
  return overrides[name] || undefined;
}
