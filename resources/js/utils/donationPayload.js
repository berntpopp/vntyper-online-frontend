// frontend/resources/js/utils/donationPayload.js

/**
 * Reduces a VNtyper result ZIP to the anonymous donation record
 * (schema "vntyper-donation/2"). Runs entirely in the browser: only
 * coverage_summary.tsv and kestrel_result.tsv are read, and only binned,
 * enumerated values leave this module. No file content is ever sent.
 *
 * @module donationPayload
 */

export const SCHEMA = 'vntyper-donation/2';
const WANTED = ['coverage_summary.tsv', 'kestrel_result.tsv'];
// kestrel_config.json "artifact_flags": filtered artifacts, never a call and never a flag.
const ARTIFACT_FLAGS = ['False_Positive_4bp_Insertion'];
const CALL_CONFIDENCE = ['High_Precision', 'Low_Precision'];

// A positive call without a depth score is refused here rather than by the server (422).
export const NO_DEPTH_SCORE = 'The call in this result has no readable depth score';

export const DEPTH_EDGES = [20, 40, 60, 80, 100, 150, 200, 300, 500];
// Fine around the 0.00469 / 0.00515 confidence gates, coarse elsewhere.
export const SCORE_EDGES = [
  0.002, 0.004, 0.0045, 0.00469, 0.005, 0.00515, 0.006, 0.008, 0.01, 0.02, 0.05, 0.1,
];

/**
 * Read selected members of a ZIP archive by basename. Only the directory and the
 * wanted members are sliced from the file, so large BAM members are never read.
 * ponytail: no ZIP64; VNtyper result ZIPs stay far below 4 GB.
 * @param {Blob} file - The ZIP file
 * @param {string[]} [wanted] - Basenames to extract
 * @returns {Promise<Record<string, string>>} Basename to decoded text, first match wins
 */
export async function readZipMembers(file, wanted = WANTED) {
  /** @param {number} start @param {number} end */
  const view = async (start, end) => new DataView(await file.slice(start, end).arrayBuffer());
  // The end record is the last 22 bytes plus an optional comment of up to 64 KiB.
  const tailStart = Math.max(0, file.size - 22 - 0xffff);
  const tail = await view(tailStart, file.size);
  let eocd = tail.byteLength - 22;
  while (eocd >= 0 && tail.getUint32(eocd, true) !== 0x06054b50) eocd--;
  if (eocd < 0) throw new Error('Not a ZIP archive');
  const count = tail.getUint16(eocd + 10, true);
  const cdStart = tail.getUint32(eocd + 16, true);
  const dv = await view(cdStart, cdStart + tail.getUint32(eocd + 12, true));
  let p = 0;
  /** @type {Record<string, string>} */
  const out = {};
  for (let i = 0; i < count; i++) {
    if (dv.getUint32(p, true) !== 0x02014b50) throw new Error('Corrupt ZIP directory');
    const method = dv.getUint16(p + 10, true);
    const size = dv.getUint32(p + 20, true);
    const nameLen = dv.getUint16(p + 28, true);
    const local = dv.getUint32(p + 42, true);
    const name = new TextDecoder().decode(new Uint8Array(dv.buffer, p + 46, nameLen));
    p += 46 + nameLen + dv.getUint16(p + 30, true) + dv.getUint16(p + 32, true);
    const base = name.split('/').pop();
    if (!wanted.includes(base) || base in out) continue;
    if (method !== 0 && method !== 8) throw new Error(`Unsupported ZIP compression ${method}`);
    const lh = await view(local, local + 30);
    const start = local + 30 + lh.getUint16(26, true) + lh.getUint16(28, true);
    const raw = file.slice(start, start + size);
    const bytes = await (method === 0
      ? raw.arrayBuffer()
      : new Response(
          raw.stream().pipeThrough(new DecompressionStream('deflate-raw'))
        ).arrayBuffer());
    out[base] = new TextDecoder().decode(bytes);
  }
  return out;
}

/**
 * Header and data rows of a TSV, skipping '#' comment lines.
 * @param {string} tsv
 * @returns {Record<string, string>[]} One object per data row
 */
