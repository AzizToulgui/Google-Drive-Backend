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
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { FoldersService } from './folders.service';
import { CreateFolderDto } from './dto/create-folder.dto';
import { UpdateFolderDto } from './dto/update-folder.dto';
import { SetVisibilityDto } from './dto/set-visibility.dto';
import { AddSharesDto } from './dto/add-shares.dto';

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

  // Own folder tree for the sidebar
  @Get('folders/tree')
  getTree(@CurrentUser() user: { id: string }) {
    return this.foldersService.getTree(user.id);
  }

  // All root-level folders visible to the current user (own + team public + shared)
  @Get('folders/accessible')
  getAccessibleRoots(@CurrentUser() user: { id: string }) {
    return this.foldersService.getAccessibleRoots(user.id);
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

  // Direct children of any accessible folder
  @Get('folders/:id/children')
  getChildren(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.foldersService.getAccessibleChildren(id, user.id);
  }

  // Files in any accessible folder
  @Get('folders/:id/files')
  getFilesInFolder(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.foldersService.getFilesInFolder(id, user.id);
  }

  // Breadcrumb chain for any accessible folder
  @Get('folders/:id/breadcrumbs')
  getBreadcrumbs(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.foldersService.getBreadcrumbs(id, user.id);
  }

  @Patch('folders/:id/visibility')
  setVisibility(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: { id: string },
    @Body() dto: SetVisibilityDto,
  ) {
    return this.foldersService.setVisibility(id, user.id, dto);
  }

  @Get('folders/:id/shares')
  getShares(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.foldersService.getShares(id, user.id);
  }

  @Post('folders/:id/shares')
  addShares(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: { id: string },
    @Body() dto: AddSharesDto,
  ) {
    return this.foldersService.addShares(id, user.id, dto);
  }

  @Delete('folders/:id/shares/:sharedUserId')
  removeShare(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('sharedUserId', ParseUUIDPipe) sharedUserId: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.foldersService.removeShare(id, user.id, sharedUserId);
  }
}
