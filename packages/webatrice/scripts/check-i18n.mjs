import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { IntlMessageFormat } from 'intl-messageformat';

const SOURCE_EXTENSIONS = /\.(ts|tsx)$/;
const SKIPPED_SOURCES = /(\.(spec|test)\.tsx?$|\/__test-utils__\/|\/__mocks__\/|\.d\.ts$)/;
const CATALOG_FILE = /\.i18n\.json$/;
const KEY_PROPERTY = /Key$/;
const sourcePrinter = ts.createPrinter({ removeComments: true, newLine: ts.NewLineKind.LineFeed });

export function flattenCatalog(json, prefix = '', out = {}) {
  for (const [key, value] of Object.entries(json)) {
    const id = prefix ? `${prefix}.${key}` : key;
    if (value !== null && typeof value === 'object') {
      flattenCatalog(value, id, out);
    } else {
      out[id] = value;
    }
  }
  return out;
}

export function compareCatalogPaths(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function serializeRollup(merged) {
  return JSON.stringify(merged, null, 2);
}

export function mergeCatalogs(files) {
  const merged = {};
  const problems = [];
  for (const { file, json } of files) {
    for (const [namespace, value] of Object.entries(json)) {
      if (namespace in merged) {
        problems.push(`${file}: namespace "${namespace}" is already defined in another *.i18n.json`);
        continue;
      }
      merged[namespace] = value;
    }
  }
  return { merged, problems };
}

function isTranslateCall(node) {
  const callee = node.expression;
  if (ts.isIdentifier(callee)) {
    return callee.text === 't';
  }
  return ts.isPropertyAccessExpression(callee) && callee.name.text === 't';
}

function lineOf(sourceFile, node) {
  return sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
}

function propertyName(node) {
  const name = node.name;
  if (!name) {
    return undefined;
  }
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) {
    return name.text;
  }
  return undefined;
}

function declaredMap(node) {
  if (!ts.isVariableDeclaration(node) || !ts.isIdentifier(node.name) || !/(Keys|_KEYS)$/.test(node.name.text)
    || !(node.parent.flags & ts.NodeFlags.Const)) {
    return undefined;
  }
  let value = node.initializer;
  if (value && ts.isSatisfiesExpression(value)) {
    value = value.expression;
  }
  if (value && ts.isAsExpression(value) && value.type.getText() === 'const') {
    value = value.expression;
  } else if (!node.type) {
    return undefined;
  }
  if (!value || !ts.isObjectLiteralExpression(value)) {
    return undefined;
  }
  const entries = new Map();
  for (const property of value.properties) {
    const computedName = property.name && ts.isComputedPropertyName(property.name) ? property.name.getText() : undefined;
    const name = propertyName(property) ?? computedName;
    if (!ts.isPropertyAssignment(property) || name === undefined
      || !ts.isStringLiteralLike(property.initializer) || entries.has(name)) {
      return undefined;
    }
    entries.set(name, property.initializer.text);
  }
  return entries.size ? entries : undefined;
}

function sourceChecker(file, sourceFile) {
  const host = {
    getSourceFile: (name) => name === file ? sourceFile : undefined,
    getDefaultLibFileName: () => '',
    writeFile: () => {},
    getCurrentDirectory: () => '',
    getDirectories: () => [],
    fileExists: (name) => name === file,
    readFile: () => undefined,
    getCanonicalFileName: (name) => name,
    useCaseSensitiveFileNames: () => true,
    getNewLine: () => '\n',
  };
  return ts.createProgram([file], { noLib: true, noResolve: true }, host).getTypeChecker();
}