function rows(tsv) {
  const lines = tsv.split(/\r?\n/).filter(line => line.trim() && !line.startsWith('#'));
  const head = (lines.shift() ?? '').split('\t');
  return lines.map(line => {
    const cells = line.split('\t');
    return Object.fromEntries(head.map((key, i) => [key, cells[i] ?? '']));
  });
}

/**
 * Bin label for a value; 'x < edge' goes below the edge, so an edge value opens its bin.
 * @param {number} x
 * @param {number[]} edges - Ascending
 * @returns {string | null} Bin label, or null when x is not a finite number
 */
export function binOf(x, edges) {
  if (!Number.isFinite(x)) return null;
  const i = edges.findIndex(edge => x < edge);
  if (i === 0) return `<${edges[0]}`;
  if (i === -1) return `>=${edges[edges.length - 1]}`;
  return `${edges[i - 1]}-${edges[i]}`;
}

/**
 * Parse a TSV number; '', 'None' and 'NA' become NaN instead of 0.
 * @param {string | undefined} value
 * @returns {number}
 */
const num = value => (value && /\d/.test(value) ? Number(value) : NaN);

/**
 * Build the contract payload from the two result files and the donor's answers.
 * @param {Record<string, string>} members - Output of readZipMembers
 * @param {{kit: string, platform_class: string, truth: string, confirmation_class: string, referral?: string}} form
 * @returns {Record<string, string | boolean | null>} The exact JSON body to send
 */
export function buildDonation(members, form) {
  const kestrel = members['kestrel_result.tsv'];
  if (!kestrel) throw new Error('kestrel_result.tsv not found in the ZIP');
  const version = /^## VNtyper Version: (\d+\.\d+\.\d+)\s*$/m.exec(kestrel)?.[1];
  if (!version) throw new Error('kestrel_result.tsv has no VNtyper version header');
  const variants = rows(kestrel);
  if (!variants.length || !('Confidence' in variants[0])) {
    throw new Error('kestrel_result.tsv has no result row');
  }

  // Rows that are calls: High/Low_Precision (the '*' marks a dupC hit) and not a 4-bp artifact.
  const calls = variants
    .map(
      row =>
        /** @type {Record<string, string>} */ ({
          ...row,
          Confidence: row.Confidence.replace(/\*$/, ''),
        })
    )
    .filter(row => CALL_CONFIDENCE.includes(row.Confidence))
    .filter(row => !(row.Flag ?? '').split(',').some(f => ARTIFACT_FLAGS.includes(f.trim())));
  // Only unflagged calls are positive; flagged calls are reported as flagged, never positive.
  const positive = calls.find(row => !row.Flag || row.Flag === 'Not flagged');
  const flagged = calls.find(row => row !== positive);
  const scored = positive ?? flagged;
  if (positive && !Number.isFinite(num(positive.Depth_Score))) throw new Error(NO_DEPTH_SCORE);

  const cov = rows(members['coverage_summary.tsv'] ?? '')[0] ?? {};
  const qc = { PASS: 'PASS', REDUCED: 'REDUCED', FAIL: 'FAIL' }[cov.coverage_qc] ?? 'NA';

  return {
    schema: SCHEMA,
    vntyper_version: version,
    coverage_qc: qc,
    flank_depth_bin: binOf(num(cov.vntr_flank_mean_depth), DEPTH_EDGES) ?? 'NA',
    array_depth_bin: binOf(num(cov.vntr_array_depth_sum_per_unit_length), DEPTH_EDGES) ?? 'NA',
    kestrel_call: Boolean(positive),
    kestrel_flagged: Boolean(flagged),
    kestrel_confidence: positive ? positive.Confidence : 'none',
    depth_score_bin: scored ? binOf(num(scored.Depth_Score), SCORE_EDGES) : null,
    // Exact nomenclature never leaves the browser: canonical dupC vs any other call.
    variant_class: positive
      ? /(?:^|[^\d_])59dupC(?!C)/.test(positive.Nomenclature ?? '')
        ? 'dupC'
        : 'other'
      : 'none',
    kit: form.kit,
    platform_class: form.platform_class,
    truth: form.truth,
    confirmation_class: form.confirmation_class,
    ...(form.referral ? { referral: form.referral } : {}),
  };
}
