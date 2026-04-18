/**
 * Backfill GPS location for legacy Firestore docs from a folder of original media files.
 *
 * Walks a directory recursively, reads GPS from each image's EXIF (and each video's
 * container metadata via exiftool, when available), builds a filename → GPS index,
 * then patches images/* and videos/* docs that are missing `location`.
 *
 * Source the folder however you like — e.g.:
 *   - macOS Photos.app: File → Export → Export Unmodified Originals → save to a folder
 *   - iCloud Drive folder
 *   - USB photo dump
 *
 * Storage files are never touched. We only add a `location` field to Firestore docs.
 *
 * Usage:
 *   npm run backfill:gps -- --media <path> [--dry-run] [--no-videos]
 *
 * Image GPS uses `exifr` (already installed).
 * Video GPS requires `exiftool` (install with: brew install exiftool).
 * Without exiftool, videos are skipped automatically.
 *
 * Requires ./serviceAccountKey.json (gitignored). Get one from Firebase Console →
 * Project Settings → Service Accounts → Generate New Key.
 */

import { readdir, readFile, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import process from "node:process";
import exifr from "exifr";
import { initializeApp, cert, type ServiceAccount } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

const execFileAsync = promisify(execFile);

type GpsLocation = { lat: number; lng: number };

interface CliArgs {
  mediaPath: string;
  serviceAccount: string;
  dryRun: boolean;
  skipVideos: boolean;
}

const IMAGE_EXTS = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".heic",
  ".heif",
  ".tif",
  ".tiff",
]);
const VIDEO_EXTS = new Set([".mp4", ".mov", ".m4v"]);

function printHelp(): void {
  console.log(`
Backfill GPS location for legacy Firestore docs from a folder of original media files.

Usage:
  npm run backfill:gps -- --media <path> [options]

Options:
  -m, --media <path>            Path to folder of original media files
  -s, --service-account <path>  Firebase service account JSON
                                (default: ./serviceAccountKey.json)
      --dry-run                 Preview matches without writing to Firestore
      --no-videos               Skip video files entirely
  -h, --help                    Show this help

Image GPS extraction uses exifr (already installed).
Video GPS extraction requires exiftool — install with: brew install exiftool

Example:
  npm run backfill:gps -- --media ~/Desktop/icloud-export --dry-run
`);
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  let mediaPath = "";
  let serviceAccount = path.resolve("serviceAccountKey.json");
  let dryRun = false;
  let skipVideos = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--media" || arg === "-m") {
      mediaPath = path.resolve(args[++i] ?? "");
    } else if (arg === "--service-account" || arg === "-s") {
      serviceAccount = path.resolve(args[++i] ?? "");
    } else if (arg === "--dry-run") {
      dryRun = true;
    } else if (arg === "--no-videos") {
      skipVideos = true;
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else {
      console.error(`Unknown argument: ${arg}`);
      printHelp();
      process.exit(1);
    }
  }

  if (!mediaPath) {
    console.error("Missing required --media <path>");
    printHelp();
    process.exit(1);
  }

  return { mediaPath, serviceAccount, dryRun, skipVideos };
}

function isValidGps(lat: unknown, lng: unknown): boolean {
  if (typeof lat !== "number" || typeof lng !== "number") return false;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return false;
  if (lat === 0 && lng === 0) return false;
  return true;
}

interface MediaFile {
  fullPath: string;
  filename: string;
  kind: "image" | "video";
}

async function* walkMedia(dir: string): AsyncGenerator<MediaFile> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch (err) {
    console.warn(`Skipping ${dir}: ${(err as Error).message}`);
    return;
  }
  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walkMedia(full);
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (IMAGE_EXTS.has(ext)) {
        yield { fullPath: full, filename: entry.name, kind: "image" };
      } else if (VIDEO_EXTS.has(ext)) {
        yield { fullPath: full, filename: entry.name, kind: "video" };
      }
    }
  }
}

async function readImageGps(filePath: string): Promise<GpsLocation | null> {
  try {
    const gps = await exifr.gps(filePath);
    if (!gps) return null;
    if (!isValidGps(gps.latitude, gps.longitude)) return null;
    return { lat: gps.latitude, lng: gps.longitude };
  } catch {
    return null;
  }
}

async function hasExiftool(): Promise<boolean> {
  try {
    await execFileAsync("exiftool", ["-ver"]);
    return true;
  } catch {
    return false;
  }
}

