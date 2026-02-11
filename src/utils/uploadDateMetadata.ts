const EXIF_DATE_TIME_TAG = 0x0132;
const EXIF_IFD_POINTER_TAG = 0x8769;
const EXIF_DATE_TIME_ORIGINAL_TAG = 0x9003;
const EXIF_CREATE_DATE_TAG = 0x9004;
const QUICKTIME_UNIX_EPOCH_OFFSET_SECONDS = 2_082_844_800;
const MAX_JPEG_EXIF_SCAN_BYTES = 512 * 1024;

type Endianness = "little" | "big";

type BoxHeader = {
  type: string;
  size: number;
  headerSize: number;
};

const textDecoder = new TextDecoder();

function getFileExtension(fileName: string): string {
  const idx = fileName.lastIndexOf(".");
  if (idx < 0) return "";
  return fileName.slice(idx + 1).toLowerCase();
}

function formatDateInputLocal(date: Date): string {
  if (Number.isNaN(date.getTime())) return "";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseExifDateString(value: string): string | null {
  const trimmed = value.trim().replace(/\0/g, "");
  const match = trimmed.match(
    /^(\d{4}):(\d{2}):(\d{2})(?:[ T](\d{2}):(\d{2}):(\d{2}))?$/,
  );
  if (!match) return null;

  const [, year, month, day] = match;
  return `${year}-${month}-${day}`;
}

function readAscii(
  view: DataView,
  start: number,
  length: number,
  limit: number,
): string {
  if (start < 0 || length <= 0 || start + length > limit) return "";
  const bytes = new Uint8Array(view.buffer, view.byteOffset + start, length);
  return textDecoder.decode(bytes);
}

function readUint16(view: DataView, offset: number, endianness: Endianness): number {
  return view.getUint16(offset, endianness === "little");
}

function readUint32(view: DataView, offset: number, endianness: Endianness): number {
  return view.getUint32(offset, endianness === "little");
}

function getIfdAsciiTagValue(
  view: DataView,
  tiffStart: number,
  ifdOffset: number,
  tag: number,
  endianness: Endianness,
): string | null {
  const tiffEnd = view.byteLength;
  const ifdStart = tiffStart + ifdOffset;
  if (ifdStart < tiffStart || ifdStart + 2 > tiffEnd) return null;

  const entryCount = readUint16(view, ifdStart, endianness);
  for (let i = 0; i < entryCount; i += 1) {
    const entryStart = ifdStart + 2 + i * 12;
    if (entryStart + 12 > tiffEnd) break;

    const entryTag = readUint16(view, entryStart, endianness);
    if (entryTag !== tag) continue;

    const type = readUint16(view, entryStart + 2, endianness);
    const count = readUint32(view, entryStart + 4, endianness);
    if (type !== 2 || count === 0) return null;

    const valueField = entryStart + 8;
    const valueStart =
      count <= 4
        ? valueField
        : tiffStart + readUint32(view, valueField, endianness);
    if (valueStart < tiffStart || valueStart + count > tiffEnd) return null;

    const raw = readAscii(view, valueStart, count, tiffEnd);
    return raw.replace(/\0+$/, "");
  }

  return null;
}

function getIfdUintTagValue(
  view: DataView,
  tiffStart: number,
  ifdOffset: number,
  tag: number,
  endianness: Endianness,
): number | null {
  const tiffEnd = view.byteLength;
  const ifdStart = tiffStart + ifdOffset;
  if (ifdStart < tiffStart || ifdStart + 2 > tiffEnd) return null;

  const entryCount = readUint16(view, ifdStart, endianness);
  for (let i = 0; i < entryCount; i += 1) {
    const entryStart = ifdStart + 2 + i * 12;
    if (entryStart + 12 > tiffEnd) break;

    const entryTag = readUint16(view, entryStart, endianness);
    if (entryTag !== tag) continue;

    const type = readUint16(view, entryStart + 2, endianness);
    const count = readUint32(view, entryStart + 4, endianness);
    if (count !== 1) return null;

    const valueOffset = entryStart + 8;
    if (type === 3) {
      return readUint16(view, valueOffset, endianness);
    }
    if (type === 4) {
      return readUint32(view, valueOffset, endianness);
    }

    return null;
  }

  return null;
}

function parseJpegExifDate(buffer: ArrayBufferLike): string | null {
  const view = new DataView(buffer);
  if (view.byteLength < 4) return null;
  if (view.getUint16(0) !== 0xffd8) return null;

  let offset = 2;
  while (offset + 4 <= view.byteLength) {
    if (view.getUint8(offset) !== 0xff) break;

    const marker = view.getUint8(offset + 1);
    if (marker === 0xda || marker === 0xd9) break;

    const segmentLength = view.getUint16(offset + 2);
    if (segmentLength < 2) break;
    const segmentDataStart = offset + 4;
    const segmentDataLength = segmentLength - 2;
    const nextOffset = offset + 2 + segmentLength;
    if (nextOffset > view.byteLength) break;

    if (
      marker === 0xe1 &&
      segmentDataLength >= 6 &&
      readAscii(view, segmentDataStart, 6, view.byteLength) === "Exif\0\0"
    ) {
      const tiffStart = segmentDataStart + 6;
      if (tiffStart + 8 > view.byteLength) return null;

      const byteOrder = readAscii(view, tiffStart, 2, view.byteLength);
      const endianness: Endianness =
        byteOrder === "II" ? "little" : byteOrder === "MM" ? "big" : "big";

      const tiffMagic = readUint16(view, tiffStart + 2, endianness);
      if (tiffMagic !== 42) return null;

      const ifd0Offset = readUint32(view, tiffStart + 4, endianness);
      if (ifd0Offset <= 0) return null;

      const dateFromIfd0 = getIfdAsciiTagValue(
        view,
        tiffStart,
        ifd0Offset,
        EXIF_DATE_TIME_TAG,
        endianness,
      );

      const exifIfdOffset = getIfdUintTagValue(
        view,
        tiffStart,
        ifd0Offset,
        EXIF_IFD_POINTER_TAG,
        endianness,
      );

      const dateFromExifIfd =
        exifIfdOffset != null
          ? getIfdAsciiTagValue(
              view,
              tiffStart,
              exifIfdOffset,
              EXIF_DATE_TIME_ORIGINAL_TAG,
              endianness,
            ) ??
            getIfdAsciiTagValue(
              view,
              tiffStart,
              exifIfdOffset,
              EXIF_CREATE_DATE_TAG,
              endianness,
            )
          : null;

      const parsed = parseExifDateString(dateFromExifIfd ?? dateFromIfd0 ?? "");
      if (parsed) return parsed;
    }

    offset = nextOffset;
  }

  return null;
}

async function readFileSlice(
  file: File,
  start: number,
  byteLength: number,
): Promise<DataView | null> {
  if (start < 0 || byteLength <= 0 || start >= file.size) return null;
  const end = Math.min(file.size, start + byteLength);
  const slice = file.slice(start, end);
  const buf = await blobToArrayBuffer(slice);
  return new DataView(buf);
}

async function blobToArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
  const maybeHasArrayBuffer = blob as Blob & {
    arrayBuffer?: () => Promise<ArrayBuffer>;
  };
  if (typeof maybeHasArrayBuffer.arrayBuffer === "function") {
    return maybeHasArrayBuffer.arrayBuffer();
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (reader.result instanceof ArrayBuffer) {
        resolve(reader.result);
        return;
      }
      reject(new Error("Blob read did not return an ArrayBuffer"));
    };
    reader.onerror = () => {
      reject(reader.error ?? new Error("Failed to read blob data"));
    };
    reader.readAsArrayBuffer(blob);
  });
}

