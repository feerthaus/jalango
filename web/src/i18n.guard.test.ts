/// <reference types="node" />
/**
 * Every piece of text a user can see must go through t() (lib/i18n), so that
 * switching the language really switches it, and new languages (Thai,
 * Indonesian, Filipino…) can be added later. This test fails when a .tsx file
 * has bare text in JSX (text nodes, user-facing attributes, or string literals
 * rendered as JSX children).
 *
 * Fix a failure by wrapping the text: t('Teks BM', 'English text'). If the text
 * is the same in every language (a brand, a unit, a name), add it to SAME.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const ROOT = path.dirname(fileURLToPath(import.meta.url));

/** Owner-only admin tools and the legal pages (which carry their own BM and EN text). */
const SKIP = /(^|\/)(pages\/legal\/|components\/admin\/(?!AdminCard|CountBadge)|pages\/AdminPage|components\/accidents\/PhotoReviewQueue|components\/brand\/LogoMark)/;

/** Text that is the same in every language. */
const SAME = new Set([
  'Admin', 'Auto', 'Chrome', 'Deposit', 'Demo', 'Email', 'Exit', 'Facebook', 'Google Maps', 'Halal JAKIM', 'Homestay', 'Instagram',
  'K7M4-QX2P', 'Leader', 'LIVE', 'Listing', 'MAPBOX_ACCESS_TOKEN', 'Manual', 'Menu', 'Model', 'Myvi', 'PDF', 'Perodua', 'Review', 'Safari',
  'jalango.netlify.app', 'sen', '"Open in Safari"', 'Bahasa Melayu', 'English', 'ETS', 'Komuter', 'Shuttle', 'Intercity',
]);
/** Words that never need translating inside longer text. */
const NEUTRAL = /\b(JalanGo|WhatsApp|RM|km|SSM|APAD|PDPA|EV|R&R|OK|Waze|Google|Mapbox|2D|3D|ETA|GPS|km\/h|PWA)\b/g;
const ATTRS = new Set(['aria-label', 'title', 'placeholder', 'alt', 'label', 'heading', 'subtitle']);

const hasWords = (s: string) => /[A-Za-z]{2,}/.test(s.replace(/https?:\/\/\S+/g, '').replace(NEUTRAL, ''));

function files(dir: string, out: string[] = []): string[] {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) files(p, out);
    else if (p.endsWith('.tsx') && !p.includes('.test.') && !SKIP.test(path.relative(ROOT, p))) out.push(p);
  }
  return out;
}

function bareText(file: string): string[] {
  const sf = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const hits: string[] = [];
  const at = (n: ts.Node) => `${path.relative(ROOT, file)}:${sf.getLineAndCharacterOfPosition(n.getStart()).line + 1}`;
  const insideCall = (n: ts.Node) => {
    for (let p = n.parent; p; p = p.parent) {
      if (ts.isCallExpression(p)) return true;
      if (ts.isJsxElement(p) || ts.isJsxSelfClosingElement(p) || ts.isJsxFragment(p)) return false;
    }
    return false;
  };
  const langConditional = (n: ts.Node) => {
    for (let p = n.parent; p && !ts.isJsxElement(p); p = p.parent) if (ts.isConditionalExpression(p) && /lang/.test(p.condition.getText())) return true;
    return false;
  };
  const visit = (n: ts.Node) => {
    if (ts.isJsxText(n)) {
      const text = n.getText().trim().replace(/\s+/g, ' ');
      if (text && hasWords(text) && !SAME.has(text)) hits.push(`${at(n)} text "${text.slice(0, 60)}"`);
    } else if (ts.isJsxAttribute(n) && ATTRS.has(n.name.getText()) && n.initializer && ts.isStringLiteral(n.initializer)) {
      const text = n.initializer.text;
      if (hasWords(text) && !SAME.has(text)) hits.push(`${at(n)} ${n.name.getText()}="${text.slice(0, 50)}"`);
    } else if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n) || ts.isTemplateExpression(n)) {
      let rendered = false;
      for (let p: ts.Node | undefined = n.parent; p; p = p.parent) {
        if (ts.isJsxExpression(p)) {
          rendered = !(p.parent && ts.isJsxAttribute(p.parent)) || ATTRS.has(p.parent.name.getText());
          break;
        }
        if (ts.isCallExpression(p) || ts.isJsxAttribute(p) || ts.isBlock(p) || ts.isArrowFunction(p)) break;
      }
      const text = ts.isTemplateExpression(n) ? n.head.text + n.templateSpans.map((s) => s.literal.text).join(' ') : n.text;
      if (rendered && !insideCall(n) && !langConditional(n) && !ts.isBinaryExpression(n.parent) && hasWords(text) && !SAME.has(text)) {
        hits.push(`${at(n)} {"${text.slice(0, 50)}"}`);
      }
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
  return hits;
}

describe('i18n guard', () => {
  it('has no bare (untranslated) text in screens: wrap it in t()', () => {
    const hits = files(ROOT).flatMap(bareText);
    expect(hits, `Untranslated text:\n${hits.join('\n')}`).toEqual([]);
  });
});
