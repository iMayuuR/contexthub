import * as fs from 'fs';
import pdfParse from 'pdf-parse';
import { MAX_PDF_PAGES, MAX_PDF_SIZE_BYTES } from '@contexthub/core';

export class PdfParser {
  /**
   * Parse a PDF file and extract its text content.
   * Enforces security constraints on file size and page count.
   */
  async parsePdf(filePath: string): Promise<{ text: string; pages: number; metadata: any }> {
    // 1. Check file size
    const stats = fs.statSync(filePath);
    if (stats.size > MAX_PDF_SIZE_BYTES) {
      throw new Error(`PDF file exceeds maximum allowed size of ${MAX_PDF_SIZE_BYTES / (1024 * 1024)}MB`);
    }

    // 2. Read file
    const dataBuffer = fs.readFileSync(filePath);

    // 3. Parse PDF with limit checking
    const data = await pdfParse(dataBuffer, {
      max: MAX_PDF_PAGES, // Stop parsing if it exceeds max pages
    });

    // 4. Verify page count (pdfParse max option limits what's returned, but we should also enforce it explicitly)
    if (data.numpages > MAX_PDF_PAGES) {
      throw new Error(`PDF exceeds maximum allowed page count of ${MAX_PDF_PAGES}`);
    }

    return {
      text: data.text,
      pages: data.numpages,
      metadata: data.info
    };
  }
}