export function createDomainIndex(sources) {
  const files = new Map(sources.map(({ file, text }) => [file,
    ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)]));
  const exports = new Map();
  const resolveFile = (file, specifier) => {
    const base = specifier.startsWith('@app/') ? `src/${specifier.slice(5)}`
      : specifier.startsWith('.') ? path.posix.join(path.posix.dirname(file), specifier) : undefined;
    if (!base) {
      return undefined;
    }
    return [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`, base.replace(/\.js$/, '.ts')]
      .find((candidate) => files.has(candidate));
  };
  for (const [file, source] of files) {
    const local = new Map();
    const named = new Map();
    const stars = [];
    for (const statement of source.statements) {
      if (ts.isVariableStatement(statement)) {
        for (const declaration of statement.declarationList.declarations) {
          const entries = declaredMap(declaration);
          if (entries) {
            local.set(declaration.name.text, entries);
            if (statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)) {
              named.set(declaration.name.text, { entries });
            }
          }
        }
      }
    }
    for (const statement of source.statements) {
      if (!ts.isExportDeclaration(statement) || statement.isTypeOnly) {
        continue;
      }
      const target = statement.moduleSpecifier && resolveFile(file, statement.moduleSpecifier.text);
      if (statement.exportClause && ts.isNamedExports(statement.exportClause)) {
        for (const item of statement.exportClause.elements) {
          if (!item.isTypeOnly) {
            const name = (item.propertyName ?? item.name).text;
            named.set(item.name.text, statement.moduleSpecifier ? { file: target, name } : { entries: local.get(name) });
          }
        }
      } else if (!statement.exportClause && target) {
        stars.push(target);
      }
    }
    exports.set(file, { named, stars });
  }
  const resolveExport = (file, name, seen = new Set()) => {
    const id = JSON.stringify([file, name]);
    if (seen.has(id) || !exports.has(file)) {
      return undefined;
    }
    seen.add(id);
    const { named, stars } = exports.get(file);
    if (named.has(name)) {
      const entry = named.get(name);
      return entry.entries ?? resolveExport(entry.file, entry.name, seen);
    }
    const matches = stars.map((target) => resolveExport(target, name, new Set(seen))).filter(Boolean);
    return matches.length && matches.every((entries) => entries === matches[0]) ? matches[0] : undefined;
  };
  return {
    files,
    importedMap(declaration) {
      if (!ts.isImportSpecifier(declaration) || declaration.isTypeOnly || declaration.parent.parent.isTypeOnly) {
        return undefined;
      }
      const statement = declaration.parent.parent.parent;
      const file = resolveFile(declaration.getSourceFile().fileName, statement.moduleSpecifier.text);
      return resolveExport(file, (declaration.propertyName ?? declaration.name).text);
    },
  };
}

function domainKeys(node, checker, index, seen = new Set()) {
  if (seen.has(node)) {
    return undefined;
  }
  seen.add(node);
  if (ts.isStringLiteralLike(node)) {
    return [node.text];
  }
  if (node.kind === ts.SyntaxKind.NullKeyword
    || (ts.isIdentifier(node) && node.text === 'undefined' && !checker.getSymbolAtLocation(node)?.declarations?.length)) {
    return [];
  }
  if (ts.isParenthesizedExpression(node) || ts.isAsExpression(node)) {
    return domainKeys(node.expression, checker, index, seen);
  }
  const coalesce = ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken;
  if (ts.isConditionalExpression(node) || coalesce) {
    const branches = ts.isConditionalExpression(node) ? [node.whenTrue, node.whenFalse] : [node.left, node.right];
    const keys = branches.map((branch) => domainKeys(branch, checker, index, new Set(seen)));
    return keys.every(Boolean) ? [...new Set(keys.flat())] : undefined;
  }
  if (ts.isIdentifier(node)) {
    const declarations = checker.getSymbolAtLocation(node)?.declarations;
    const declaration = declarations?.length === 1 ? declarations[0] : undefined;
    return declaration && ts.isVariableDeclaration(declaration)
      && (declaration.parent.flags & ts.NodeFlags.Const) && declaration.initializer
      ? domainKeys(declaration.initializer, checker, index, seen) : undefined;
  }
  if ((!ts.isElementAccessExpression(node) && !ts.isPropertyAccessExpression(node)) || !ts.isIdentifier(node.expression)) {
    return undefined;
  }
  const declarations = checker.getSymbolAtLocation(node.expression)?.declarations;
  if (declarations?.length !== 1) {
    return undefined;
  }
  const entries = declaredMap(declarations[0]) ?? index?.importedMap(declarations[0]);
  if (!entries) {
    return undefined;
  }
  const selected = ts.isPropertyAccessExpression(node) ? node.name.text
    : ts.isStringLiteralLike(node.argumentExpression) ? node.argumentExpression.text : undefined;
  if (selected !== undefined) {
    return entries.has(selected) ? [entries.get(selected)] : undefined;
  }
  return [...new Set(entries.values())];
}

export function scanSource(file, text, index) {
  const kind = file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const sourceFile = index?.files.get(file) ?? ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, kind);
  const checker = sourceChecker(file, sourceFile);
  const result = { keys: [], dynamicCalls: [], dynamicTemplates: [], strings: new Set(), defaultValues: [] };

  const addKey = (key, node, via) => result.keys.push({ key, file, line: lineOf(sourceFile, node), via });

  const visit = (node) => {
    if (declaredMap(node)) {
      return;
    }
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      result.strings.add(node.text);
    }
    if (ts.isTemplateExpression(node) && node.head.text
      && !(ts.isCallExpression(node.parent) && isTranslateCall(node.parent) && node.parent.arguments[0] === node)) {
      result.dynamicTemplates.push({ file, prefix: node.head.text, line: lineOf(sourceFile, node) });
    }

    if (ts.isCallExpression(node) && isTranslateCall(node) && node.arguments.length > 0) {
      const [first, options] = node.arguments;
      const keys = domainKeys(first, checker, index);
      if (keys) {
        keys.forEach((key) => addKey(key, first, 't()'));
        const hasDefault = options && ts.isObjectLiteralExpression(options)
          && options.properties.some((p) => propertyName(p) === 'defaultValue');
        if (hasDefault) {
          keys.forEach((key) => result.defaultValues.push({ key, file, line: lineOf(sourceFile, first) }));
        }
      } else {
        const ref = { expression: normalizeExpression(sourcePrinter.printNode(ts.EmitHint.Expression, first, sourceFile)),
          file, line: lineOf(sourceFile, first) };
        if (ts.isTemplateExpression(first)) {
          ref.prefix = first.head.text;
          if (!ref.prefix && first.templateSpans.length === 1) {
            ref.tail = first.templateSpans[0].literal.text;
          }
        }
        result.dynamicCalls.push(ref);
      }
    }

    if (ts.isJsxAttribute(node) && node.initializer) {
      const name = node.name.getText(sourceFile);
      const value = ts.isJsxExpression(node.initializer) ? node.initializer.expression : node.initializer;
      if (value && (ts.isStringLiteral(value) || ts.isNoSubstitutionTemplateLiteral(value))) {
        if (name === 'i18nKey' || KEY_PROPERTY.test(name)) {
          addKey(value.text, value, name);
        }
      }
    }

    if (ts.isPropertyAssignment(node) && ts.isStringLiteral(node.initializer)) {
      const name = propertyName(node);
      if (name && KEY_PROPERTY.test(name)) {
        addKey(node.initializer.text, node.initializer, name);
      }
    }

    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return result;
}

export function readLanguageEnum(text) {
  const sourceFile = ts.createSourceFile('languages.ts', text, ts.ScriptTarget.Latest, true);
  const values = [];
  ts.forEachChild(sourceFile, (node) => {
    if (ts.isEnumDeclaration(node) && node.name.text === 'Language') {
      for (const member of node.members) {
        if (member.initializer && ts.isStringLiteral(member.initializer)) {
          values.push(member.initializer.text);
        }
      }
    }
  });
  return values;
}

export function checkI18n({ catalogFiles, sources, allowlist = [], rollupText, localeDirs, languages,
  localeFiles, baseline, localeReport = [] }) {
  const problems = [];
  const { merged, problems: mergeProblems } = mergeCatalogs(catalogFiles);
  problems.push(...mergeProblems);

  const messages = flattenCatalog(merged);
  const catalogKeys = Object.keys(messages);
  const namespaces = new Set(Object.keys(merged));
  const index = createDomainIndex(sources);
  const scans = [...sources].sort((a, b) => compareCatalogPaths(a.file, b.file)).map(({ file, text }) => scanSource(file, text, index));

  const used = new Set();
  const keyRefs = scans.flatMap((s) => s.keys);
  for (const ref of keyRefs) {
    const namespace = ref.key.split('.')[0];
    const isI18nRef = ref.via === 't()' || ref.via === 'i18nKey' || namespaces.has(namespace);
    if (!isI18nRef) {
      continue;
    }
    if (ref.key in messages) {
      used.add(ref.key);
    } else {
      problems.push(`${ref.file}:${ref.line}: missing key "${ref.key}" (${ref.via})`);
    }
  }

  for (const ref of scans.flatMap((s) => s.defaultValues)) {
    if (namespaces.has(ref.key.split('.')[0])) {
      problems.push(`${ref.file}:${ref.line}: "${ref.key}" passes defaultValue, which hides a missing key; define it in the catalogue`);
    }
  }

  const strings = new Set(scans.flatMap((s) => [...s.strings]));
  problems.push(...checkDynamicBaseline(scans, baseline, catalogKeys, strings, used));
  const allowed = new Set(allowlist);
  for (const key of catalogKeys) {
    if (used.has(key) || strings.has(key) || allowed.has(key)) {
      continue;
    }
    problems.push(`orphan key "${key}" is never referenced (delete it, or list it in scripts/i18n-allowlist.json)`);
  }
  for (const key of allowed) {
    if (!(key in messages)) {
      problems.push(`scripts/i18n-allowlist.json: "${key}" is not a catalogue key`);
    }
  }

  for (const [key, message] of Object.entries(messages)) {
    if (typeof message !== 'string') {
      problems.push(`"${key}" is not a string message`);
      continue;
    }
    try {
      new IntlMessageFormat(message, 'en', undefined, { ignoreTag: true });
    } catch (e) {
      problems.push(`"${key}" is not valid ICU: ${e.message}`);
    }
  }

  if (rollupText !== undefined && rollupText.replace(/\r\n/g, '\n') !== serializeRollup(merged)) {
    problems.push('src/i18n-default.json is stale; run `npm run translate` and commit the result');
  }

  if (localeDirs && languages) {
    const dirs = new Set(localeDirs);
    const langs = new Set(languages);
    for (const lang of langs) {
      if (!dirs.has(lang)) {
        problems.push(`Language.${lang} has no public/locales/${lang}/ catalogue`);
      }
    }
    for (const dir of dirs) {
      if (!langs.has(dir)) {
        problems.push(`public/locales/${dir}/ has no Language enum value`);
      }
    }
  }

  if (localeFiles) {
    const files = [...(localeDirs ?? []).map((locale) => ({ locale, json: {} })), ...localeFiles];
    problems.push(...checkLocaleCompleteness(files, baseline, messages, localeReport));
  }

  return problems;
}

function normalizeExpression(expression) {
  return expression.replace(/\s+/g, ' ').trim();
}

function dynamicId(ref) {
  return JSON.stringify([ref.file, ref.prefix ?? null, ref.prefix === undefined ? normalizeExpression(ref.expression) : ref.tail ?? null]);
}

function validDynamicEntries(entries, templates = false) {
  if (!Array.isArray(entries)) {
    return false;
  }
  const ids = new Set();
  return entries.every((entry) => {
    if (!entry || typeof entry.file !== 'string' || !entry.file.startsWith('src/') || entry.file.includes('\\')
      || !Number.isSafeInteger(entry.count) || entry.count < 1) {
      return false;
    }
    const prefix = typeof entry.prefix === 'string' && entry.expression === undefined;
    const expression = entry.prefix === undefined && typeof entry.expression === 'string' && entry.expression.length > 0;
    if (!(prefix || (!templates && expression)) || (templates && !entry.prefix)
      || (entry.tail !== undefined && (entry.prefix !== '' || typeof entry.tail !== 'string'))) {
      return false;
    }
    const id = dynamicId(entry);
    if (ids.has(id)) {
      return false;
    }
    ids.add(id);
    return true;
  });
}

function checkDynamicBaseline(scans, baseline, catalogKeys, strings, used) {
  const calls = baseline?.dynamicCalls ?? [];
  const templates = baseline?.dynamicTemplates ?? [];
  if (!validDynamicEntries(calls) || !validDynamicEntries(templates, true)) {
    return ['scripts/i18n-baseline.json: invalid dynamic baseline'];
  }
  const problems = [];
  const check = (refs, entries, kind) => {
    const remaining = new Map(entries.map((entry) => [dynamicId(entry), entry.count]));
    for (const ref of refs) {
      const id = dynamicId(ref);
      const count = remaining.get(id) ?? 0;
      if (!count) {
        if (kind === 'call') {
          problems.push(`${ref.file}:${ref.line}: dynamic t() key has no declared domain: ${ref.expression}`);
        }
        continue;
      }
      remaining.set(id, count - 1);
      if (ref.prefix) {
        const matches = catalogKeys.filter((key) => key.startsWith(ref.prefix));
        if (!matches.length) {
          problems.push(`${ref.file}:${ref.line}: no key matches the template prefix "${ref.prefix}"`);
        }
        matches.forEach((key) => used.add(key));
      } else if (ref.tail !== undefined) {
        catalogKeys.filter((key) => key.endsWith(ref.tail) && strings.has(key.substring(0, key.length - ref.tail.length)))
          .forEach((key) => used.add(key));
      }
    }
    for (const entry of entries) {
      if (remaining.get(dynamicId(entry))) {
        problems.push(`scripts/i18n-baseline.json: stale dynamic ${kind}: ${entry.file}: ${entry.prefix ?? entry.expression}`);
      }
    }
  };
  check(scans.flatMap((scan) => scan.dynamicCalls), calls, 'call');
  check(scans.flatMap((scan) => scan.dynamicTemplates), templates, 'template');
  return problems;
}

function validBaseline(baseline) {
  if (baseline?.version !== 1 || !baseline.locales || typeof baseline.locales !== 'object' || Array.isArray(baseline.locales)) {
    return false;
  }
  return Object.values(baseline.locales).every((entry) => entry && Array.isArray(entry.keys)
    && entry.count === entry.keys.length && entry.keys.every((key) => typeof key === 'string' && key.length > 0)
    && entry.keys.every((key, index) => index === 0 || compareCatalogPaths(entry.keys[index - 1], key) < 0));
}

function localeCatalogs(localeFiles) {
  const locales = new Map();
  for (const { locale, json } of localeFiles) {
    if (!locales.has(locale)) {
      locales.set(locale, {});
    }
    Object.assign(locales.get(locale), flattenCatalog(json));
  }
  return locales;
}

export function refreshLocaleBaseline(localeFiles, baseline, messages) {
  if (!validBaseline(baseline)) {
    throw new Error('scripts/i18n-baseline.json: invalid completeness baseline');
  }
  const catalogs = localeCatalogs(localeFiles);
  const locales = {};
  const names = new Set([...Object.keys(baseline.locales), ...catalogs.keys()]);
  for (const locale of [...names].sort(compareCatalogPaths)) {
    const catalog = catalogs.get(locale) ?? {};
    const translated = Object.keys(catalog).filter((key) => typeof catalog[key] === 'string' && catalog[key].trim());
    const keys = [...new Set([...(baseline.locales[locale]?.keys ?? []), ...translated])]
      .filter((key) => Object.hasOwn(messages, key)).sort(compareCatalogPaths);
    locales[locale] = { count: keys.length, keys };
  }
  return { ...baseline, locales };
}

export function checkLocaleCompleteness(localeFiles, baseline, messages, report = []) {
  if (!validBaseline(baseline)) {
    return ['scripts/i18n-baseline.json: invalid completeness baseline'];
  }
  const locales = localeCatalogs(localeFiles);
  const problems = [];
  for (const locale of Object.keys(baseline.locales).sort(compareCatalogPaths)) {
    for (const key of baseline.locales[locale].keys) {
      if (!Object.hasOwn(messages, key)) {
        problems.push(`scripts/i18n-baseline.json: ${locale}: stale baseline key "${key}"`);
      }
    }
  }
  for (const [locale, catalog] of [...locales.entries()].sort(([a], [b]) => compareCatalogPaths(a, b))) {
    const keys = new Set(Object.keys(catalog).filter((key) => typeof catalog[key] === 'string' && catalog[key].trim()));
    const entry = baseline.locales[locale];
    report.push({ locale, translated: [...keys].filter((key) => Object.hasOwn(messages, key)).length,
      total: Object.keys(messages).length, baseline: entry?.count ?? 0 });
    if (!entry) {
      problems.push(`public/locales/${locale}/: completeness baseline is missing`);
      continue;
    }
    for (const key of entry.keys) {
      if (Object.hasOwn(messages, key) && !keys.has(key)) {
        problems.push(`public/locales/${locale}/: lost baseline translation "${key}"`);
      }
    }
  }
  for (const locale of Object.keys(baseline.locales).sort(compareCatalogPaths)) {
    if (!locales.has(locale)) {
      problems.push(`public/locales/${locale}/: baseline locale is missing`);
    }
  }
  return problems;
}

function walk(dir, test, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, test, out);
    } else if (test(full)) {
      out.push(full);
    }
  }
  return out;
}

function main() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const src = path.join(root, 'src');
  const rel = (file) => path.relative(root, file).split(path.sep).join('/');

  const catalogFiles = walk(src, (f) => CATALOG_FILE.test(f))
    .map((file) => ({ file: rel(file), json: JSON.parse(fs.readFileSync(file, 'utf8')) }))
    .sort((a, b) => compareCatalogPaths(a.file, b.file));
  const sources = walk(src, (f) => SOURCE_EXTENSIONS.test(f) && !SKIPPED_SOURCES.test(f.split(path.sep).join('/')))
    .map((file) => ({ file: rel(file), text: fs.readFileSync(file, 'utf8') }))
    .sort((a, b) => compareCatalogPaths(a.file, b.file));
  const allowlist = Object.keys(JSON.parse(fs.readFileSync(path.join(root, 'scripts/i18n-allowlist.json'), 'utf8')));
  const rollupText = fs.readFileSync(path.join(src, 'i18n-default.json'), 'utf8');
  const localeDirs = fs.readdirSync(path.join(root, 'public/locales'), { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name).sort(compareCatalogPaths);
  const languages = readLanguageEnum(fs.readFileSync(path.join(src, 'types/languages.ts'), 'utf8'));
  const localeFiles = localeDirs.flatMap((locale) => walk(path.join(root, 'public/locales', locale), (file) => file.endsWith('.json'))
    .sort(compareCatalogPaths).map((file) => ({ locale, json: JSON.parse(fs.readFileSync(file, 'utf8')) })));
  const baselineFile = path.join(root, 'scripts/i18n-baseline.json');
  let baseline = fs.existsSync(baselineFile) ? JSON.parse(fs.readFileSync(baselineFile, 'utf8')) : undefined;
  if (process.argv.includes('--write-locale-baseline')) {
    const files = [...localeDirs.map((locale) => ({ locale, json: {} })), ...localeFiles];
    baseline = refreshLocaleBaseline(files, baseline, flattenCatalog(mergeCatalogs(catalogFiles).merged));
    fs.writeFileSync(baselineFile, `${JSON.stringify(baseline, null, 2)}\n`);
  }
  const localeReport = [];

  const problems = checkI18n({ catalogFiles, sources, allowlist, rollupText, localeDirs, languages, localeFiles, baseline, localeReport });
  for (const { locale, translated, total, baseline: count } of localeReport) {
    const percent = total ? (translated / total * 100).toFixed(1) : '100.0';
    console.log(`i18n:check: ${locale}: ${translated}/${total} (${percent}%), ${count} baseline keys protected`);
  }
  if (problems.length > 0) {
    console.error(`i18n:check found ${problems.length} problem(s):\n${problems.map((p) => `  ${p}`).join('\n')}`);
    process.exitCode = 1;
    return;
  }
  console.log(`i18n:check: ${catalogFiles.length} catalogues, ${sources.length} sources, all keys resolve`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
