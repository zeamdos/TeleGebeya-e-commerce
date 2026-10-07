export interface IFileStorageService {
  uploadFile(filename: string, buffer: Buffer, contentType: string): Promise<string>; // Returns URL
  deleteFile(url: string): Promise<void>;
  getFileUrl(path: string): string;
}
