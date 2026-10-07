export class StickyNote {
  id: string;
  notebookId: string;
  pageId?: string; // nullable, page-level sticky
  content: string;
  color: 'yellow' | 'pink' | 'blue' | 'green';
  position: { x: number; y: number };
  zIndex: number;
  createdAt: Date;
  updatedAt: Date;
}
