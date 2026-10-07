import { Module } from '@nestjs/common';
import { NotebookController } from './controllers/notebook.controller';
import { PageController } from './controllers/page.controller';
import { PdfController } from './controllers/pdf.controller';
import { StickyNoteController } from './controllers/sticky-note.controller';
import { TranscriptionGateway } from './gateways/transcription.gateway';

@Module({
  controllers: [
    NotebookController,
    PageController,
    PdfController,
    StickyNoteController,
  ],
  providers: [
    TranscriptionGateway,
  ],
})
export class PresentationModule {}
