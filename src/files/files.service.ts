import {
  Injectable,
  Inject,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, and, isNull } from 'drizzle-orm';
import * as path from 'path';
import * as fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import * as schema from '../database/schema';
import { DRIZZLE } from '../database/database.module';
import { StorageService } from '../storage/storage.service';
import { FoldersService } from '../folders/folders.service';
import { UpdateFileDto } from './dto/update-file.dto';

type DrizzleDB = NodePgDatabase<typeof schema>;

interface UploadedFile {
  fieldname: string;
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
  filePath?: string;
}

@Injectable()
export class FilesService {
  constructor(
    @Inject(DRIZZLE) private db: DrizzleDB,
    private readonly storageService: StorageService,
    private readonly foldersService: FoldersService,
  ) {}

  async uploadFiles(
    userId: string,
    files: Express.Multer.File[],
    folderId?: string,
    filePaths?: string[],
  ) {
    const results: schema.File[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const relativePath = filePaths?.[i];

      let targetFolderId = folderId ?? null;

      if (relativePath && relativePath.includes('/')) {
        const pathParts = relativePath.split('/');
        const dirParts = pathParts.slice(0, -1);
        const rootParentId = folderId ?? null;
        targetFolderId = await this.foldersService.createFromPath(
          dirParts,
          userId,
          rootParentId,
        );
      }

      const fileId = uuidv4();
      const sanitizedName = this.storageService.sanitizeFilename(file.originalname);
      const filePath = this.storageService.getFilePath(userId, fileId, sanitizedName);

      fs.writeFileSync(filePath, file.buffer);

      const record = await this.db
        .insert(schema.files)
        .values({
          id: fileId,
          name: sanitizedName,
          originalName: file.originalname,
          path: filePath,
          folderId: targetFolderId,
          userId,
          size: file.size,
          mimeType: file.mimetype,
        })
        .returning();

      results.push(record[0]);
    }

    return results;
  }

  async findById(id: string, userId: string) {
    const result = await this.db
      .select()
      .from(schema.files)
      .where(and(eq(schema.files.id, id), eq(schema.files.userId, userId)))
      .limit(1);

    if (!result[0]) throw new NotFoundException('File not found');
    return result[0];
  }

  async rename(id: string, userId: string, dto: UpdateFileDto) {
    await this.getOwnedFile(id, userId);
    const result = await this.db
      .update(schema.files)
      .set({ name: dto.name })
      .where(and(eq(schema.files.id, id), eq(schema.files.userId, userId)))
      .returning();
    return result[0];
  }

  async softDelete(id: string, userId: string) {
    await this.getOwnedFile(id, userId);
    const result = await this.db
      .update(schema.files)
      .set({ isDeleted: true })
      .where(and(eq(schema.files.id, id), eq(schema.files.userId, userId)))
      .returning();
    return result[0];
  }

  async restore(id: string, userId: string) {
    const file = await this.db
      .select()
      .from(schema.files)
      .where(and(eq(schema.files.id, id), eq(schema.files.userId, userId)))
      .limit(1);

    if (!file[0]) throw new NotFoundException('File not found');

    const result = await this.db
      .update(schema.files)
      .set({ isDeleted: false })
      .where(and(eq(schema.files.id, id), eq(schema.files.userId, userId)))
      .returning();
    return result[0];
  }

  async permanentDelete(id: string, userId: string) {
    const file = await this.getOwnedFile(id, userId);
    await this.storageService.deleteFile(file.path);
    await this.db
      .delete(schema.files)
      .where(and(eq(schema.files.id, id), eq(schema.files.userId, userId)));
    return { success: true };
  }

  async getTrash(userId: string) {
    return this.db
      .select()
      .from(schema.files)
      .where(and(eq(schema.files.userId, userId), eq(schema.files.isDeleted, true)));
  }

  async getDownloadStream(id: string, userId: string) {
    const file = await this.getOwnedFile(id, userId);
    if (!this.storageService.fileExists(file.path)) {
      throw new NotFoundException('File not found on disk');
    }
    return { file, stream: fs.createReadStream(file.path) };
  }

  async ensureFolderPath(userId: string, segments: string[], rootParentId: string | null) {
    return this.foldersService.createFromPath(segments, userId, rootParentId);
  }

  async getRootFiles(userId: string) {
    return this.db
      .select()
      .from(schema.files)
      .where(
        and(
          isNull(schema.files.folderId),
          eq(schema.files.userId, userId),
          eq(schema.files.isDeleted, false),
        ),
      );
  }

  private async getOwnedFile(id: string, userId: string) {
    const result = await this.db
      .select()
      .from(schema.files)
      .where(and(eq(schema.files.id, id), eq(schema.files.userId, userId)))
      .limit(1);
    if (!result[0]) throw new NotFoundException('File not found');
    return result[0];
  }
}
