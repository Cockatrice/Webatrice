import { ModuleType } from 'i18next';

class I18nBackend {
  static type: ModuleType = 'backend';
  static BASE_URL = `${import.meta.env.BASE_URL}locales`;

  read(
    language: string,
    namespace: string,
    callback: (error: unknown, data: unknown) => void,
  ) {
    fetch(`${I18nBackend.BASE_URL}/${language}/${namespace}.json`)
      .then(resp => (resp.ok ? resp.json() : {}))
      .then(json => callback(null, json))
      .catch(error => callback(error, null));
  }
}

export default I18nBackend;
