import { describe, expect, it } from "vitest";
import { inferUploadDateFromMetadata } from "../../utils/uploadDateMetadata";

function toLocalDateInput(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function concatUint8Arrays(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((sum, c) => sum + c.length, 0);
  const output = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.length;
  }
  return output;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
}

function makeMp4Box(type: string, payload: Uint8Array): Uint8Array {
  const box = new Uint8Array(8 + payload.length);
  const view = new DataView(box.buffer);
  view.setUint32(0, box.length, false);
  box.set(type.split("").map((c) => c.charCodeAt(0)), 4);
  box.set(payload, 8);
  return box;
}

function makeExifJpeg(dateTimeOriginal: string): Uint8Array {
  const exifValue = `${dateTimeOriginal}\0`;
  if (exifValue.length !== 20) {
    throw new Error("EXIF test value must be 19 chars + null terminator");
  }

  const tiff = new Uint8Array(64);
  const view = new DataView(tiff.buffer);

  // TIFF header: big-endian, magic 42, IFD0 at offset 8
  tiff[0] = 0x4d;
  tiff[1] = 0x4d;
  view.setUint16(2, 42, false);
  view.setUint32(4, 8, false);

  // IFD0: one entry (ExifIFD pointer), then next-IFD offset
  view.setUint16(8, 1, false);
  view.setUint16(10, 0x8769, false); // ExifIFDPointer
  view.setUint16(12, 4, false); // LONG
  view.setUint32(14, 1, false); // count
  view.setUint32(18, 26, false); // Exif IFD offset
  view.setUint32(22, 0, false); // no next IFD

  // Exif IFD: one DateTimeOriginal entry
  view.setUint16(26, 1, false);
  view.setUint16(28, 0x9003, false); // DateTimeOriginal
  view.setUint16(30, 2, false); // ASCII
  view.setUint32(32, 20, false); // count including null
  view.setUint32(36, 44, false); // value offset
  view.setUint32(40, 0, false); // no next IFD

  for (let i = 0; i < exifValue.length; i += 1) {
    tiff[44 + i] = exifValue.charCodeAt(i);
  }

  const exifHeader = new Uint8Array([0x45, 0x78, 0x69, 0x66, 0x00, 0x00]); // "Exif\0\0"
  const app1Payload = concatUint8Arrays([exifHeader, tiff]);
  const app1Len = app1Payload.length + 2;

  const jpeg = new Uint8Array(2 + 2 + 2 + app1Payload.length + 2);
  let offset = 0;
  jpeg[offset++] = 0xff;
  jpeg[offset++] = 0xd8; // SOI
  jpeg[offset++] = 0xff;
  jpeg[offset++] = 0xe1; // APP1
  jpeg[offset++] = (app1Len >> 8) & 0xff;
  jpeg[offset++] = app1Len & 0xff;
  jpeg.set(app1Payload, offset);
  offset += app1Payload.length;
  jpeg[offset++] = 0xff;
  jpeg[offset++] = 0xd9; // EOI

  return jpeg;
}

describe("uploadDateMetadata", () => {
  it("reads DateTimeOriginal from JPEG EXIF", async () => {
    const jpeg = makeExifJpeg("2024:05:12 13:45:59");
    const file = new File([toArrayBuffer(jpeg)], "IMG_0001.JPG", {
      type: "image/jpeg",
    });

    const inferred = await inferUploadDateFromMetadata(file);

    expect(inferred).toBe("2024-05-12");
  });

  it("reads mvhd creation time from QuickTime/MP4 containers", async () => {
    const creationDate = new Date(Date.UTC(2024, 5, 10, 18, 0, 0));
    const quicktimeSeconds =
      Math.floor(creationDate.getTime() / 1000) + 2_082_844_800;

    const mvhdPayload = new Uint8Array(24);
    const mvhdView = new DataView(mvhdPayload.buffer);
    mvhdView.setUint8(0, 0); // version
    mvhdView.setUint32(4, quicktimeSeconds, false); // creation_time
    mvhdView.setUint32(8, quicktimeSeconds, false); // modification_time
    mvhdView.setUint32(12, 1_000, false); // timescale
    mvhdView.setUint32(16, 0, false); // duration

    const mvhd = makeMp4Box("mvhd", mvhdPayload);
    const moov = makeMp4Box("moov", mvhd);
    const ftyp = makeMp4Box(
      "ftyp",
      new Uint8Array([
        0x71,
        0x74,
        0x20,
        0x20, // "qt  "
        0x00,
        0x00,
        0x02,
        0x00,
        0x71,
        0x74,
        0x20,
        0x20, // "qt  "
      ]),
    );
    const fileBytes = concatUint8Arrays([ftyp, moov]);
    const file = new File([toArrayBuffer(fileBytes)], "IMG_0001.MOV", {
      type: "video/quicktime",
    });

    const inferred = await inferUploadDateFromMetadata(file);

    expect(inferred).toBe(toLocalDateInput(creationDate));
  });

  it("falls back to file.lastModified when embedded metadata is unavailable", async () => {
    const modifiedAt = new Date(2023, 8, 21, 11, 30, 0);
    const file = new File([toArrayBuffer(new Uint8Array([1, 2, 3]))], "plain.png", {
      type: "image/png",
      lastModified: modifiedAt.getTime(),
    });

    const inferred = await inferUploadDateFromMetadata(file);

    expect(inferred).toBe(toLocalDateInput(modifiedAt));
  });
});
