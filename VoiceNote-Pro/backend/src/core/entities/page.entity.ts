export class Page {
  id: string;
  notebookId: string;
  pageNumber: number;
  content: any; // JSON document
  canvasData: any; // Fabric.js drawing data
  plainText: string; // for full-text search
  searchVector: string; // tsvector for GIN index
  createdAt: Date;
  updatedAt: Date;
}
