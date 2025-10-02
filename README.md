# vntyper online frontend

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Technologies Used](#technologies-used)
- [Development](#development)
- [Testing](#testing)
- [Usage](#usage)
- [File Naming Conventions](#file-naming-conventions)
- [License](#license)

## Overview

**vntyper-online-frontend** is a web-based application designed to facilitate the extraction of specific genomic regions from BAM files using their corresponding BAI index files. Leveraging the power of [BioWasm's Aioli](https://www.biowasm.com/), the application runs `samtools` directly in the browser, enabling users to process their genomic data without the need for backend servers or local installations.

## Features

- **Single File Input for BAM and BAI Files:** Users can upload multiple BAM and BAI files simultaneously through a single file input, streamlining the upload process.
- **Predefined Region Selection:** A dropdown menu allows users to select predefined genomic regions, reducing the likelihood of input errors.
- **In-Browser Processing:** Utilizes `samtools` via BioWasm's Aioli to perform region extraction directly in the browser.
- **Download Extracted BAM Files:** After processing, users can download the subset BAM files corresponding to their selected regions.
- **User-Friendly Interface:** Clean and intuitive UI ensures ease of use for both novice and experienced users.
- **Error Handling:** Provides clear error messages for missing files or processing issues, guiding users to rectify problems.

## Technologies Used

- **HTML5 & CSS3:** For structuring and styling the user interface.
- **JavaScript (ES6):** Handles file uploads, processing logic, and user interactions.
- **[BioWasm's Aioli](https://www.biowasm.com/):** Enables running `samtools` in the browser for genomic data processing.
- **[samtools](http://www.htslib.org/):** A suite of programs for interacting with high-throughput sequencing data.

## Development

### Running Locally

1. **Clone the Repository:**

   ```bash
   git clone https://github.com/yourusername/vntyper-online-frontend.git
   ```

2. **Navigate to the Project Directory:**

   ```bash
   cd vntyper-online-frontend
   ```

3. **Start Development Server:**

   ```bash
   # Using Python (recommended for development)
   python3 -m http.server 3000

   # Or using Node.js
   npx serve -l 3000
   ```

   The application will be available at `http://localhost:3000`

4. **Open the Application:**

   Open `http://localhost:3000` in your preferred web browser.

   **For development with cache disabled:**
   - Open browser DevTools (F12)
   - Go to Network tab
   - Check "Disable cache"
   - Keep DevTools open while developing

## Testing

The frontend uses **Vitest** with **happy-dom** for fast, modern testing of Vanilla JavaScript modules.

### Quick Start

```bash
# Install dependencies
npm install

# Run all tests
npm test

# Run tests once (CI mode)
npm run test:run

# Run with coverage report
npm run test:coverage

# Run in watch mode (for development)
npm run test:watch

# Run with UI
npm run test:ui
```

### Test Structure

```
tests/
├── unit/                    # Unit tests
│   ├── controllers/         # Controller tests
│   ├── models/              # Model tests
│   ├── services/            # Service tests (httpUtils, etc.)
│   ├── utils/               # Utility tests (EventBus, StateManager)
│   └── fixtures/            # Shared test data
├── integration/             # Integration tests
└── e2e/                     # End-to-end tests (optional)
```

### Coverage

- **Target:** 60-80% overall coverage
- **Critical modules:** EventBus (100%), StateManager (95%), httpUtils (95%)
- **Current status:** 228 tests passing across 4 test suites

### Writing Tests

Tests follow these principles:
- **Pure Vanilla JS** - No TypeScript, no build step required
- **ES6 modules** - Native import/export
- **Vitest matchers** - `vi.fn()`, `vi.spyOn()`, `vi.useFakeTimers()`
- **SOLID principles** - Tests mirror application architecture

Example test:

```javascript
import { describe, it, expect, vi } from 'vitest';
import { myFunction } from '../../../resources/js/myModule.js';

describe('myFunction()', () => {
  it('should return expected result', () => {
    const result = myFunction('input');
    expect(result).toBe('expected');
  });
});
```

### Configuration

Test configuration in `vitest.config.js`:
- Environment: `happy-dom` (fast DOM simulation)
- Coverage provider: `v8` (native, fast)
- Globals: `true` (describe, it, expect available everywhere)

## Usage

1. **Select BAM and BAI Files:**
   
   - Click on the **"Select BAM and BAI Files"** button.
   - In the file selection dialog, navigate to the directory containing your BAM and BAI files.
   - Select the desired BAM files along with their corresponding BAI files.
     - **Naming Conventions:**
       - For a BAM file named `sample.bam`, the corresponding BAI file should be either `sample.bam.bai` or `sample.bai`.
   - Click **"Open"** to upload the selected files.

2. **Select Genomic Region:**
   
   - From the **"Select Region"** dropdown, choose the desired genomic region.
   - The dropdown defaults to the **hg38** MUC1 locus. You can switch to **hg19** if needed.

3. **Extract Region:**
   
   - Click the **"Extract Region"** button.
   - The button will display **"Processing..."** while the extraction is underway.
   - A loading spinner indicates that processing is in progress.

4. **Download Extracted BAM Files:**
   
   - Once processing is complete, download links for the subset BAM files will appear under the **"output"** section.
   - Click on the **"Download subset_*.bam"** links to download the extracted regions.

5. **Verify Downloaded Files:**
   
   - Ensure that the downloaded BAM files are of the expected size and contain the reads from the specified region.

## File Naming Conventions

To ensure successful processing, adhere to the following naming conventions for your BAM and BAI files:

- For a BAM file named `example.bam`, the corresponding BAI file should be either:
  - `example.bam.bai`
  - `example.bai`

**Example:**

```plaintext
example.bam
example.bam.bai
```

or

```plaintext
example.bam
example.bai
```

Ensure that each BAM file has its corresponding BAI file following one of the above naming patterns.

## License

This project is licensed under the [MIT License](LICENSE).

---

## Acknowledgements

- [BioWasm](https://www.biowasm.com/) for providing the Aioli library.
- [samtools](http://www.htslib.org/) for their powerful genomic data processing tools.
- [HTSLIB](https://github.com/samtools/htslib) for maintaining open-source tools for high-throughput sequencing data.
