// @vitest-environment node
// Node environment: the reader needs the platform Blob.stream and DecompressionStream.
import { describe, it, expect } from 'vitest';
import {
  readZipMembers,
  buildDonation,
  binOf,
  SCORE_EDGES,
  DEPTH_EDGES,
  NO_DEPTH_SCORE,
} from '../../../resources/js/utils/donationPayload.js';
import { makeZip } from '../../e2e/fixtures/zip.js';

const COVERAGE =
  'mean\tvntr_array_depth_sum_per_unit_length\tvntr_flank_mean_depth\tcoverage_qc\n' +
  '209.21\t210.65\t164.57\tPASS\n';
const HEAD =
  '## VNtyper Kestrel result\n## VNtyper Version: 2.0.49\n## Analysis date: 2026-08-27\n';
const COLS = 'Motifs\tPOS\tDepth_Score\tConfidence\tFlag\tNomenclature\n';
const kestrel = (/** @type {string[]} */ ...rows) => HEAD + COLS + rows.join('\n') + '\n';
const NEGATIVE =
  HEAD +
  'Motif\tVariant\tPOS\tREF\tALT\tMotif_sequence\tEstimated_Depth_AlternateVariant\t' +
  'Estimated_Depth_Variant_ActiveRegion\tDepth_Score\tConfidence\n' +
  'None\tNone\tNone\tNone\tNone\tNone\tNone\tNone\tNone\tNegative\n';
const FORM = {
  kit: 'Twist Exome 2.0',
  platform_class: 'illumina_short',
  truth: 'confirmed_positive',
  confirmation_class: 'orthogonal_short',
};
const CONTRACT_KEYS = [
  'schema',
  'vntyper_version',
  'coverage_qc',
  'flank_depth_bin',
  'array_depth_bin',
  'kestrel_call',
  'kestrel_flagged',
  'kestrel_confidence',
  'depth_score_bin',
  'variant_class',
  'kit',
  'platform_class',
  'truth',
  'confirmation_class',
];

const donate = (/** @type {string} */ k, cov = COVERAGE, form = FORM) =>
  buildDonation({ 'coverage_summary.tsv': cov, 'kestrel_result.tsv': k }, form);

describe('readZipMembers', () => {
  it.each([false, true])('reads only the two result files by basename (deflate=%s)', async d => {
    const zip = await makeZip(
      {
        'pipeline_summary.json': '{"sample_name":"PATIENT-1"}',
        'coverage/coverage_summary.tsv': COVERAGE,
        'kestrel/kestrel_result.tsv': NEGATIVE,
      },
      d
    );
    const members = await readZipMembers(new Blob([zip]));
    expect(Object.keys(members).sort()).toEqual(['coverage_summary.tsv', 'kestrel_result.tsv']);
    expect(members['coverage_summary.tsv']).toBe(COVERAGE);
  });

  it('slices only the directory and the two members, never a large BAM', async () => {
    const bam = 'B'.repeat(4_000_000);
    const zip = new Blob([
      await makeZip({
        'fastq_bam_processing/big.bam': bam,
        'coverage/coverage_summary.tsv': COVERAGE,
        'kestrel/kestrel_result.tsv': NEGATIVE,
      }),
    ]);
    /** @type {number[]} */
    const read = [];
    const file = {
      size: zip.size,
      slice: (/** @type {number} */ a, /** @type {number} */ b) => {
        read.push(b - a);
        return zip.slice(a, b);
      },
      arrayBuffer: () => {
        throw new Error('whole file read');
      },
    };
    const members = await readZipMembers(/** @type {any} */ (file));
    expect(Object.keys(members).sort()).toEqual(['coverage_summary.tsv', 'kestrel_result.tsv']);
    expect(Math.max(...read)).toBeLessThan(70_000);
  });

  it('rejects a file that is not a ZIP', async () => {
    await expect(readZipMembers(new Blob(['not a zip']))).rejects.toThrow('Not a ZIP');
  });
});