async function readVideoGpsBatch(
  filePaths: string[],
): Promise<Map<string, GpsLocation>> {
  const result = new Map<string, GpsLocation>();
  if (filePaths.length === 0) return result;

  const CHUNK_SIZE = 100;
  for (let i = 0; i < filePaths.length; i += CHUNK_SIZE) {
    const chunk = filePaths.slice(i, i + CHUNK_SIZE);
    let stdout: string;
    try {
      const { stdout: out } = await execFileAsync(
        "exiftool",
        ["-j", "-n", "-GPSLatitude", "-GPSLongitude", ...chunk],
        { maxBuffer: 64 * 1024 * 1024 },
      );
      stdout = out;
    } catch (err) {
      console.warn(`exiftool batch failed: ${(err as Error).message}`);
      continue;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(stdout);
    } catch {
      continue;
    }

    if (!Array.isArray(parsed)) continue;
    for (const entry of parsed) {
      if (typeof entry !== "object" || entry === null) continue;
      const e = entry as Record<string, unknown>;
      const sourceFile = typeof e.SourceFile === "string" ? e.SourceFile : null;
      const lat = e.GPSLatitude;
      const lng = e.GPSLongitude;
      if (!sourceFile || !isValidGps(lat, lng)) continue;
      result.set(sourceFile, { lat: lat as number, lng: lng as number });
    }
  }

  return result;
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

async function buildGpsMap(
  mediaPath: string,
  skipVideos: boolean,
): Promise<Map<string, GpsLocation>> {
  const map = new Map<string, GpsLocation>();
  const videoFiles: MediaFile[] = [];

  let imageCount = 0;
  let imageWithGps = 0;
  let videoCount = 0;

  console.log("Scanning media folder...");
  for await (const file of walkMedia(mediaPath)) {
    if (file.kind === "image") {
      imageCount++;
      const gps = await readImageGps(file.fullPath);
      if (gps) {
        indexFilename(map, file.filename, gps);
        imageWithGps++;
      }
      if (imageCount % 25 === 0) {
        process.stdout.write(
          `\r  images scanned: ${imageCount} (${imageWithGps} with GPS)`,
        );
      }
    } else if (file.kind === "video") {
      videoCount++;
      videoFiles.push(file);
    }
  }
  if (imageCount > 0) process.stdout.write("\n");
  console.log(`Images: ${imageCount} scanned, ${imageWithGps} with GPS.`);

  if (videoCount > 0) {
    console.log(`Videos: ${videoCount} found.`);
    if (skipVideos) {
      console.log("  --no-videos set, skipping.");
    } else {
      const exiftoolAvailable = await hasExiftool();
      if (!exiftoolAvailable) {
        console.log("  exiftool not installed — skipping videos.");
        console.log("  To extract video GPS: brew install exiftool, then re-run.");
      } else {
        console.log("  Running exiftool to extract GPS...");
        const videoGps = await readVideoGpsBatch(
          videoFiles.map((v) => v.fullPath),
        );
        let videoWithGps = 0;
        for (const file of videoFiles) {
          const gps = videoGps.get(file.fullPath);
          if (gps) {
            indexFilename(map, file.filename, gps);
            videoWithGps++;
          }
        }
        console.log(`  ${videoWithGps} videos had GPS.`);
      }
    }
  }

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

  console.log(`Media folder:    ${args.mediaPath}`);
  console.log(`Service account: ${args.serviceAccount}`);
  console.log(`Mode:            ${args.dryRun ? "dry-run" : "WRITE"}`);
  console.log(
    `Videos:          ${args.skipVideos ? "skipped" : "included if exiftool present"}\n`,
  );

  const gpsMap = await buildGpsMap(args.mediaPath, args.skipVideos);
  console.log(`\nIndexed ${gpsMap.size} unique filename keys with GPS.`);

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
  const imageStats = await backfillCollection(
    db,
    "images",
    gpsMap,
    args.dryRun,
    unmatched,
  );
  const videoStats = await backfillCollection(
    db,
    "videos",
    gpsMap,
    args.dryRun,
    unmatched,
  );

  const total: BackfillStats = {
    matched: imageStats.matched + videoStats.matched,
    unmatched: imageStats.unmatched + videoStats.unmatched,
    skipped: imageStats.skipped + videoStats.skipped,
    errors: imageStats.errors + videoStats.errors,
  };

  console.log("\n=== Summary ===");
  console.log(
    `Matched ${args.dryRun ? "(would write)" : "(written)   "}: ${total.matched}`,
  );
  console.log(`Already had location:    ${total.skipped}`);
  console.log(`Unmatched:               ${total.unmatched}`);
  if (total.errors > 0) console.log(`Errors:                  ${total.errors}`);

  if (unmatched.length > 0) {
    const outPath = path.resolve("scripts/unmatched-gps.txt");
    await writeFile(outPath, unmatched.join("\n") + "\n", "utf8");
    console.log(`\nUnmatched list written to: ${outPath}`);
    console.log("(These items had no matching file in the export folder.)");
  }

  if (args.dryRun) {
    console.log("\nDry run — no writes made. Re-run without --dry-run to apply.");
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
