// Startup capability preflight. A classic script, loaded by index.html before
// the app's module entry, so it runs in browsers that cannot parse the bundle
// at all. It must stay ES5 (ESLint parses it as ES5): anything newer would fail
// to parse in exactly the browsers it exists to catch.
//
// The supported browsers are declared in package.json `browserslist` and pinned
// as the Vite build target (Chrome/Edge 111, Firefox 114, Safari 16.4). A
// missing check below means an older or embedded browser, a feature disabled by
// policy or privacy mode, or a page served outside a secure context.
//
// Required features gate the boot: the result is published on
// window.Cockatrice.browserSupport, and src/index.tsx loads the app only when
// nothing required is missing. Otherwise this script renders the unsupported
// screen itself, so no app code is downloaded. Optional features each have a
// fallback where they are used; the app boots and FeatureDetection names them.
//
// IndexedDB is also checked asynchronously after boot (dexieService.testConnection):
// the global can exist while opening a database fails, as in some private modes.
//
// Trade-off: the screen cannot use the app's i18next instance or bundled CSS.
// It carries the English strings of Unsupported.i18n.json and
// BrowserFeature.i18n.json, swaps in the user's language from
// public/locales when that loads, and copies the theme tokens it needs from
// src/styles/tokens.css. browserSupport.spec.ts keeps both copies in step. It
// paints the theme and palette saved for the next boot, resolved as the app's
// bootColorScheme does.
(function preflight(root) {
  'use strict';

  var document = root.document;

  function isFunction(value) {
    return typeof value === 'function';
  }

  var SYNTAX_PROBE = [
    'class A { #p = 1n; static s; static { A.s = 0; } m() { return this.#p ?? 0n; } }',
    'var o = { ...{} }; o?.a; o.b ??= 1; o.c ||= 1; o.d &&= 1;',
    'async function* g() { for await (const x of []) { yield x; } }',
    'try { } catch { }',
  ].join('\n');

  function parsesModernSyntax() {
    try {
      new root.Function(SYNTAX_PROBE);
      return true;
    } catch (error) {
      return !(error instanceof root.SyntaxError);
    }
  }

  var CHECKS = [
    { feature: 'syntax', required: true, isAvailable: parsesModernSyntax },
    {
      feature: 'esModules',
      required: true,
      isAvailable: function hasModules() {
        return 'noModule' in document.createElement('script');
      },
    },
    {
      feature: 'bigInt',
      required: true,
      isAvailable: function hasBigInt() {
        return isFunction(root.BigInt);
      },
    },
    {
      feature: 'webSocket',
      required: true,
      isAvailable: function hasWebSocket() {
        return isFunction(root.WebSocket);
      },
    },
    {
      feature: 'cryptoRandom',
      required: true,
      isAvailable: function hasRandom() {
        return !!root.crypto && isFunction(root.crypto.getRandomValues);
      },
    },
    {
      feature: 'textEncoder',
      required: true,
      isAvailable: function hasEncoder() {
        return isFunction(root.TextEncoder);
      },
    },
    {
      feature: 'structuredClone',
      required: true,
      isAvailable: function hasClone() {
        return isFunction(root.structuredClone);
      },
    },
    {
      feature: 'fetch',
      required: true,
      isAvailable: function hasFetch() {
        return isFunction(root.fetch) && isFunction(root.AbortController);
      },
    },
    {
      feature: 'indexedDB',
      required: true,
      isAvailable: function hasIndexedDB() {
        return root.indexedDB != null;
      },
    },
    {
      feature: 'resizeObserver',
      required: true,
      isAvailable: function hasResizeObserver() {
        return isFunction(root.ResizeObserver);
      },
    },

    {
      feature: 'webCrypto',
      required: false,
      isAvailable: function hasSubtle() {
        return !!root.crypto && !!root.crypto.subtle && isFunction(root.crypto.subtle.digest);
      },
    },
    {
      feature: 'worker',
      required: false,
      isAvailable: function hasWorker() {
        return isFunction(root.Worker);
      },
    },
    {
      feature: 'broadcastChannel',
      required: false,
      isAvailable: function hasBroadcastChannel() {
        return isFunction(root.BroadcastChannel);
      },
    },
    {
      feature: 'clipboard',
      required: false,
      isAvailable: function hasClipboard() {
        return !!root.navigator && !!root.navigator.clipboard && isFunction(root.navigator.clipboard.writeText);
      },
    },
  ];

  function isAvailable(check) {
    try {
      return !!check.isAvailable();
    } catch (error) {
      return false;
    }
  }

  function detect() {
    var support = { missingRequired: [], missingOptional: [] };
    for (var i = 0; i < CHECKS.length; i++) {
      if (!isAvailable(CHECKS[i])) {
        (CHECKS[i].required ? support.missingRequired : support.missingOptional).push(CHECKS[i].feature);
      }
    }
    return support;
  }

  var STRINGS = {
    Unsupported: {
      title: 'Unsupported Browser',
      subtitle1: 'Please update your browser and/or check your permissions.',
      subtitle2: 'Note: Private browsing causes some browsers to disable certain permissions or features.',
      missing: 'This browser does not provide:',
    },
    BrowserFeature: {
      syntax: 'Modern JavaScript, used by the whole client',
      esModules: 'JavaScript modules, used to load the client',
      bigInt: 'BigInt numbers, used by the server protocol',
      webSocket: 'WebSockets, used to connect to the server',
      cryptoRandom: 'Secure random numbers, used to log in',
      textEncoder: 'Text encoding, used by the server protocol',
      structuredClone: 'Structured cloning, used to track server requests',
      fetch: 'Fetch, used to load translations, servers and card data',
      indexedDB: 'IndexedDB storage, used for cards, decks and settings',
      resizeObserver: 'Resize observers, used to lay out the game board',
      webCrypto: 'Password hashing, which needs a page served over https://; '
        + 'passwords are sent to the server unhashed instead',
      worker: 'Web Workers, used to keep the connection alive in a background tab',
      broadcastChannel: 'Broadcast channels, used by the pop-out card preview',
      clipboard: 'The clipboard, used by copy buttons (needs a page served over https://)',
    },
  };

  function element(tag, className, text) {
    var node = document.createElement(tag);
    if (className) {
      node.className = className;
    }
    if (text != null) {
      node.textContent = text;
    }
    return node;
  }

  function buildScreen(missing, strings) {
    var main = element('main', 'Unsupported');

    var paper = element('div', 'Unsupported-paper');
    var header = element('div', 'Unsupported-paper__header');
    header.appendChild(element('h1', null, strings.Unsupported.title));
    header.appendChild(element('p', null, strings.Unsupported.subtitle1));
    paper.appendChild(header);

    var list = element('div', 'Unsupported-paper__missing');
    list.appendChild(element('p', null, strings.Unsupported.missing));
    var items = element('ul');
    for (var i = 0; i < missing.length; i++) {
      items.appendChild(element('li', null, strings.BrowserFeature[missing[i]]));
    }
    list.appendChild(items);
    paper.appendChild(list);

    paper.appendChild(element('p', 'Unsupported-paper__note', strings.Unsupported.subtitle2));
    main.appendChild(paper);
    return main;
  }

  function render(missing, strings) {
    var container = document.getElementById('root') || document.body;
    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }
    container.appendChild(buildScreen(missing, strings));
  }

  function translate(translation) {
    var strings = { Unsupported: {}, BrowserFeature: {} };
    for (var namespace in strings) {
      if (Object.prototype.hasOwnProperty.call(strings, namespace)) {
        var english = STRINGS[namespace];
        var translated = (translation && translation[namespace]) || {};
        for (var key in english) {
          if (Object.prototype.hasOwnProperty.call(english, key)) {
            strings[namespace][key] = typeof translated[key] === 'string' ? translated[key] : english[key];
          }
        }
      }
    }
    return strings;
  }

  function storedChoice(key, allowed) {
    var value = null;
    try {
      value = root.localStorage.getItem(key);
    } catch (error) {
      value = null;
    }
    for (var i = 0; i < allowed.length; i++) {
      if (allowed[i] === value) {
        return value;
      }
    }
    return null;
  }

  function applySavedTheme() {
    var savedMode = storedChoice('webatrice.themeMode', ['system', 'light', 'dark']);
    var name = storedChoice('webatrice.themeName', ['midnight', 'graphite', 'carbon'])
      || (savedMode ? 'midnight' : 'graphite');
    var mode = savedMode || 'dark';
    if (mode === 'system') {
      mode = isFunction(root.matchMedia) && !root.matchMedia('(prefers-color-scheme: dark)').matches ? 'light' : 'dark';
    }
    document.documentElement.setAttribute('data-theme', mode);
    document.documentElement.setAttribute('data-scheme', name);
  }

  function preferredLocales() {
    var language = null;
    try {
      language = root.localStorage.getItem('i18nextLng');
    } catch (error) {
      language = null;
    }
    language = (language || (root.navigator && root.navigator.language) || '')
      .replace(/^\s+|\s+$/g, '').replace(/-/g, '_').toLowerCase();
    var supported = ['en_US', 'de', 'es', 'fi', 'fr', 'it', 'nl', 'pl', 'pt_BR', 'ru', 'tok', 'yue'];
    var i;
    for (i = 0; i < supported.length; i++) {
      if (supported[i].toLowerCase() === language) {
        return [supported[i]];
      }
    }
    var base = language.split('_')[0];
    for (i = 0; i < supported.length; i++) {
      if (supported[i].toLowerCase().split('_')[0] === base) {
        return [supported[i]];
      }
    }
    return [];
  }

  function assetsBaseUrl() {
    var script = document.currentScript;
    return script && script.src ? script.src.replace(/[^/]*$/, '') : '/';
  }

  function loadTranslation(locales, baseUrl, onLoad) {
    if (locales.length === 0 || !isFunction(root.XMLHttpRequest)) {
      return;
    }
    var request = new root.XMLHttpRequest();
    request.onload = function onTranslation() {
      var translation = null;
      try {
        translation = request.status === 200 ? JSON.parse(request.responseText) : null;
      } catch (error) {
        translation = null;
      }
      if (translation) {
        onLoad(translation, locales[0]);
      } else {
        loadTranslation(locales.slice(1), baseUrl, onLoad);
      }
    };
    request.onerror = function onTranslationError() {
      loadTranslation(locales.slice(1), baseUrl, onLoad);
    };
    request.open('GET', baseUrl + locales[0] + '/translation.json');
    request.send();
  }

  var support = detect();
  root.Cockatrice = root.Cockatrice || {};
  root.Cockatrice.browserSupport = support;

  if (support.missingRequired.length > 0) {
    var baseUrl = assetsBaseUrl();
    var style = element('link');
    style.rel = 'stylesheet';
    style.href = baseUrl + 'preflight.css';
    (document.head || document.documentElement).appendChild(style);
    applySavedTheme();
    render(support.missingRequired, STRINGS);

    var locales = preferredLocales();
    if (locales.length > 0 && locales[0].indexOf('en') !== 0) {
      loadTranslation(locales, baseUrl + 'locales/', function showTranslated(translation, locale) {
        document.documentElement.lang = locale.replace('_', '-');
        render(support.missingRequired, translate(translation));
      });
    }
  }
})(window);
