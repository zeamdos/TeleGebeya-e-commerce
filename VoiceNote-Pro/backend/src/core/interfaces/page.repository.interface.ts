import { Page } from '../entities/page.entity';

export interface IPageRepository {
  create(page: Omit<Page, 'id' | 'createdAt' | 'updatedAt'>): Promise<Page>;
  findById(id: string): Promise<Page | null>;
  findByNotebookId(notebookId: string): Promise<Page[]>;
  update(id: string, data: Partial<Page>): Promise<Page>;
  delete(id: string): Promise<void>;
}
