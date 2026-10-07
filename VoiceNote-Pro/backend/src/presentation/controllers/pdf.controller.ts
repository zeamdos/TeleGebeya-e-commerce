import { Controller, Get, Post, Body, Param, Res } from '@nestjs/common';

@Controller('pdf')
export class PdfController {
  @Post('generate')
  generate(@Body() generateDto: any) {
    return { message: 'Generate PDF' };
  }

  @Post('import')
  import(@Body() importDto: any) {
    return { message: 'Import PDF' };
  }

  @Get('download/:id')
  download(@Param('id') id: string) {
    return { message: `Download PDF ${id}` };
  }
}
