/**
 * Backfill GPS location for legacy Firestore docs from a Google Takeout export.
 *
 * Walks an unzipped Takeout folder for *.json sidecars, builds a filename → GPS
 * index, then patches images/* and videos/* docs that are missing `location`.
 *
 * Usage:
 *   npm run backfill:gps -- --takeout <path> [--dry-run]
 *
 * Requires ./serviceAccountKey.json (gitignored) — download from
 * Firebase Console → Project Settings → Service Accounts → Generate new key.
 */

import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { initializeApp, cert, type ServiceAccount } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

type GpsLocation = { lat: number; lng: number };

interface CliArgs {
  takeoutPath: string;
  serviceAccount: string;
  dryRun: boolean;
}

function printHelp(): void {
  console.log(`
Backfill GPS location for legacy Firestore docs from a Google Takeout export.

Usage:
  npm run backfill:gps -- --takeout <path> [options]

Options:
  -t, --takeout <path>          Path to unzipped Google Takeout export
  -s, --service-account <path>  Firebase service account JSON
                                (default: ./serviceAccountKey.json)
      --dry-run                 Preview matches without writing to Firestore
  -h, --help                    Show this help

Example:
  npm run backfill:gps -- --takeout ~/Downloads/Takeout --dry-run
`);
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  let takeoutPath = "";
  let serviceAccount = path.resolve("serviceAccountKey.json");
  let dryRun = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--takeout" || arg === "-t") {
      takeoutPath = path.resolve(args[++i] ?? "");
    } else if (arg === "--service-account" || arg === "-s") {
      serviceAccount = path.resolve(args[++i] ?? "");
    } else if (arg === "--dry-run") {
      dryRun = true;
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else {
      console.error(`Unknown argument: ${arg}`);
      printHelp();
      process.exit(1);
    }
  }

  if (!takeoutPath) {
    console.error("Missing required --takeout <path>");
    printHelp();
    process.exit(1);
  }

  return { takeoutPath, serviceAccount, dryRun };
}

function isValidGps(lat: unknown, lng: unknown): boolean {
  if (typeof lat !== "number" || typeof lng !== "number") return false;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return false;
  // Google writes (0, 0) when GPS is unavailable.
  if (lat === 0 && lng === 0) return false;
  return true;
}

function extractGpsFromSidecar(json: unknown): GpsLocation | null {
  if (typeof json !== "object" || json === null) return null;
  const obj = json as Record<string, unknown>;

  for (const key of ["geoDataExif", "geoData"] as const) {
    const geo = obj[key];
    if (typeof geo !== "object" || geo === null) continue;
    const g = geo as Record<string, unknown>;
    if (isValidGps(g.latitude, g.longitude)) {
      return { lat: g.latitude as number, lng: g.longitude as number };
    }
  }

  return null;
}

function extractFilenameFromSidecar(json: unknown, fallback: string): string {
  if (typeof json === "object" && json !== null) {
    const obj = json as Record<string, unknown>;
    if (typeof obj.title === "string" && obj.title.trim().length > 0) {
      return obj.title;
    }
  }
  return fallback;
}

function sidecarToMediaName(sidecarPath: string): string {
  const name = path.basename(sidecarPath);
  return name
    .replace(/\.supplemental-metadata\.json$/i, "")
    .replace(/\.supplemental-meta\.json$/i, "")
    .replace(/\.json$/i, "");
}

async function* walkSidecars(dir: string): AsyncGenerator<string> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch (err) {
    console.warn(`Skipping ${dir}: ${(err as Error).message}`);
    return;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walkSidecars(full);
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".json")) {
      yield full;
    }
  }
}

function indexFilename(
  map: Map<string, GpsLocation>,
  filename: string,
  gps: GpsLocation,
): void {
  const lower = filename.toLowerCase();
  if (!map.has(lower)) map.set(lower, gps);

  const dotIdx = lower.lastIndexOf(".");
  if (dotIdx > 0) {
    const baseLower = lower.slice(0, dotIdx);
    if (!map.has(baseLower)) map.set(baseLower, gps);
  }
}

async function buildGpsMap(takeoutPath: string): Promise<Map<string, GpsLocation>> {
  const map = new Map<string, GpsLocation>();
  let scanned = 0;
  let withGps = 0;

  for await (const sidecar of walkSidecars(takeoutPath)) {
    scanned++;
    let json: unknown;
    try {
      const raw = await readFile(sidecar, "utf8");
      json = JSON.parse(raw);
    } catch {
      continue;
    }

    const gps = extractGpsFromSidecar(json);
    if (!gps) continue;

    const fallbackName = sidecarToMediaName(sidecar);
    const filename = extractFilenameFromSidecar(json, fallbackName);
    indexFilename(map, filename, gps);
    indexFilename(map, fallbackName, gps);
    withGps++;
  }

  console.log(`Scanned ${scanned} sidecars; ${withGps} contained valid GPS.`);
  return map;
}

