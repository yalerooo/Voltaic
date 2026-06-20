// Per-type file icons for the SFTP browsers. Maps a filename's extension to a
// category, each with a distinct SVG glyph and a tasteful color. Folders use the
// brand voltage; file categories use muted, shape-distinct hues (the same HSL
// approach already used for the sidebar protocol dots), so types are
// recognizable without introducing a second brand color at element scale.

import type { JSX } from "react";
import type { EntryKind } from "../lib/types";

type Category =
  | "folder"
  | "pdf"
  | "word"
  | "excel"
  | "slides"
  | "text"
  | "markdown"
  | "generic"
  | "js"
  | "ts"
  | "code"
  | "shell"
  | "json"
  | "markup"
  | "style"
  | "config"
  | "image"
  | "video"
  | "audio"
  | "archive"
  | "binary"
  | "database"
  | "font"
  | "keycert";

const EXT: Record<string, Category> = {
  // documents
  pdf: "pdf",
  doc: "word", docx: "word", odt: "word", rtf: "word", pages: "word",
  xls: "excel", xlsx: "excel", xlsm: "excel", csv: "excel", tsv: "excel", ods: "excel", numbers: "excel",
  ppt: "slides", pptx: "slides", odp: "slides", keynote: "slides",
  txt: "text", text: "text", log: "text", nfo: "text", rst: "text",
  md: "markdown", markdown: "markdown", mdx: "markdown",
  // code
  js: "js", jsx: "js", mjs: "js", cjs: "js",
  ts: "ts", tsx: "ts", mts: "ts", cts: "ts",
  json: "json", json5: "json", jsonc: "json",
  xml: "markup", html: "markup", htm: "markup", xhtml: "markup", vue: "markup", svelte: "markup",
  css: "style", scss: "style", sass: "style", less: "style",
  py: "code", rb: "code", go: "code", rs: "code", java: "code", c: "code", h: "code",
  cpp: "code", cc: "code", cxx: "code", hpp: "code", cs: "code", php: "code", swift: "code",
  kt: "code", kts: "code", scala: "code", dart: "code", lua: "code", r: "code", pl: "code",
  ex: "code", exs: "code", clj: "code", hs: "code", elm: "code", zig: "code",
  sh: "shell", bash: "shell", zsh: "shell", fish: "shell", ps1: "shell", bat: "shell", cmd: "shell",
  // config
  yml: "config", yaml: "config", toml: "config", ini: "config", conf: "config",
  cfg: "config", env: "config", properties: "config", lock: "config", dockerfile: "config",
  // media
  png: "image", jpg: "image", jpeg: "image", gif: "image", bmp: "image", webp: "image",
  ico: "image", tif: "image", tiff: "image", heic: "image", avif: "image", svg: "image", psd: "image",
  mp4: "video", mkv: "video", mov: "video", avi: "video", webm: "video", flv: "video",
  wmv: "video", m4v: "video", mpg: "video", mpeg: "video",
  mp3: "audio", wav: "audio", flac: "audio", ogg: "audio", m4a: "audio", aac: "audio",
  wma: "audio", opus: "audio", mid: "audio",
  // bundles & binaries
  zip: "archive", tar: "archive", gz: "archive", tgz: "archive", rar: "archive", "7z": "archive",
  bz2: "archive", xz: "archive", zst: "archive", lz: "archive", iso: "archive", jar: "archive",
  exe: "binary", dll: "binary", so: "binary", dylib: "binary", bin: "binary", app: "binary",
  msi: "binary", deb: "binary", rpm: "binary", apk: "binary", o: "binary", out: "binary",
  // data, fonts, security
  db: "database", sqlite: "database", sqlite3: "database", sql: "database", mdb: "database",
  ttf: "font", otf: "font", woff: "font", woff2: "font", eot: "font",
  pem: "keycert", key: "keycert", crt: "keycert", cert: "keycert", cer: "keycert",
  pub: "keycert", pfx: "keycert", p12: "keycert", asc: "keycert", gpg: "keycert", sig: "keycert",
};

const COLOR: Record<Category, string> = {
  folder: "var(--color-primary)",
  pdf: "hsl(4 75% 62%)",
  word: "hsl(212 78% 62%)",
  excel: "hsl(146 55% 50%)",
  slides: "hsl(22 85% 60%)",
  text: "hsl(0 0% 72%)",
  markdown: "hsl(0 0% 82%)",
  generic: "var(--color-muted)",
  js: "hsl(52 92% 60%)",
  ts: "hsl(211 65% 62%)",
  code: "hsl(167 55% 52%)",
  shell: "hsl(135 45% 58%)",
  json: "hsl(95 52% 56%)",
  markup: "hsl(20 85% 62%)",
  style: "hsl(199 78% 62%)",
  config: "hsl(45 14% 64%)",
  image: "hsl(280 58% 68%)",
  video: "hsl(330 62% 66%)",
  audio: "hsl(190 72% 58%)",
  archive: "hsl(40 82% 62%)",
  binary: "hsl(0 0% 62%)",
  database: "hsl(220 58% 66%)",
  font: "hsl(310 50% 68%)",
  keycert: "hsl(46 85% 60%)",
};

function categorize(name: string): Category {
  const lower = name.toLowerCase();
  // Extension-less well-known names.
  if (lower === "dockerfile" || lower === "makefile" || lower.startsWith(".env")) {
    return "config";
  }
  const dot = lower.lastIndexOf(".");
  if (dot <= 0 || dot === lower.length - 1) return "generic";
  return EXT[lower.slice(dot + 1)] ?? "generic";
}

