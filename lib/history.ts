/**
 * Scan history, kept in the browser only (localStorage).
 *
 * Nothing here is sent to the server. Stored data is treated as untrusted:
 * anything that does not match the ScanReport shape is dropped on read, so a
 * corrupted or hand-edited entry cannot crash the results view. (All values
 * are rendered as React text nodes, so they cannot inject markup either.)
 */

import { useSyncExternalStore } from "react";
import { CHECK_WEIGHTS, type CheckResult, type Grade } from "./checks";
import type { ScanReport } from "./scanner";

export const HISTORY_STORAGE_KEY = "sitesentinel-history";
export const MAX_HISTORY = 25;

export interface HistoryEntry {
  id: string;
  report: ScanReport;
}

const EMPTY: HistoryEntry[] = [];
const GRADES = new Set<Grade>(["A", "B", "C", "D", "E", "F"]);
const STATUSES = new Set(["pass", "warn", "fail"]);
const CHECK_IDS = new Set(Object.keys(CHECK_WEIGHTS));

const listeners = new Set<() => void>();
let cache: { raw: string | null; entries: HistoryEntry[] } | null = null;
/** Used when localStorage is unavailable or full, so history still works for this page view. */
let memoryOnly: HistoryEntry[] | null = null;

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isStr = (v: unknown): v is string => typeof v === "string";

function isCheck(v: unknown): v is CheckResult {
  if (!isObj(v)) return false;
  if (!isStr(v.id) || !CHECK_IDS.has(v.id) || !isStr(v.status) || !STATUSES.has(v.status)) return false;
  if (!isNum(v.weight) || !isNum(v.earned) || !isStr(v.detail)) return false;
  if (v.evidence !== undefined && !isStr(v.evidence)) return false;
  if (v.params !== undefined) {
    if (!isObj(v.params)) return false;
    if (!Object.values(v.params).every((p) => isStr(p) || isNum(p))) return false;
  }
  return true;
}

function isReport(v: unknown): v is ScanReport {
  if (!isObj(v)) return false;
  return (
    isStr(v.inputUrl) &&
    isStr(v.finalUrl) &&
    isNum(v.redirectCount) &&
    isNum(v.statusCode) &&
    isNum(v.score) &&
    isStr(v.grade) &&
    GRADES.has(v.grade as Grade) &&
    isStr(v.scannedAt) &&
    !Number.isNaN(Date.parse(v.scannedAt)) &&
    isNum(v.durationMs) &&
    Array.isArray(v.checks) &&
    v.checks.every(isCheck)
  );
}

function parse(raw: string | null): HistoryEntry[] {
  if (!raw) return EMPTY;
  try {
    const data: unknown = JSON.parse(raw);
    if (!Array.isArray(data)) return EMPTY;
    return data
      .filter((e): e is HistoryEntry => isObj(e) && isStr(e.id) && e.id.length <= 64 && isReport(e.report))
      .slice(0, MAX_HISTORY);
  } catch {
    return EMPTY;
  }
}

function getSnapshot(): HistoryEntry[] {
  if (memoryOnly) return memoryOnly;
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(HISTORY_STORAGE_KEY);
  } catch {
    return EMPTY;
  }
  // Return the same array while the stored string is unchanged (required by useSyncExternalStore).
  if (cache && cache.raw === raw) return cache.entries;
  cache = { raw, entries: parse(raw) };
  return cache.entries;
}

const getServerSnapshot = () => EMPTY;

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  // Keep other tabs in sync.
  const onStorage = (e: StorageEvent) => {
    if (e.key === HISTORY_STORAGE_KEY || e.key === null) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function write(entries: HistoryEntry[]): void {
  try {
    if (entries.length === 0) window.localStorage.removeItem(HISTORY_STORAGE_KEY);
    else window.localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(entries));
    memoryOnly = null;
  } catch {
    // Storage blocked or full: keep the history in memory for this page view.
    memoryOnly = entries;
  }
  listeners.forEach((l) => l());
}

function newId(): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  } catch {
    // randomUUID needs a secure context; fall through
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function useHistory(): HistoryEntry[] {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** Saves a new scan (newest first) and returns its id. */
export function addScan(report: ScanReport): string {
  const id = newId();
  write([{ id, report }, ...getSnapshot()].slice(0, MAX_HISTORY));
  return id;
}

export function removeScan(id: string): void {
  write(getSnapshot().filter((e) => e.id !== id));
}

export function clearHistory(): void {
  write([]);
}

/** Host used to match scans of the same site (the normalised input URL). */
export function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

/** The most recent scan of the same host made before `report`, if any. */
export function findPrevious(entries: HistoryEntry[], id: string | null, report: ScanReport): HistoryEntry | undefined {
  const host = hostOf(report.inputUrl);
  const at = Date.parse(report.scannedAt);
  let best: HistoryEntry | undefined;
  for (const e of entries) {
    if (e.id === id || hostOf(e.report.inputUrl) !== host) continue;
    const t = Date.parse(e.report.scannedAt);
    if (t < at && (!best || t > Date.parse(best.report.scannedAt))) best = e;
  }
  return best;
}


const noopSubscribe = () => () => {};
/** False during server render and hydration, true afterwards (when localStorage can be read). */
export function useHydrated(): boolean {
  return useSyncExternalStore(noopSubscribe, () => true, () => false);
}
