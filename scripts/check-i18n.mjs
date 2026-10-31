import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import ts from 'typescript';

const root = process.cwd();
const localeDir = path.join(root, 'src/i18n/locales');
const sourceDir = path.join(root, 'src');
const readLocale = (file) => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '')).translation;
const english = readLocale(path.join(localeDir, 'en.json'));
const locales = ['en', 'hi', 'te', 'ta'];
const flatten = (value, prefix = '', output = {}) => {
  for (const [key, child] of Object.entries(value)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (child && typeof child === 'object' && !Array.isArray(child)) flatten(child, fullKey, output);
    else output[fullKey] = child;
  }
  return output;
};
const en = flatten(english);
const missing = [];
const untranslated = [];
const placeholderMismatches = [];
const sameTextAllowlist = new Set(['CropSense', 'NPK', 'pH', 'ECMWF', 'ERA5-Land', 'CSV', 'API', 'PDF', 'CC BY 4.0', 'IoT', 'DHT22', 'Smart Farm Labs', 'OpenStreetMap']);
const placeholders = (text) => [...String(text).matchAll(/\{\{\s*([^{}]+?)\s*\}\}/g)].map((match) => match[1]).sort().join('|');

for (const locale of locales.filter((item) => item !== 'en')) {
  const file = path.join(localeDir, `${locale}.json`);
  if (!fs.existsSync(file)) {
    for (const key of Object.keys(en)) missing.push(`${locale}: ${key} (no catalog)`);
    continue;
  }
  const values = flatten(readLocale(file));
  for (const [key, source] of Object.entries(en)) {
    if (!(key in values)) missing.push(`${locale}: ${key}`);
    else {
      if (typeof values[key] === 'string' && placeholders(source) !== placeholders(values[key])) placeholderMismatches.push(`${locale}: ${key}`);
      if (typeof source === 'string' && source.trim() && source === values[key] && !sameTextAllowlist.has(source.trim())) untranslated.push(`${locale}: ${key}`);
    }
  }
}

const sourceFiles = [];
const walk = (directory) => {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'i18n') walk(full);
    } else if (/\.(tsx|jsx)$/.test(entry.name)) sourceFiles.push(full);
  }
};
walk(sourceDir);
const hardcoded = [];
const appearsUserFacing = (text) => /[A-Za-z]{2}/.test(text) && !/^[\s\d.,:;!?%()\[\]{}<>/\\|_+=-]+$/.test(text);
for (const file of sourceFiles) {
  const source = fs.readFileSync(file, 'utf8');
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const inspect = (node) => {
    if (ts.isJsxText(node)) {
      const text = node.getText(ast).replace(/\s+/g, ' ').trim();
      if (appearsUserFacing(text)) hardcoded.push(`${path.relative(root, file)}:${ast.getLineAndCharacterOfPosition(node.getStart(ast)).line + 1}: ${text.slice(0, 100)}`);
    } else if (ts.isJsxAttribute(node) && ['placeholder', 'title', 'aria-label', 'alt'].includes(node.name.getText(ast)) && node.initializer && ts.isStringLiteral(node.initializer)) {
      const text = node.initializer.text.trim();
      if (appearsUserFacing(text)) hardcoded.push(`${path.relative(root, file)}:${ast.getLineAndCharacterOfPosition(node.getStart(ast)).line + 1}: ${text.slice(0, 100)}`);
    }
    ts.forEachChild(node, inspect);
  };
  inspect(ast);
}

console.log(`Locale coverage: ${locales.length} supported languages; ${Object.keys(en).length} English source keys.`);
console.log(`Missing entries: ${missing.length}; exact English copies: ${untranslated.length}; interpolation mismatches: ${placeholderMismatches.length}; JSX text/attribute candidates: ${hardcoded.length}.`);
for (const [label, list] of [['Missing translations', missing], ['Untranslated copies', untranslated], ['Interpolation mismatches', placeholderMismatches], ['Hardcoded UI candidates', hardcoded]]) {
  if (list.length) console.log(`\n${label} (showing up to 30):\n${list.slice(0, 30).join('\n')}`);
}
if (missing.length || untranslated.length || placeholderMismatches.length || hardcoded.length) process.exitCode = 1;
