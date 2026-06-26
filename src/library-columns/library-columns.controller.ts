import {
  Controller,
  Get,
  Post,
  Patch,
  Put,
  Delete,
  Param,
  Body,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { LibraryColumnsService } from './library-columns.service';
import { CreateColumnDto } from './dto/create-column.dto';
import { UpdateColumnDto } from './dto/update-column.dto';
import { SetColumnValuesDto } from './dto/set-column-values.dto';

@UseGuards(JwtAuthGuard)
@Controller()
export class LibraryColumnsController {
  constructor(private readonly svc: LibraryColumnsService) {}

  @Get('folders/:id/columns')
  getColumns(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.getColumns(id);
  }

  @Post('folders/:id/columns')
  createColumn(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: { id: string },
    @Body() dto: CreateColumnDto,
  ) {
    return this.svc.createColumn(id, user.id, dto);
  }

  @Patch('folders/:id/columns/:columnId')
  updateColumn(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('columnId', ParseUUIDPipe) columnId: string,
    @CurrentUser() user: { id: string },
    @Body() dto: UpdateColumnDto,
  ) {
    return this.svc.updateColumn(id, columnId, user.id, dto);
  }

  @Delete('folders/:id/columns/:columnId')
  deleteColumn(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('columnId', ParseUUIDPipe) columnId: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.svc.deleteColumn(id, columnId, user.id);
  }

  @Get('folders/:id/column-values')
  getFolderColumnValues(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.svc.getItemColumnValues(id, 'folder', user.id);
  }

  @Put('folders/:id/column-values')
  setFolderColumnValues(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: { id: string },
    @Body() dto: SetColumnValuesDto,
  ) {
    return this.svc.setItemColumnValues(id, 'folder', user.id, dto);
  }

  @Get('files/:id/column-values')
  getFileColumnValues(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.svc.getItemColumnValues(id, 'file', user.id);
  }

  @Put('files/:id/column-values')
  setFileColumnValues(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: { id: string },
    @Body() dto: SetColumnValuesDto,
  ) {
    return this.svc.setItemColumnValues(id, 'file', user.id, dto);
  }
}