function readMp4Type(view: DataView, offset: number): string {
  return readAscii(view, offset, 4, view.byteLength);
}

function toSafeNumberFromUint64(high: number, low: number): number | null {
  const value = high * 2 ** 32 + low;
  if (!Number.isFinite(value) || value > Number.MAX_SAFE_INTEGER) return null;
  return value;
}

async function readBoxHeader(file: File, offset: number): Promise<BoxHeader | null> {
  const header = await readFileSlice(file, offset, 16);
  if (!header || header.byteLength < 8) return null;

  const size32 = header.getUint32(0, false);
  const type = readMp4Type(header, 4);

  if (size32 === 0) {
    return {
      type,
      headerSize: 8,
      size: file.size - offset,
    };
  }

  if (size32 === 1) {
    if (header.byteLength < 16) return null;
    const high = header.getUint32(8, false);
    const low = header.getUint32(12, false);
    const fullSize = toSafeNumberFromUint64(high, low);
    if (!fullSize || fullSize < 16) return null;
    return { type, size: fullSize, headerSize: 16 };
  }

  if (size32 < 8) return null;
  return { type, size: size32, headerSize: 8 };
}

async function parseMvhdCreationDate(
  file: File,
  payloadOffset: number,
  payloadLength: number,
): Promise<string | null> {
  const needed = Math.min(payloadLength, 24);
  const view = await readFileSlice(file, payloadOffset, needed);
  if (!view || view.byteLength < 8) return null;

  const version = view.getUint8(0);
  let creationSeconds: number | null = null;

  if (version === 1) {
    if (view.byteLength < 20) return null;
    const high = view.getUint32(4, false);
    const low = view.getUint32(8, false);
    creationSeconds = toSafeNumberFromUint64(high, low);
  } else {
    creationSeconds = view.getUint32(4, false);
  }

  if (!creationSeconds || creationSeconds <= 0) return null;

  const unixSeconds =
    creationSeconds > QUICKTIME_UNIX_EPOCH_OFFSET_SECONDS
      ? creationSeconds - QUICKTIME_UNIX_EPOCH_OFFSET_SECONDS
      : creationSeconds;
  if (unixSeconds <= 0) return null;

  const date = new Date(unixSeconds * 1000);
  const formatted = formatDateInputLocal(date);
  return formatted || null;
}

