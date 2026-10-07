import { Controller, Get, Post, Body, Param, Delete } from '@nestjs/common';

@Controller('notebooks')
export class NotebookController {
  @Get()
  findAll() {
    return { message: 'Get all notebooks' };
  }

  @Post()
  create(@Body() createDto: any) {
    return { message: 'Create notebook' };
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return { message: `Get notebook ${id}` };
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return { message: `Delete notebook ${id}` };
  }
}
