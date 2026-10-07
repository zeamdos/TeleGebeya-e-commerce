export class Transcription {
  id: string;
  pageId: string;
  rawText: string;
  language: 'en' | 'am';
  confidence: number;
  durationSeconds: number;
  wordTimestamps: any; // word-level timing
  status: 'processing' | 'completed' | 'failed';
  createdAt: Date;
}
