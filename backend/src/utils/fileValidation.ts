import fs from 'fs';

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB
const PDF_MAGIC_BYTES = Buffer.from([0x25, 0x50, 0x44, 0x46]); // %PDF

export function validatePdfFile(filePath: string, fileName: string): { valid: boolean; error?: string } {
  if (!fs.existsSync(filePath)) {
    return { valid: false, error: 'File not found' };
  }

  const stats = fs.statSync(filePath);
  if (stats.size > MAX_FILE_SIZE) {
    return { valid: false, error: `File size exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit` };
  }

  if (stats.size < 4) {
    return { valid: false, error: 'File is too small to be a valid PDF' };
  }

  const fileExtension = fileName.toLowerCase().split('.').pop();
  if (fileExtension !== 'pdf') {
    return { valid: false, error: 'File must have .pdf extension' };
  }

  try {
    const buffer = Buffer.alloc(4);
    const fd = fs.openSync(filePath, 'r');
    fs.readSync(fd, buffer, 0, 4, 0);
    fs.closeSync(fd);

    if (!buffer.equals(PDF_MAGIC_BYTES)) {
      return { valid: false, error: 'File is not a valid PDF (invalid magic bytes)' };
    }
  } catch (error) {
    return { valid: false, error: 'Unable to read file' };
  }

  return { valid: true };
}
