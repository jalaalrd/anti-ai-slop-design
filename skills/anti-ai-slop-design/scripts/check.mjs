#!/usr/bin/env node
// anti-ai-slop-design: screenshot + quick scan.
// Usage:
//   node check.mjs <url-or-html-file> [--out shots] [--widths 390,1440] [--dark] [--text 200]
//   --text 200 enlarges root text to 200% to catch layouts that collapse when readers zoom text.
// Needs Playwright:  npm i -D playwright  &&  npx playwright install chromium
// If the browser can't be installed (some cloud sandboxes block the download),
// skip this script and review at phone and desktop width by other means.

import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { delimiter, dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const args = process.argv.slice(2);
if (!args[0] || args[0].startsWith("--")) {
  console.error("Usage: node check.mjs <url-or-html-file> [--out shots] [--widths 390,1440] [--dark] [--text 200]");
  process.exit(2);
}
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i > -1 && args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : fallback;
};
const target = args[0];
const url = /^https?:\/\//.test(target) ? target : pathToFileURL(resolve(target)).href;
const out = opt("out", "shots");
const widths = opt("widths", "390,1440").split(",").map(Number);
const dark = args.includes("--dark");
const textPct = Number(opt("text", "100")) || 100;

// Find Playwright in the project (cwd), in NODE_PATH, or next to this script.
// Prefer full Playwright; fall back to playwright-core driving the installed Chrome.
const bases = [process.cwd(), ...(process.env.NODE_PATH || "").split(delimiter).filter(Boolean).map((p) => dirname(p)), dirname(fileURLToPath(import.meta.url))];
const findModule = (name) => {
  for (const base of bases) {
    try { return createRequire(join(base, "noop.js")).resolve(name); } catch {}
  }
  try { return createRequire(import.meta.url).resolve(name); } catch {}
  return null;
};
let chromium, launchOpts = {};
const full = findModule("playwright");
const core = full ? null : findModule("playwright-core");
const load = async (file) => { const m = await import(pathToFileURL(file).href); return m.chromium || (m.default && m.default.chromium); };
if (full) chromium = await load(full);
else if (core) { chromium = await load(core); launchOpts = { channel: "chrome" }; }
else {
  console.error("Playwright isn't installed. In your project run: npm i -D playwright && npx playwright install chromium");
  process.exit(2);
}

mkdirSync(out, { recursive: true });
const browser = await chromium.launch(launchOpts);
const report = [];
let fails = 0;

