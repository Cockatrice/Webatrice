import { waitForServatriceReady } from '../helpers/servatrice';

export default async function globalSetup(): Promise<void> {
  await waitForServatriceReady(120_000);
}