function lookupGps(
  map: Map<string, GpsLocation>,
  id: string,
): GpsLocation | null {
  const lower = id.toLowerCase();
  const exact = map.get(lower);
  if (exact) return exact;

  const dotIdx = lower.lastIndexOf(".");
  if (dotIdx > 0) {
    const base = lower.slice(0, dotIdx);
    const baseMatch = map.get(base);
    if (baseMatch) return baseMatch;

    const suffixStripped = base.replace(/-\d+$/, "");
    if (suffixStripped !== base) {
      const stripped = map.get(suffixStripped);
      if (stripped) return stripped;
    }
  }

  return null;
}

interface BackfillStats {
  matched: number;
  unmatched: number;
  skipped: number;
  errors: number;
}

async function backfillCollection(
  db: Firestore,
  collectionName: "images" | "videos",
  gpsMap: Map<string, GpsLocation>,
  dryRun: boolean,
  unmatched: string[],
): Promise<BackfillStats> {
  const stats: BackfillStats = { matched: 0, unmatched: 0, skipped: 0, errors: 0 };
  const snap = await db.collection(collectionName).get();
  console.log(`\n${collectionName}: ${snap.size} docs`);

  for (const docSnap of snap.docs) {
    const data = docSnap.data();

    if (data.location) {
      stats.skipped++;
      continue;
    }

    const id = (data.id as string | undefined) ?? docSnap.id;
    const gps = lookupGps(gpsMap, id);

    if (!gps) {
      stats.unmatched++;
      unmatched.push(`${collectionName}/${id}`);
      continue;
    }

    if (dryRun) {
      console.log(`[dry] ${collectionName}/${id} → ${gps.lat}, ${gps.lng}`);
      stats.matched++;
    } else {
      try {
        await docSnap.ref.update({ location: gps });
        console.log(`[ok ] ${collectionName}/${id} → ${gps.lat}, ${gps.lng}`);
        stats.matched++;
      } catch (err) {
        stats.errors++;
        console.error(`[err] ${collectionName}/${id}: ${(err as Error).message}`);
      }
    }
  }

  return stats;
}

async function main(): Promise<void> {
  const args = parseArgs();

  console.log(`Takeout:         ${args.takeoutPath}`);
  console.log(`Service account: ${args.serviceAccount}`);
  console.log(`Mode:            ${args.dryRun ? "dry-run" : "WRITE"}\n`);

  console.log("Indexing Takeout sidecars...");
  const gpsMap = await buildGpsMap(args.takeoutPath);
  console.log(`Indexed ${gpsMap.size} unique filename keys with GPS.`);

  let serviceAccountJson: ServiceAccount;
  try {
    const raw = await readFile(args.serviceAccount, "utf8");
    serviceAccountJson = JSON.parse(raw) as ServiceAccount;
  } catch (err) {
    console.error(`Failed to read service account: ${(err as Error).message}`);
    process.exit(1);
  }

  initializeApp({ credential: cert(serviceAccountJson) });
  const db = getFirestore();

  const unmatched: string[] = [];
  const imageStats = await backfillCollection(db, "images", gpsMap, args.dryRun, unmatched);
  const videoStats = await backfillCollection(db, "videos", gpsMap, args.dryRun, unmatched);

  const total: BackfillStats = {
    matched: imageStats.matched + videoStats.matched,
    unmatched: imageStats.unmatched + videoStats.unmatched,
    skipped: imageStats.skipped + videoStats.skipped,
    errors: imageStats.errors + videoStats.errors,
  };

  console.log("\n=== Summary ===");
  console.log(`Matched ${args.dryRun ? "(would write)" : "(written)   "}: ${total.matched}`);
  console.log(`Already had location:    ${total.skipped}`);
  console.log(`Unmatched:               ${total.unmatched}`);
  if (total.errors > 0) console.log(`Errors:                  ${total.errors}`);

  if (unmatched.length > 0) {
    const outPath = path.resolve("scripts/unmatched-gps.txt");
    await writeFile(outPath, unmatched.join("\n") + "\n", "utf8");
    console.log(`\nUnmatched list written to: ${outPath}`);
    console.log("(These items need a different backfill path — see B1/B4 in the plan.)");
  }

  if (args.dryRun) {
    console.log("\nDry run — no writes made. Re-run without --dry-run to apply.");
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