async function parseQuickTimeContainerDate(file: File): Promise<string | null> {
  let offset = 0;
  let depthGuard = 0;

  while (offset + 8 <= file.size && depthGuard < 512) {
    depthGuard += 1;
    const header = await readBoxHeader(file, offset);
    if (!header || header.size <= 0) break;

    if (header.type === "moov") {
      const moovEnd = offset + header.size;
      let childOffset = offset + header.headerSize;
      let childGuard = 0;
      while (childOffset + 8 <= moovEnd && childGuard < 512) {
        childGuard += 1;
        const childHeader = await readBoxHeader(file, childOffset);
        if (!childHeader || childHeader.size <= 0) break;
        if (childHeader.type === "mvhd") {
          const parsed = await parseMvhdCreationDate(
            file,
            childOffset + childHeader.headerSize,
            childHeader.size - childHeader.headerSize,
          );
          if (parsed) return parsed;
          break;
        }
        childOffset += childHeader.size;
      }
    }

    offset += header.size;
  }

  return null;
}

function isLikelyJpeg(file: File): boolean {
  const ext = getFileExtension(file.name);
  return (
    ext === "jpg" ||
    ext === "jpeg" ||
    file.type === "image/jpeg" ||
    file.type === "image/jpg"
  );
}

function isLikelyQuickTimeContainer(file: File): boolean {
  const ext = getFileExtension(file.name);
  return (
    ext === "mov" ||
    ext === "mp4" ||
    file.type === "video/quicktime" ||
    file.type === "video/mp4"
  );
}

export async function inferUploadDateFromMetadata(
  file: File,
): Promise<string | null> {
  try {
    if (isLikelyJpeg(file)) {
      const scanSize = Math.min(file.size, MAX_JPEG_EXIF_SCAN_BYTES);
      const view = await readFileSlice(file, 0, scanSize);
      if (view) {
        const parsed = parseJpegExifDate(view.buffer);
        if (parsed) return parsed;
      }
    }

    if (isLikelyQuickTimeContainer(file)) {
      const parsed = await parseQuickTimeContainerDate(file);
      if (parsed) return parsed;
    }
  } catch {
    // Best-effort only, fallback below.
  }

  if (file.lastModified > 0) {
    const fallback = formatDateInputLocal(new Date(file.lastModified));
    if (fallback) return fallback;
  }

  return null;
}
