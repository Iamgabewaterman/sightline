import { NextResponse } from "next/server";
import { readFileSync } from "fs";
import { join } from "path";

// Build a STORE-mode ZIP (no compression) using pure Node.js Buffers.
// No external zip library needed — we write the local file headers,
// file data, and end-of-central-directory record by hand.

const TEMPLATES = [
  { name: "clients-template.csv",   file: "clients-template.csv" },
  { name: "jobs-template.csv",      file: "jobs-template.csv" },
  { name: "materials-template.csv", file: "materials-template.csv" },
  { name: "labor-template.csv",     file: "labor-template.csv" },
  { name: "invoices-template.csv",  file: "invoices-template.csv" },
  { name: "contacts-template.csv",  file: "contacts-template.csv" },
];

function crc32(buf: Buffer): number {
  const table = makeCrcTable();
  let crc = 0xffffffff;
  for (let b = 0; b < buf.length; b++) crc = (table[(crc ^ buf[b]) & 0xff] ^ (crc >>> 8)) >>> 0;
  return (crc ^ 0xffffffff) >>> 0;
}

let _crcTable: number[] | null = null;
function makeCrcTable(): number[] {
  if (_crcTable) return _crcTable;
  _crcTable = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    _crcTable[n] = c;
  }
  return _crcTable;
}

function writeUint16LE(buf: Buffer, offset: number, val: number) {
  buf.writeUInt16LE(val, offset);
}
function writeUint32LE(buf: Buffer, offset: number, val: number) {
  buf.writeUInt32LE(val, offset);
}

export async function GET() {
  const templatesDir = join(process.cwd(), "public", "templates");

  const entries: { name: Buffer; data: Buffer; crc: number; localOffset: number }[] = [];
  const parts: Buffer[] = [];
  let offset = 0;

  for (const t of TEMPLATES) {
    const data = readFileSync(join(templatesDir, t.file));
    const nameBytes = Buffer.from(t.name, "utf8");
    const crc = crc32(data);
    const localOffset = offset;

    // Local file header (30 bytes + name)
    const localHeader = Buffer.alloc(30 + nameBytes.length);
    writeUint32LE(localHeader, 0, 0x04034b50);  // signature
    writeUint16LE(localHeader, 4, 20);           // version needed
    writeUint16LE(localHeader, 6, 0);            // flags
    writeUint16LE(localHeader, 8, 0);            // compression: STORE
    writeUint16LE(localHeader, 10, 0);           // mod time
    writeUint16LE(localHeader, 12, 0);           // mod date
    writeUint32LE(localHeader, 14, crc);
    writeUint32LE(localHeader, 18, data.length); // compressed size
    writeUint32LE(localHeader, 22, data.length); // uncompressed size
    writeUint16LE(localHeader, 26, nameBytes.length);
    writeUint16LE(localHeader, 28, 0);           // extra field length
    nameBytes.copy(localHeader, 30);

    parts.push(localHeader, data);
    offset += localHeader.length + data.length;
    entries.push({ name: nameBytes, data, crc, localOffset });
  }

  // Central directory
  const cdStart = offset;
  for (const e of entries) {
    const cd = Buffer.alloc(46 + e.name.length);
    writeUint32LE(cd, 0, 0x02014b50);    // signature
    writeUint16LE(cd, 4, 20);            // version made by
    writeUint16LE(cd, 6, 20);            // version needed
    writeUint16LE(cd, 8, 0);             // flags
    writeUint16LE(cd, 10, 0);            // compression: STORE
    writeUint16LE(cd, 12, 0);            // mod time
    writeUint16LE(cd, 14, 0);            // mod date
    writeUint32LE(cd, 16, e.crc);
    writeUint32LE(cd, 20, e.data.length);
    writeUint32LE(cd, 24, e.data.length);
    writeUint16LE(cd, 28, e.name.length);
    writeUint16LE(cd, 30, 0);            // extra field length
    writeUint16LE(cd, 32, 0);            // comment length
    writeUint16LE(cd, 34, 0);            // disk number start
    writeUint16LE(cd, 36, 0);            // internal attrs
    writeUint32LE(cd, 38, 0);            // external attrs
    writeUint32LE(cd, 42, e.localOffset);
    e.name.copy(cd, 46);
    parts.push(cd);
    offset += cd.length;
  }

  const cdSize = offset - cdStart;

  // End of central directory
  const eocd = Buffer.alloc(22);
  writeUint32LE(eocd, 0, 0x06054b50);
  writeUint16LE(eocd, 4, 0);
  writeUint16LE(eocd, 6, 0);
  writeUint16LE(eocd, 8, entries.length);
  writeUint16LE(eocd, 10, entries.length);
  writeUint32LE(eocd, 12, cdSize);
  writeUint32LE(eocd, 16, cdStart);
  writeUint16LE(eocd, 20, 0);
  parts.push(eocd);

  const zip = Buffer.concat(parts);

  return new NextResponse(zip, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": 'attachment; filename="sightline-import-templates.zip"',
      "Content-Length": String(zip.length),
    },
  });
}
