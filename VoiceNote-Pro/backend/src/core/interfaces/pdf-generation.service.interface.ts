export interface IPdfGenerationService {
  generatePdf(notebookId: string, pageIds: string[]): Promise<string>; // Returns storage URL
  generatePagePdf(pageId: string): Promise<string>; // Returns storage URL
}
