/**
 * Shared utilities for seed scripts.
 */
import fs from "fs";
import path from "path";

/**
 * Parse a newline-delimited JSON file (one JSON object per line).
 *
 * psql's text-format COPY doubles every backslash, which turns an escaped quote
 * inside a name (\\") into invalid JSON. Lines that fail to parse are retried
 * with the doubling undone. With { strict: true } a line that still fails
 * aborts the run instead of being silently dropped.
 */
export function readJsonLines(filePath, { strict = false } = {}) {
  return fs
    .readFileSync(filePath, "utf-8")
    .split("\n")
    .reduce((acc, line, i) => {
      const trimmed = line.trim();
      if (!trimmed) return acc;
      try {
        acc.push(JSON.parse(trimmed));
      } catch {
        try {
          acc.push(JSON.parse(trimmed.replace(/\\\\/g, "\\")));
        } catch {
          const where = `${path.basename(filePath)} line ${i + 1}`;
          if (strict) throw new Error(`Unparseable JSON at ${where}: ${trimmed.slice(0, 70)}…`);
          console.warn(`  ⚠️  Skipping malformed line at ${where}: ${trimmed.slice(0, 70)}…`);
        }
      }
      return acc;
    }, []);
}
