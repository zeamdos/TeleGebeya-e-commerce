import { Controller, Get, Post, Put, Delete, Body, Param } from '@nestjs/common';

@Controller('sticky-notes')
export class StickyNoteController {
  @Post()
  create(@Body() createDto: any) {
    return { message: 'Create sticky note' };
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return { message: `Get sticky note ${id}` };
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() updateDto: any) {
    return { message: `Update sticky note ${id}` };
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return { message: `Delete sticky note ${id}` };
  }
}
