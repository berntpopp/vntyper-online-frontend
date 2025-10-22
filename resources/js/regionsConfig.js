// frontend/resources/js/regionsConfig.js

export const regions = {
    // UCSC format (chr prefix) - for BAMs with chr1, chr2, chrX naming
    hg19: {
        assembly: 'hg19',
        region: 'chr1:155158000-155163000',
        description: 'hg19 (UCSC chr prefix)',
        convention: 'ucsc'
    },
    hg38: {
        assembly: 'hg38',
        region: 'chr1:155184000-155194000',
        description: 'hg38 (UCSC chr prefix)',
        convention: 'ucsc'
    },

    // ENSEMBL format (numeric) - for BAMs with 1, 2, X naming
    GRCh37: {
        assembly: 'GRCh37',
        region: '1:155158000-155163000',
        description: 'GRCh37 (ENSEMBL numeric)',
        convention: 'ensembl'
    },
    GRCh38: {
        assembly: 'GRCh38',
        region: '1:155184000-155194000',
        description: 'GRCh38 (ENSEMBL numeric)',
        convention: 'ensembl'
    },

    // NCBI RefSeq format - for BAMs with NC_000001.10, NC_000001.11 naming
    hg19_ncbi: {
        assembly: 'hg19_ncbi',
        region: 'NC_000001.10:155158000-155163000',
        description: 'hg19 (NCBI RefSeq)',
        convention: 'ncbi'
    },
    hg38_ncbi: {
        assembly: 'hg38_ncbi',
        region: 'NC_000001.11:155184000-155194000',
        description: 'hg38 (NCBI RefSeq)',
        convention: 'ncbi'
    }
};