describe('buildDonation', () => {
  it('positive dupC: an unflagged call is a positive call', () => {
    const d = donate(kestrel('D-C\t67\t0.0177\tHigh_Precision*\tNot flagged\t59dupC'));
    expect(d).toEqual({
      schema: 'vntyper-donation/2',
      vntyper_version: '2.0.49',
      coverage_qc: 'PASS',
      flank_depth_bin: '150-200',
      array_depth_bin: '200-300',
      kestrel_call: true,
      kestrel_flagged: false,
      kestrel_confidence: 'High_Precision',
      depth_score_bin: '0.01-0.02',
      variant_class: 'dupC',
      ...FORM,
    });
    expect(Object.keys(d)).toEqual(CONTRACT_KEYS);
  });

  it('atypical dupC at another position is other, not canonical dupC', () => {
    for (const name of ['23dupC', '56_59dupCCCC', '159dupC']) {
      const d = donate(kestrel(`D-C\t67\t0.02\tHigh_Precision\tNot flagged\t${name}`));
      expect(d.variant_class).toBe('other');
    }
  });

  it('other variant: positive call with a non-dupC nomenclature', () => {
    const d = donate(kestrel('D-C\t67\t0.006\tLow_Precision\tNot flagged\t56_59dupCCCC'));
    expect(d).toMatchObject({
      kestrel_call: true,
      kestrel_confidence: 'Low_Precision',
      variant_class: 'other',
      depth_score_bin: '0.006-0.008',
    });
  });

  it('flagged-only: a flagged call is never positive', () => {
    const d = donate(kestrel('X\t1\t0.03\tHigh_Precision\tLow_Depth_Conserved_Motifs\tx'));
    expect(d).toMatchObject({
      kestrel_call: false,
      kestrel_flagged: true,
      kestrel_confidence: 'none',
      variant_class: 'none',
      depth_score_bin: '0.02-0.05',
    });
  });

  it('artifact-only: a 4-bp insertion artifact is neither a call nor a flag', () => {
    for (const flag of [
      'False_Positive_4bp_Insertion',
      'Potential_Duplicate, False_Positive_4bp_Insertion',
    ]) {
      const d = donate(kestrel(`X\t1\t0.03\tHigh_Precision\t${flag}\tx`));
      expect(d).toMatchObject({
        kestrel_call: false,
        kestrel_flagged: false,
        kestrel_confidence: 'none',
        depth_score_bin: null,
        variant_class: 'none',
      });
    }
  });

  it('negative: the placeholder row gives no call and no score', () => {
    const d = donate(NEGATIVE, COVERAGE, {
      ...FORM,
      truth: 'unconfirmed',
      confirmation_class: 'none',
      referral: 'suspected_adtkd',
    });
    expect(d).toMatchObject({
      kestrel_call: false,
      kestrel_flagged: false,
      kestrel_confidence: 'none',
      depth_score_bin: null,
      variant_class: 'none',
      referral: 'suspected_adtkd',
    });
    expect(Object.keys(d)).toEqual([...CONTRACT_KEYS, 'referral']);
  });

  it('refuses a positive call without a readable Depth_Score', () => {
    expect(() => donate(kestrel('D-C\t67\tNone\tHigh_Precision\tNot flagged\t59dupC'))).toThrow(
      NO_DEPTH_SCORE
    );
  });

  it('missing coverage summary gives NA, missing kestrel result throws', () => {
    const d = buildDonation({ 'kestrel_result.tsv': NEGATIVE }, FORM);
    expect(d).toMatchObject({ coverage_qc: 'NA', flank_depth_bin: 'NA', array_depth_bin: 'NA' });
    expect(() => buildDonation({ 'coverage_summary.tsv': COVERAGE }, FORM)).toThrow(
      'kestrel_result.tsv not found'
    );
  });

  it('malformed TSV throws instead of reporting a negative', () => {
    expect(() => donate('garbage\n')).toThrow('version');
    expect(() => donate(HEAD)).toThrow('no result row');
    expect(() => donate(HEAD + 'foo\tbar\n1\t2\n')).toThrow('no result row');
  });

  it('maps coverage QC classes; unknown and NOT_EVALUATED become NA', () => {
    const qc = (/** @type {string} */ v) =>
      donate(NEGATIVE, COVERAGE.replace('PASS', v)).coverage_qc;
    expect([qc('REDUCED'), qc('FAIL'), qc('NOT_EVALUATED'), qc('')]).toEqual([
      'REDUCED',
      'FAIL',
      'NA',
      'NA',
    ]);
  });

  it('never leaks identifiers present in the result files', () => {
    const k =
      HEAD + 'Sample\t' + COLS + 'PATIENT-1\tD-C\t67\t0.02\tHigh_Precision\tNot flagged\t59dupC\n';
    expect(JSON.stringify(donate(k))).not.toMatch(/PATIENT|2026|D-C/);
  });
});

describe('binOf', () => {
  it('opens a bin at its lower edge, including the confidence gates', () => {
    expect(binOf(0.00469, SCORE_EDGES)).toBe('0.00469-0.005');
    expect(binOf(0.004689, SCORE_EDGES)).toBe('0.0045-0.00469');
    expect(binOf(0.00515, SCORE_EDGES)).toBe('0.00515-0.006');
    expect(binOf(0.005149, SCORE_EDGES)).toBe('0.005-0.00515');
    expect(binOf(0.0019, SCORE_EDGES)).toBe('<0.002');
    expect(binOf(0.1, SCORE_EDGES)).toBe('>=0.1');
    expect(binOf(19.99, DEPTH_EDGES)).toBe('<20');
    expect(binOf(20, DEPTH_EDGES)).toBe('20-40');
    expect(binOf(500, DEPTH_EDGES)).toBe('>=500');
    expect(binOf(NaN, DEPTH_EDGES)).toBeNull();
  });
});
