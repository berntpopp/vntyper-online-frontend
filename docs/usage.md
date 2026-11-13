# Using VNtyper Online

VNtyper Online is served at <https://vntyper.org/>. It is for research use only.

## What the page does

- **Single file input for alignment and index files.** Select several BAM and
  BAI files (or SAM files) at once, through one file input or by drag and drop.
- **Predefined region selection.** A dropdown offers the MUC1 locus for each
  supported assembly and contig naming style, so the region does not have to be
  typed by hand. The assembly can also be detected from the BAM header.
- **In-browser processing.** `samtools` runs in the browser through
  [BioWasm's Aioli](https://www.biowasm.com/) and extracts the selected region
  locally.
- **Job submission.** **Submit Jobs** extracts the region and uploads only that
  subset to the VNtyper API for genotyping.
- **Local download of the extracted region.** **Extract Region** extracts the
  MUC1 region and offers the subset BAM for download without submitting a job.
- **Error messages.** Missing index files and processing problems are reported
  on the page.

## Steps

1. **Select BAM and BAI files.** Click the file area (or drag files onto it),
   select each BAM together with its BAI index, and confirm. See
   [file naming](#file-naming) for how the two are paired.
2. **Select the genomic region.** Choose an entry from the region dropdown. It
   defaults to the **hg38** MUC1 locus; switch to **hg19** (or the ENSEMBL or
   NCBI RefSeq naming of either assembly) if your data needs it.
3. **Submit or extract.**
   - **Submit Jobs** sends the extracted subset to the VNtyper API; results
     appear on the page when the job finishes.
   - **Extract Region** shows a progress indicator while extraction runs, then
     lists download links for the subset BAM files (`subset_*.bam`) and their indexes in the
     output section.
4. **Check downloaded files.** Make sure a downloaded subset BAM has the
   expected size and contains reads from the selected region.

## File naming

Each BAM file needs its index next to it. For a BAM file named `example.bam`,
the BAI file must be named either `example.bam.bai` or `example.bai`:

```text
example.bam
example.bam.bai
```

or

```text
example.bam
example.bai
```

A BAM selected without a matching BAI cannot be processed.

## Acknowledgements

- [BioWasm](https://www.biowasm.com/) for the Aioli library.
- [samtools](http://www.htslib.org/) for the genomic data processing tools.
- [HTSlib](https://github.com/samtools/htslib) for the open-source library
  underneath them.
