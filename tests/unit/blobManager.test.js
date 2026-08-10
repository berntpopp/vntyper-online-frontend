// tests/unit/blobManager.test.js

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

/**
 * Blob URL lifetime.
 *
 * Extracted BAM/BAI blobs can be hundreds of MB, so they must be released -
 * but never while the link that points at them is still on screen.
 */
describe('blobManager lifetime', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
    global.URL.createObjectURL = vi.fn(() => `blob:mock-${Math.random()}`);
    global.URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('does not revoke URLs on a timer', async () => {
    const { blobManager } = await import('../../resources/js/blobManager.js');
    blobManager.create(new Blob(['x']), { filename: 'sample.bam' });

    // Well past the old 5-minute auto-cleanup window.
    await vi.advanceTimersByTimeAsync(15 * 60 * 1000);

    expect(global.URL.revokeObjectURL).not.toHaveBeenCalled();
  });

  it('revokes a specific set of URLs on demand', async () => {
    const { blobManager } = await import('../../resources/js/blobManager.js');
    const a = blobManager.create(new Blob(['a']), { filename: 'a.bam' });
    const b = blobManager.create(new Blob(['b']), { filename: 'b.bam' });

    const revoked = blobManager.revokeMultiple([a, b]);

    expect(revoked).toBe(2);
    expect(global.URL.revokeObjectURL).toHaveBeenCalledTimes(2);
  });

  it('revokes everything on revokeAll', async () => {
    const { blobManager } = await import('../../resources/js/blobManager.js');
    blobManager.create(new Blob(['a']), { filename: 'a.bam' });
    blobManager.create(new Blob(['b']), { filename: 'b.bam' });

    blobManager.revokeAll();

    expect(global.URL.revokeObjectURL).toHaveBeenCalledTimes(2);
  });
});
