export class Notebook {
  id: string;
  userId: string;
  title: string;
  description: string;
  language: 'en' | 'am' | 'mixed';
  pageCount: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}
