import fs from "fs";
import path from "path";
import type { Analyte, LimitTable, MovementRecord, PlantLine, SeedReport } from "./types";

const SEED_DIR = path.join(process.cwd(), "seed");

function readJson<T>(rel: string): T {
  return JSON.parse(fs.readFileSync(path.join(SEED_DIR, rel), "utf-8")) as T;
}

let cache: {
  analytes: Analyte[];
  analyteByKey: Map<string, Analyte>;
  tables: LimitTable[];
  lines: PlantLine[];
  plant: { id: string; name: string; authorization: { reference: string } };
  producers: { id: string; name: string }[];
  reports: SeedReport[];
  movements: MovementRecord[];
} | null = null;

export function getSeed() {
  if (cache) return cache;
  const analytes = readJson<{ analytes: Analyte[] }>("analytes.json").analytes;
  const tablesDir = path.join(SEED_DIR, "limit-tables");
  const tables = fs
    .readdirSync(tablesDir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(fs.readFileSync(path.join(tablesDir, f), "utf-8")) as LimitTable);
  const plantFile = readJson<{ plant: never; lines: PlantLine[] }>("plant.json") as unknown as {
    plant: { id: string; name: string; authorization: { reference: string } };
    lines: PlantLine[];
  };
  const producers = readJson<{ producers: { id: string; name: string }[] }>("producers.json").producers;
  const reportsDir = path.join(SEED_DIR, "reports");
  const reports = fs
    .readdirSync(reportsDir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(fs.readFileSync(path.join(reportsDir, f), "utf-8")) as SeedReport);
  const movements = readJson<{ movements: MovementRecord[] }>("movements.json").movements;
  cache = {
    analytes,
    analyteByKey: new Map(analytes.map((a) => [a.key, a])),
    tables,
    lines: plantFile.lines,
    plant: plantFile.plant,
    producers,
    reports,
    movements,
  };
  return cache;
}

export function getTable(id: string): LimitTable | undefined {
  return getSeed().tables.find((t) => t.id === id);
}

export function getLine(id: string): PlantLine | undefined {
  return getSeed().lines.find((l) => l.id === id);
}

export function analyteLabel(key: string): string {
  return getSeed().analyteByKey.get(key)?.label ?? key;
}

/**
 * The line every verification refers to unless the user picks another one.
 * Pass the plant's configured lines (store.lines()) when available; without an
 * argument the static seed lines are used.
 */
export function defaultLineId(lines: PlantLine[] = getSeed().lines): string {
  return (lines[0] ?? getSeed().lines[0]).id;
}

/**
 * The standard limit table of a line: the binding flagged `primary`, i.e. the
 * table an acceptance check compares against by default. Blocking bindings
 * (POP) are an extra layer and are never the standard comparison.
 * Pass the plant's configured lines (store.lines()) when available.
 */
export function standardTableId(
  lineId?: string | null,
  lines: PlantLine[] = getSeed().lines,
): string {
  const seed = getSeed();
  const line =
    (lineId ? lines.find((l) => l.id === lineId) : null) ?? lines[0] ?? seed.lines[0];
  const bindings = line.limit_bindings.filter((b) => !b.blocking);
  const primary = bindings.find((b) => b.primary) ?? bindings[0];
  return primary?.limit_table_id ?? seed.tables[0].id;
}

/** True for tables bound to the line as a blocking layer (e.g. the POP check). */
export function isBlockingTable(tableId: string): boolean {
  return Boolean(getTable(tableId)?.blocking);
}

export function seedPdfPath(rel: string): string {
  return path.join(SEED_DIR, "reports", rel);
}
