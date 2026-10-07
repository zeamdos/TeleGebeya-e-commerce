import { Controller, Get, Post, Put, Delete, Body, Param } from '@nestjs/common';

@Controller('pages')
export class PageController {
  @Post()
  create(@Body() createDto: any) {
    return { message: 'Create page' };
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return { message: `Get page ${id}` };
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() updateDto: any) {
    return { message: `Update page ${id}` };
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return { message: `Delete page ${id}` };
  }
}
