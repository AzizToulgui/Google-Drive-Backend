import {
  Injectable,
  Inject,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, and, isNull, sql } from 'drizzle-orm';
import * as schema from '../database/schema';
import { DRIZZLE } from '../database/database.module';
import { CreateFolderDto } from './dto/create-folder.dto';
import { UpdateFolderDto } from './dto/update-folder.dto';

type DrizzleDB = NodePgDatabase<typeof schema>;

export interface FolderNode extends schema.Folder {
  children: FolderNode[];
}

@Injectable()
export class FoldersService {
  constructor(@Inject(DRIZZLE) private db: DrizzleDB) {}

  async create(userId: string, dto: CreateFolderDto) {
    if (dto.parentId) {
      await this.getOwnedFolder(dto.parentId, userId);
    }
    const result = await this.db
      .insert(schema.folders)
      .values({ name: dto.name, parentId: dto.parentId ?? null, userId })
      .returning();
    return result[0];
  }

  async getTree(userId: string): Promise<FolderNode[]> {
    const allFolders = await this.db
      .select()
      .from(schema.folders)
      .where(and(eq(schema.folders.userId, userId), eq(schema.folders.isDeleted, false)));

    return this.buildTree(allFolders, null);
  }

  private buildTree(folders: schema.Folder[], parentId: string | null): FolderNode[] {
    return folders
      .filter((f) => f.parentId === parentId)
      .map((f) => ({ ...f, children: this.buildTree(folders, f.id) }));
  }

  async findById(id: string, userId: string) {
    return this.getOwnedFolder(id, userId);
  }

  async rename(id: string, userId: string, dto: UpdateFolderDto) {
    await this.getOwnedFolder(id, userId);
    const result = await this.db
      .update(schema.folders)
      .set({ name: dto.name })
      .where(and(eq(schema.folders.id, id), eq(schema.folders.userId, userId)))
      .returning();
    return result[0];
  }

  async softDelete(id: string, userId: string) {
    await this.getOwnedFolder(id, userId);
    await this.softDeleteRecursive(id, userId);
    return { success: true };
  }

  private async softDeleteRecursive(folderId: string, userId: string) {
    await this.db
      .update(schema.folders)
      .set({ isDeleted: true })
      .where(and(eq(schema.folders.id, folderId), eq(schema.folders.userId, userId)));

    await this.db
      .update(schema.files)
      .set({ isDeleted: true })
      .where(and(eq(schema.files.folderId, folderId), eq(schema.files.userId, userId)));

    const children = await this.db
      .select()
      .from(schema.folders)
      .where(and(eq(schema.folders.parentId, folderId), eq(schema.folders.userId, userId)));

    for (const child of children) {
      await this.softDeleteRecursive(child.id, userId);
    }
  }

  async restore(id: string, userId: string) {
    const folder = await this.db
      .select()
      .from(schema.folders)
      .where(and(eq(schema.folders.id, id), eq(schema.folders.userId, userId)))
      .limit(1);

    if (!folder[0]) throw new NotFoundException('Folder not found');

    const result = await this.db
      .update(schema.folders)
      .set({ isDeleted: false })
      .where(and(eq(schema.folders.id, id), eq(schema.folders.userId, userId)))
      .returning();
    return result[0];
  }

  async getTrash(userId: string) {
    return this.db
      .select()
      .from(schema.folders)
      .where(and(eq(schema.folders.userId, userId), eq(schema.folders.isDeleted, true)));
  }

  async permanentDelete(id: string, userId: string) {
    const folder = await this.db
      .select()
      .from(schema.folders)
      .where(and(eq(schema.folders.id, id), eq(schema.folders.userId, userId)))
      .limit(1);

    if (!folder[0]) throw new NotFoundException('Folder not found');

    await this.db
      .delete(schema.folders)
      .where(and(eq(schema.folders.id, id), eq(schema.folders.userId, userId)));

    return { success: true };
  }

  async getFilesInFolder(folderId: string, userId: string) {
    await this.getOwnedFolder(folderId, userId);
    return this.db
      .select()
      .from(schema.files)
      .where(
        and(
          eq(schema.files.folderId, folderId),
          eq(schema.files.userId, userId),
          eq(schema.files.isDeleted, false),
        ),
      );
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

  private async getOwnedFolder(id: string, userId: string) {
    const result = await this.db
      .select()
      .from(schema.folders)
      .where(and(eq(schema.folders.id, id), eq(schema.folders.userId, userId)))
      .limit(1);
    if (!result[0]) throw new NotFoundException('Folder not found');
    if (result[0].isDeleted) throw new ForbiddenException('Folder is deleted');
    return result[0];
  }

  async createFromPath(
    pathSegments: string[],
    userId: string,
    rootParentId: string | null,
  ): Promise<string | null> {
    if (pathSegments.length === 0) return rootParentId;

    let currentParentId = rootParentId;
    for (const segment of pathSegments) {
      const existing = await this.db
        .select()
        .from(schema.folders)
        .where(
          and(
            eq(schema.folders.name, segment),
            eq(schema.folders.userId, userId),
            currentParentId
              ? eq(schema.folders.parentId, currentParentId)
              : isNull(schema.folders.parentId),
            eq(schema.folders.isDeleted, false),
          ),
        )
        .limit(1);

      if (existing[0]) {
        currentParentId = existing[0].id;
      } else {
        const created = await this.db
          .insert(schema.folders)
          .values({ name: segment, parentId: currentParentId, userId })
          .returning();
        currentParentId = created[0].id;
      }
    }
    return currentParentId;
  }
}