for (const width of widths) {
  const page = await browser.newPage({
    viewport: { width, height: width < 600 ? 844 : 900 },
    colorScheme: dark ? "dark" : "light",
    deviceScaleFactor: 1,
  });
  await page.goto(url, { waitUntil: "networkidle" });
  if (textPct !== 100) await page.addStyleTag({ content: `html{font-size:${textPct}% !important}` });
  await page.waitForTimeout(500);
  const tag = `${width}${dark ? "-dark" : ""}${textPct !== 100 ? `-text${textPct}` : ""}`;
  await page.screenshot({ path: `${out}/${tag}-first-screen.png` });
  await page.screenshot({ path: `${out}/${tag}-full.png`, fullPage: true });

  const scan = await page.evaluate((w) => {
    const issues = [];
    const doc = document.documentElement;
    // Name an element so a warning says where to look: tag#id.class "text…"
    const name = (el) => {
      const id = el.id ? `#${el.id}` : "";
      const cls = typeof el.className === "string" && el.className.trim() ? "." + el.className.trim().split(/\s+/).slice(0, 2).join(".") : "";
      const t = (el.textContent || el.getAttribute("aria-label") || "").trim().replace(/\s+/g, " ").slice(0, 30);
      return `${el.tagName.toLowerCase()}${id}${cls}${t ? ` "${t}"` : ""}`;
    };
    const list = (els) => els.slice(0, 3).map(name).join("; ") + (els.length > 3 ? `; +${els.length - 3} more` : "");
    if (doc.scrollWidth > w + 1) {
      // Find the elements that stick out past the right edge (deepest ones are usually the cause).
      const wide = [...document.querySelectorAll("body *")].filter((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.right > w + 1 && ![...el.children].some((c) => c.getBoundingClientRect().right > w + 1);
      });
      // Text can overflow a box that itself fits, so also check where the text actually lands.
      if (!wide.length) {
        const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        while (tw.nextNode()) {
          if (!tw.currentNode.textContent.trim()) continue;
          const rg = document.createRange(); rg.selectNodeContents(tw.currentNode);
          if (rg.getBoundingClientRect().right > w + 1 && tw.currentNode.parentElement) wide.push(tw.currentNode.parentElement);
        }
      }
      issues.push(["FAIL", `Sideways scroll: page is ${doc.scrollWidth}px wide at ${w}px. Sticking out: ${list(wide) || "not found; check margins, transforms and box-shadows"}.`]);
    }

    const visible = (el) => {
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none";
    };

    const small = [...document.querySelectorAll("a, button, [role=button], input, select, textarea")]
      .filter(visible)
      .filter((el) => { const r = el.getBoundingClientRect(); return r.height < 44 || r.width < 44; });
    if (w < 600 && small.length) issues.push(["WARN", `${small.length} tap targets smaller than 44px on a phone: ${list(small)}.`]);

    const noName = [...document.querySelectorAll("button, a")]
      .filter(visible)
      .filter((el) => !el.textContent.trim() && !el.getAttribute("aria-label") && !el.getAttribute("title"));
    if (noName.length) issues.push(["FAIL", `${noName.length} buttons/links with no accessible name: ${list(noName)}.`]);

    const noAlt = [...document.images].filter((img) => !img.hasAttribute("alt"));
    if (noAlt.length) issues.push(["WARN", `${noAlt.length} images without alt text: ${noAlt.slice(0, 3).map((i) => i.src.split("/").pop()).join("; ")}.`]);

    // Pictographic characters, ignoring typographic symbols like © ® ™ ‼ ⁉.
    const notEmoji = new Set(["\u00A9", "\u00AE", "\u2122", "\u203C", "\u2049"]);
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const emojiEls = [];
    while (walker.nextNode()) {
      const found = (walker.currentNode.textContent.match(/\p{Extended_Pictographic}/gu) || []).filter((c) => !notEmoji.has(c));
      if (found.length && walker.currentNode.parentElement) emojiEls.push(walker.currentNode.parentElement);
    }
    if (emojiEls.length) issues.push(["WARN", `Emoji in ${emojiEls.length} places. Use a real icon set: ${list(emojiEls)}.`]);

    const families = new Set();
    const gradientEls = [];
    for (const el of document.querySelectorAll("body *")) {
      if (!visible(el) || !el.childNodes.length) continue;
      const s = getComputedStyle(el);
      if ([...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()))
        families.add(s.fontFamily.split(",")[0].replace(/["']/g, "").trim());
      if ((s.backgroundClip === "text" || s.webkitBackgroundClip === "text") && s.backgroundImage.includes("gradient")) gradientEls.push(el);
    }
    if (families.size > 3) issues.push(["WARN", `${families.size} font families in use: ${[...families].join(", ")}.`]);
    if (gradientEls.length) issues.push(["WARN", `${gradientEls.length} elements use gradient text: ${list(gradientEls)}.`]);

    const clipped = [...document.querySelectorAll("body *")]
      .filter(visible)
      .filter((el) => {
        const s = getComputedStyle(el);
        return (s.overflow === "hidden" || s.textOverflow === "ellipsis") && el.scrollWidth > el.clientWidth + 1 && el.textContent.trim();
      });
    if (clipped.length) issues.push(["WARN", `${clipped.length} elements clip their text. Check they're meant to: ${list(clipped)}.`]);

    // Contrast: body-size text below WCAG AA (4.5:1; 3:1 for large text). Approximate:
    // ignores images and gradients behind text, so check those by eye.
    const rgb = (c) => (c.match(/[\d.]+/g) || []).map(Number);
    const lum = ([r, g, b]) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
    const bgOf = (el) => { for (let e = el; e; e = e.parentElement) { const c = rgb(getComputedStyle(e).backgroundColor); if (c.length >= 3 && (c.length < 4 || c[3] > 0.5)) return c; } return [255, 255, 255]; };
    const lowContrast = [...document.querySelectorAll("body *")].filter((el) => {
      if (!visible(el) || ![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) return false;
      const s = getComputedStyle(el); const fg = rgb(s.color); if (fg.length >= 4 && fg[3] === 0) return false;
      const a = lum(fg), b = lum(bgOf(el)); const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
      const size = parseFloat(s.fontSize), bold = Number(s.fontWeight) >= 700;
      return ratio < (size >= 24 || (bold && size >= 18.66) ? 3 : 4.5);
    });
    if (lowContrast.length) issues.push(["WARN", `${lowContrast.length} text elements may fail AA contrast (approximate): ${list(lowContrast)}.`]);

    return issues;
  }, width);

  report.push(`## ${tag}px`);
  if (!scan.length) report.push("No issues found by the scan. Still look at the screenshots yourself.");
  for (const [level, msg] of scan) {
    if (level === "FAIL") fails++;
    report.push(`- ${level}: ${msg}`);
  }
  report.push("");
  await page.close();
}

await browser.close();
const text = `# Scan of ${target}\n\nScreenshots are in ${out}/. Open every one.\n\n${report.join("\n")}`;
writeFileSync(`${out}/report.md`, text);
console.log(text);
process.exit(fails ? 1 : 0);
