// Minimal ZIP writer for donation tests (unit and e2e), no dependency.

/**
 * Minimal ZIP writer (stored or deflate-raw, CRC left 0: the reader never checks it).
 * @param {Record<string, string>} files
 * @param {boolean} deflate
 */
export async function makeZip(files, deflate = false) {
  const enc = new TextEncoder();
  const locals = [];
  const central = [];
  let offset = 0;
  for (const [name, text] of Object.entries(files)) {
    const raw = enc.encode(text);
    const data = deflate
      ? new Uint8Array(
          await new Response(
            new Blob([raw]).stream().pipeThrough(new CompressionStream('deflate-raw'))
          ).arrayBuffer()
        )
      : raw;
    const n = enc.encode(name);
    const lh = new DataView(new ArrayBuffer(30));
    lh.setUint32(0, 0x04034b50, true);
    lh.setUint16(8, deflate ? 8 : 0, true);
    lh.setUint32(18, data.length, true);
    lh.setUint32(22, raw.length, true);
    lh.setUint16(26, n.length, true);
    const ch = new DataView(new ArrayBuffer(46));
    ch.setUint32(0, 0x02014b50, true);
    ch.setUint16(10, deflate ? 8 : 0, true);
    ch.setUint32(20, data.length, true);
    ch.setUint32(24, raw.length, true);
    ch.setUint16(28, n.length, true);
    ch.setUint32(42, offset, true);
    locals.push(new Uint8Array(lh.buffer), n, data);
    central.push(new Uint8Array(ch.buffer), n);
    offset += 30 + n.length + data.length;
  }
  const cdSize = central.reduce((s, b) => s + b.length, 0);
  const eocd = new DataView(new ArrayBuffer(22));
  eocd.setUint32(0, 0x06054b50, true);
  eocd.setUint16(8, Object.keys(files).length, true);
  eocd.setUint16(10, Object.keys(files).length, true);
  eocd.setUint32(12, cdSize, true);
  eocd.setUint32(16, offset, true);
  return new Blob([...locals, ...central, new Uint8Array(eocd.buffer)]).arrayBuffer();
}