// A page silhouette with a folded corner; `inner` adds type-specific marks.
function page(inner?: JSX.Element): JSX.Element {
  return (
    <>
      <path d="M6.5 3.2h7L18 7.7v12a1 1 0 0 1-1 1H6.5a1 1 0 0 1-1-1v-15.5a1 1 0 0 1 1-1z" />
      <path d="M13.2 3.2V8h4.6" />
      {inner}
    </>
  );
}

const LINES = <path d="M8 12h7.5M8 14.8h7.5M8 17.6h4.5" />;

const GLYPH: Record<Category, JSX.Element> = {
  folder: (
    <path
      d="M3.2 6.8A1.6 1.6 0 0 1 4.8 5.2h3.9a1.6 1.6 0 0 1 1.3.66l.95 1.34h8.25a1.6 1.6 0 0 1 1.6 1.6v8.6a1.6 1.6 0 0 1-1.6 1.6H4.8a1.6 1.6 0 0 1-1.6-1.6z"
      fill="currentColor"
      fillOpacity={0.14}
    />
  ),
  pdf: page(LINES),
  word: page(LINES),
  text: page(LINES),
  markdown: page(<path d="M8 17.6V12l2 2 2-2v5.6M15.5 12v4M14 14.5l1.5 1.5 1.5-1.5" />),
  generic: page(),
  slides: (
    <>
      <rect x="3.5" y="5" width="17" height="11" rx="1.4" />
      <path d="M12 16v3M9 19h6" />
    </>
  ),
  excel: (
    <>
      <rect x="4" y="5" width="16" height="14" rx="1.4" />
      <path d="M4 10h16M4 14.5h16M9.7 5v14M14.3 5v14" />
    </>
  ),
  js: <path d="M9 8l-4 4 4 4M15 8l4 4-4 4M13.2 6l-2.4 12" />,
  ts: <path d="M9 8l-4 4 4 4M15 8l4 4-4 4M13.2 6l-2.4 12" />,
  code: <path d="M9 8l-4 4 4 4M15 8l4 4-4 4M13.2 6l-2.4 12" />,
  markup: <path d="M8 8l-4 4 4 4M16 8l4 4-4 4" />,
  json: (
    <path d="M9.5 4.5c-1.8 0-2 1.4-2 3s.2 3-1.5 4.5c1.7 1.5 1.5 3 1.5 4.5s.2 3 2 3M14.5 4.5c1.8 0 2 1.4 2 3s-.2 3 1.5 4.5c-1.7 1.5-1.5 3-1.5 4.5s-.2 3-2 3" />
  ),
  style: <path d="M9.5 4l-2 16M16.5 4l-2 16M5 9.5h14M4.2 14.5h14" />,
  shell: (
    <>
      <rect x="3.5" y="5" width="17" height="14" rx="2" />
      <path d="M7 10l3 2.5-3 2.5M13.5 15.5h4" />
    </>
  ),
  config: (
    <>
      <circle cx="12" cy="12" r="3.1" />
      <path d="M12 4v2.6M12 17.4V20M4 12h2.6M17.4 12H20M6.4 6.4l1.85 1.85M15.75 15.75l1.85 1.85M17.6 6.4l-1.85 1.85M8.25 15.75 6.4 17.6" />
    </>
  ),
  image: (
    <>
      <rect x="4" y="5" width="16" height="14" rx="1.6" />
      <circle cx="9" cy="9.8" r="1.5" />
      <path d="M4.5 16.5l4.2-3.4 3 2.2 4-3.6 4.3 4.3" />
    </>
  ),
  video: (
    <>
      <rect x="3.5" y="6" width="17" height="12" rx="2" />
      <path d="M10.7 9.4l4.3 2.6-4.3 2.6z" fill="currentColor" />
    </>
  ),
  audio: (
    <>
      <path d="M9 16.5V6.8l9-1.8v9.4" />
      <circle cx="6.8" cy="16.5" r="2.2" />
      <circle cx="15.8" cy="14.4" r="2.2" />
    </>
  ),
  archive: (
    <>
      <rect x="4.5" y="4.5" width="15" height="15" rx="1.6" />
      <path d="M4.5 9.2h15M10 4.5v4.7M14 4.5v4.7M10.6 13h2.8M10.6 16h2.8" />
    </>
  ),
  binary: (
    <>
      <rect x="6.2" y="6.2" width="11.6" height="11.6" rx="1.4" />
      <rect x="9.6" y="9.6" width="4.8" height="4.8" rx="0.6" />
      <path d="M9.4 6.2V3.4M14.6 6.2V3.4M9.4 20.6v-2.8M14.6 20.6v-2.8M6.2 9.4H3.4M6.2 14.6H3.4M20.6 9.4h-2.8M20.6 14.6h-2.8" />
    </>
  ),
  database: (
    <>
      <ellipse cx="12" cy="6" rx="7" ry="3" />
      <path d="M5 6v12c0 1.66 3.13 3 7 3s7-1.34 7-3V6" />
      <path d="M5 12c0 1.66 3.13 3 7 3s7-1.34 7-3" />
    </>
  ),
  font: page(<path d="M8.5 13h5M11 13v4.5" />),
  keycert: (
    <>
      <circle cx="9" cy="9" r="4.3" />
      <path d="M12.1 12.1L20 20M16.8 16.8l2.2-2.2M14.3 14.3l1.8-1.8" />
    </>
  ),
};

export function FileIcon({
  name,
  kind,
  size = 16,
}: {
  name: string;
  kind: EntryKind;
  size?: number;
}) {
  const category: Category =
    kind === "dir" ? "folder" : kind === "symlink" ? "generic" : categorize(name);
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ color: COLOR[category], flex: "0 0 auto", display: "block" }}
      aria-hidden="true"
    >
      {GLYPH[category]}
    </svg>
  );
}
