export interface ITranscriptionService {
  startTranscription(audioStream: ReadableStream, language: 'en' | 'am'): Promise<string>;
  stopTranscription(sessionId: string): Promise<{ text: string; confidence: number }>;
}
