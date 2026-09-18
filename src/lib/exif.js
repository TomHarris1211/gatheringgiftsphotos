// Minimal EXIF reader — pulls the original capture date out of a JPEG.
//
// Only the first 128 KB of the file is read: the EXIF APP1 segment always
// sits at the very start of a JPEG, so this costs nothing even on a 12 MP
// photo. Returns an ISO string, or null when the file carries no usable
// date (videos, screenshots, edited/exported images, WhatsApp copies).

const HEAD_BYTES = 128 * 1024;

export async function readCaptureDate(file) {
  try {
    if (!file || !file.type || !file.type.startsWith("image/")) return null;
    const buf = await file.slice(0, HEAD_BYTES).arrayBuffer();
    const view = new DataView(buf);
    const raw = findExifDateString(view);
    return raw ? exifStringToISO(raw) : null;
  } catch {
    return null; // never let a malformed photo block an upload
  }
}

// Walk the JPEG marker segments looking for APP1 ("Exif\0\0").
function findExifDateString(view) {
  if (view.byteLength < 4) return null;
  if (view.getUint16(0, false) !== 0xffd8) return null; // not a JPEG

  let offset = 2;
  while (offset + 4 <= view.byteLength) {
    if (view.getUint8(offset) !== 0xff) { offset++; continue; }
    const marker = view.getUint8(offset + 1);

    // Standalone markers carry no payload.
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += 2;
      continue;
    }
    // Start of scan — image data begins, EXIF would have appeared before now.
    if (marker === 0xda || marker === 0xd9) return null;

    const size = view.getUint16(offset + 2, false);
    if (size < 2) return null;

    if (
      marker === 0xe1 &&
      offset + 10 <= view.byteLength &&
      view.getUint32(offset + 4, false) === 0x45786966 // "Exif"
    ) {
      const end = Math.min(offset + 2 + size, view.byteLength);
      return readTiffDate(view, offset + 10, end);
    }
    offset += 2 + size;
  }
  return null;
}

// Read the TIFF header inside APP1, then the date tags.
function readTiffDate(view, tiff, end) {
  if (tiff + 8 > view.byteLength) return null;

  const order = view.getUint16(tiff, false);
  const little = order === 0x4949; // "II"; "MM" (0x4d4d) is big-endian
  if (!little && order !== 0x4d4d) return null;
  if (view.getUint16(tiff + 2, little) !== 0x002a) return null;

  const ifd0 = tiff + view.getUint32(tiff + 4, little);

  // DateTimeOriginal (0x9003) is the moment the shutter fired and lives in
  // the Exif sub-IFD, which IFD0 points at via tag 0x8769. DateTimeDigitized
  // (0x9004) is the next best. DateTime (0x0132) in IFD0 is last resort —
  // it changes when the file is edited.
  const subOffset = readLongTag(view, ifd0, 0x8769, little, end);
  if (subOffset != null) {
    const sub = tiff + subOffset;
    return (
      readStringTag(view, tiff, sub, 0x9003, little, end) ||
      readStringTag(view, tiff, sub, 0x9004, little, end) ||
      readStringTag(view, tiff, ifd0, 0x0132, little, end)
    );
  }
  return readStringTag(view, tiff, ifd0, 0x0132, little, end);
}

function readLongTag(view, ifd, tag, little, end) {
  if (ifd + 2 > end) return null;
  const count = view.getUint16(ifd, little);
  for (let i = 0; i < count; i++) {
    const entry = ifd + 2 + i * 12;
    if (entry + 12 > end) return null;
    if (view.getUint16(entry, little) === tag) return view.getUint32(entry + 8, little);
  }
  return null;
}

function readStringTag(view, tiff, ifd, tag, little, end) {
  if (ifd + 2 > end) return null;
  const count = view.getUint16(ifd, little);
  for (let i = 0; i < count; i++) {
    const entry = ifd + 2 + i * 12;
    if (entry + 12 > end) return null;
    if (view.getUint16(entry, little) !== tag) continue;

    const len = view.getUint32(entry + 4, little);
    // Values of 4 bytes or fewer are stored inline; longer ones are a pointer.
    const start = len > 4 ? tiff + view.getUint32(entry + 8, little) : entry + 8;

    let out = "";
    for (let j = 0; j < len && start + j < view.byteLength; j++) {
      const c = view.getUint8(start + j);
      if (c === 0) break;
      out += String.fromCharCode(c);
    }
    out = out.trim();
    return out || null;
  }
  return null;
}

// "2026:09:05 14:32:08" -> ISO string.
// EXIF dates carry no timezone, so they are read as the phone's local time —
// which is what "the day it was packed" means to whoever took the photo.
function exifStringToISO(raw) {
  const m = /^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/.exec(raw);
  if (!m) return null;

  const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3]);
  const h = Number(m[4]), mi = Number(m[5]), s = Number(m[6]);
  const dt = new Date(y, mo - 1, d, h, mi, s);
  if (Number.isNaN(dt.getTime())) return null;

  // Cameras with a flat battery write 1970/1980 placeholders; reject those
  // and anything in the future rather than polluting the gallery.
  if (dt.getFullYear() < 1990) return null;
  if (dt.getTime() > Date.now() + 24 * 60 * 60 * 1000) return null;

  return dt.toISOString();
}
