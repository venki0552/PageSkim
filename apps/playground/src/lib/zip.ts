/**
 * Minimal ZIP writer (store method, no compression) for "download split
 * files". ~80 lines beats a dependency; split files are tiny anyway.
 */

const textEncoder = new TextEncoder();

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc ^= data[i]!;
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

export function buildZip(files: Record<string, string>): Uint8Array {
  interface Entry {
    name: Uint8Array;
    data: Uint8Array;
    crc: number;
    offset: number;
  }
  const entries: Entry[] = [];
  const chunks: Uint8Array[] = [];
  let offset = 0;

  const push = (bytes: Uint8Array): void => {
    chunks.push(bytes);
    offset += bytes.length;
  };
  const u16 = (n: number): number[] => [n & 0xff, (n >> 8) & 0xff];
  const u32 = (n: number): number[] => [n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >>> 24) & 0xff];

  for (const [name, content] of Object.entries(files)) {
    const nameBytes = textEncoder.encode(name);
    const data = textEncoder.encode(content);
    const crc = crc32(data);
    entries.push({ name: nameBytes, data, crc, offset });
    push(
      new Uint8Array([
        ...u32(0x04034b50), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0),
        ...u32(crc), ...u32(data.length), ...u32(data.length),
        ...u16(nameBytes.length), ...u16(0),
      ]),
    );
    push(nameBytes);
    push(data);
  }

  const centralStart = offset;
  for (const e of entries) {
    push(
      new Uint8Array([
        ...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0),
        ...u32(e.crc), ...u32(e.data.length), ...u32(e.data.length),
        ...u16(e.name.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0),
        ...u32(0), ...u32(e.offset),
      ]),
    );
    push(e.name);
  }
  const centralSize = offset - centralStart;
  push(
    new Uint8Array([
      ...u32(0x06054b50), ...u16(0), ...u16(0),
      ...u16(entries.length), ...u16(entries.length),
      ...u32(centralSize), ...u32(centralStart), ...u16(0),
    ]),
  );

  const out = new Uint8Array(offset);
  let pos = 0;
  for (const c of chunks) {
    out.set(c, pos);
    pos += c.length;
  }
  return out;
}
