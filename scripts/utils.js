/**
 * Shared utilities for seed scripts.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Parse a newline-delimited JSON file (one JSON object per line).
 * Skips blank lines and lines that fail to parse, printing a warning.
 */
export function readJsonLines(filePath) {
  return fs
    .readFileSync(filePath, "utf-8")
    .split("\n")
    .reduce((acc, line, i) => {
      const trimmed = line.trim();
      if (!trimmed) return acc;
      try {
        acc.push(JSON.parse(trimmed));
      } catch {
        console.warn(`  ⚠️  Skipping malformed line ${i + 1}: ${trimmed.slice(0, 70)}…`);
      }
      return acc;
    }, []);
}

/**
 * Load regions.json and return a Map<id, name>.
 */
export function loadRegionMap() {
  const regionsPath = path.join(__dirname, "../regions.json");
  const regions = readJsonLines(regionsPath);
  const map = new Map();
  for (const r of regions) {
    if (r.id != null && r.name) map.set(r.id, r.name);
  }
  return map;
}
