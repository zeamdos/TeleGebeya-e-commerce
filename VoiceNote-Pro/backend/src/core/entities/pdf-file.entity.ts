export class PdfFile {
  id: string;
  notebookId: string;
  filename: string;
  storageUrl: string; // S3/GCS URL
  fileSizeBytes: number;
  pageCount: number;
  source: 'generated' | 'imported';
  createdAt: Date;
}
