import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  ParseUUIDPipe,
  Query,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { FoldersService } from './folders.service';
import { CreateFolderDto } from './dto/create-folder.dto';
import { UpdateFolderDto } from './dto/update-folder.dto';

@UseGuards(JwtAuthGuard)
@Controller()
export class FoldersController {
  constructor(private readonly foldersService: FoldersService) {}

  @Post('folders')
  create(
    @CurrentUser() user: { id: string },
    @Body() dto: CreateFolderDto,
  ) {
    return this.foldersService.create(user.id, dto);
  }

  @Get('folders/tree')
  getTree(@CurrentUser() user: { id: string }) {
    return this.foldersService.getTree(user.id);
  }

  @Get('folders/trash')
  getTrash(@CurrentUser() user: { id: string }) {
    return this.foldersService.getTrash(user.id);
  }

  @Get('folders/:id')
  findById(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.foldersService.findById(id, user.id);
  }

  @Patch('folders/:id')
  rename(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: { id: string },
    @Body() dto: UpdateFolderDto,
  ) {
    return this.foldersService.rename(id, user.id, dto);
  }

  @Delete('folders/:id')
  softDelete(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.foldersService.softDelete(id, user.id);
  }

  @Post('folders/:id/restore')
  restore(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.foldersService.restore(id, user.id);
  }

  @Delete('folders/:id/permanent')
  permanentDelete(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.foldersService.permanentDelete(id, user.id);
  }

  @Get('folders/:id/files')
  getFilesInFolder(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.foldersService.getFilesInFolder(id, user.id);
  }
}
