import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFiles,
  Res,
  ParseUUIDPipe,
  BadRequestException,
  Query,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import * as path from 'path';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { FilesService } from './files.service';
import { UpdateFileDto } from './dto/update-file.dto';

@UseGuards(JwtAuthGuard)
@Controller('files')
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @Post('upload')
  @UseInterceptors(
    FilesInterceptor('files', 100, {
      storage: undefined, // use memoryStorage (default when storage is undefined)
      limits: { fileSize: 100 * 1024 * 1024 }, // 100MB per file
    }),
  )
  async upload(
    @CurrentUser() user: { id: string },
    @UploadedFiles() files: Express.Multer.File[],
    @Body('folderId') folderId?: string,
    @Body('paths') paths?: string | string[],
    @Body('emptyFolders') emptyFolders?: string | string[],
  ) {
    const filePaths = paths
      ? Array.isArray(paths) ? paths : [paths]
      : undefined;

    const emptyFolderPaths = emptyFolders
      ? Array.isArray(emptyFolders) ? emptyFolders : [emptyFolders]
      : [];

    // Create empty folder structures first (idempotent — skips if already exists)
    for (const folderPath of emptyFolderPaths) {
      const segments = folderPath.split('/').filter(Boolean);
      if (segments.length > 0) {
        await this.filesService.ensureFolderPath(user.id, segments, folderId ?? null);
      }
    }

    if (!files || files.length === 0) return [];

    return this.filesService.uploadFiles(user.id, files, folderId, filePaths);
  }

  @Get('root')
  getRootFiles(@CurrentUser() user: { id: string }) {
    return this.filesService.getRootFiles(user.id);
  }

  @Get('trash')
  getTrash(@CurrentUser() user: { id: string }) {
    return this.filesService.getTrash(user.id);
  }

  @Get(':id/download')
  async download(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: { id: string },
    @Res() res: Response,
  ) {
    const { file, stream } = await this.filesService.getDownloadStream(id, user.id);
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(file.name)}"`);
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Content-Length', file.size.toString());
    stream.pipe(res);
  }

  @Get(':id/preview')
  async preview(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: { id: string },
    @Res() res: Response,
  ) {
    const { file, stream } = await this.filesService.getDownloadStream(id, user.id);
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(file.name)}"`);
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Content-Length', file.size.toString());
    stream.pipe(res);
  }

  @Patch(':id')
  rename(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: { id: string },
    @Body() dto: UpdateFileDto,
  ) {
    return this.filesService.rename(id, user.id, dto);
  }

  @Delete(':id')
  softDelete(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.filesService.softDelete(id, user.id);
  }

  @Post(':id/restore')
  restore(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.filesService.restore(id, user.id);
  }

  @Delete(':id/permanent')
  permanentDelete(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.filesService.permanentDelete(id, user.id);
  }
}
