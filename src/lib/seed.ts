import fs from "fs";
import path from "path";
import type { Analyte, LimitTable, PlantLine, SeedReport } from "./types";

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
  cache = {
    analytes,
    analyteByKey: new Map(analytes.map((a) => [a.key, a])),
    tables,
    lines: plantFile.lines,
    plant: plantFile.plant,
    producers,
    reports,
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

export function seedPdfPath(rel: string): string {
  return path.join(SEED_DIR, "reports", rel);
}
