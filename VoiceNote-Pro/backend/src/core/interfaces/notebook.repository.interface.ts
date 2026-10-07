import { Notebook } from '../entities/notebook.entity';

export interface INotebookRepository {
  create(notebook: Omit<Notebook, 'id' | 'createdAt' | 'updatedAt'>): Promise<Notebook>;
  findById(id: string): Promise<Notebook | null>;
  findByUserId(userId: string): Promise<Notebook[]>;
  update(id: string, data: Partial<Notebook>): Promise<Notebook>;
  softDelete(id: string): Promise<void>;
}
