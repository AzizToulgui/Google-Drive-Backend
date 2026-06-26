import {
  Injectable,
  Inject,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, and, max, inArray } from 'drizzle-orm';
import * as schema from '../database/schema';
import { DRIZZLE } from '../database/database.module';
import { CreateColumnDto } from './dto/create-column.dto';
import { UpdateColumnDto } from './dto/update-column.dto';
import { SetColumnValuesDto } from './dto/set-column-values.dto';

type DrizzleDB = NodePgDatabase<typeof schema>;

@Injectable()
export class LibraryColumnsService {
  constructor(@Inject(DRIZZLE) private db: DrizzleDB) {}

  private async findLibraryRootForFolder(folderId: string): Promise<string> {
    let currentId: string | null = folderId;
    while (currentId) {
      const [row] = await this.db
        .select({ id: schema.folders.id, parentId: schema.folders.parentId })
        .from(schema.folders)
        .where(eq(schema.folders.id, currentId))
        .limit(1);
      if (!row) throw new NotFoundException(`Folder ${currentId} not found`);
      if (row.parentId === null) return row.id;
      currentId = row.parentId;
    }
    throw new NotFoundException('Library root not found');
  }

  private async findLibraryRootForFile(fileId: string): Promise<string> {
    const [file] = await this.db
      .select({ folderId: schema.files.folderId })
      .from(schema.files)
      .where(eq(schema.files.id, fileId))
      .limit(1);
    if (!file) throw new NotFoundException('File not found');
    if (!file.folderId)
      throw new BadRequestException('File is at root level, not inside a library');
    return this.findLibraryRootForFolder(file.folderId);
  }

  private async assertIsLibraryRoot(folderId: string): Promise<void> {
    const [row] = await this.db
      .select({ parentId: schema.folders.parentId })
      .from(schema.folders)
      .where(eq(schema.folders.id, folderId))
      .limit(1);
    if (!row) throw new NotFoundException('Folder not found');
    if (row.parentId !== null)
      throw new BadRequestException('Folder is not a library root');
  }

  private async requireLibraryOwner(libraryId: string, userId: string): Promise<void> {
    const [row] = await this.db
      .select({ userId: schema.folders.userId, isDeleted: schema.folders.isDeleted })
      .from(schema.folders)
      .where(eq(schema.folders.id, libraryId))
      .limit(1);
    if (!row || row.isDeleted) throw new NotFoundException('Library not found');
    if (row.userId !== userId) throw new ForbiddenException('You do not own this library');
  }

  async getColumns(libraryId: string): Promise<schema.LibraryColumn[]> {
    return this.db
      .select()
      .from(schema.libraryColumns)
      .where(eq(schema.libraryColumns.libraryId, libraryId))
      .orderBy(schema.libraryColumns.position);
  }

  async createColumn(
    libraryId: string,
    userId: string,
    dto: CreateColumnDto,
  ): Promise<schema.LibraryColumn> {
    await this.assertIsLibraryRoot(libraryId);
    await this.requireLibraryOwner(libraryId, userId);

    const [maxRow] = await this.db
      .select({ maxPos: max(schema.libraryColumns.position) })
      .from(schema.libraryColumns)
      .where(eq(schema.libraryColumns.libraryId, libraryId));

    const nextPosition = (maxRow?.maxPos ?? -1) + 1;

    const [col] = await this.db
      .insert(schema.libraryColumns)
      .values({
        libraryId,
        name: dto.name,
        type: dto.type,
        enumOptions: dto.enumOptions ?? null,
        defaultValue: dto.defaultValue ?? null,
        position: nextPosition,
      })
      .returning();
    return col;
  }

  async updateColumn(
    libraryId: string,
    columnId: string,
    userId: string,
    dto: UpdateColumnDto,
  ): Promise<schema.LibraryColumn> {
    await this.requireLibraryOwner(libraryId, userId);

    const [existing] = await this.db
      .select()
      .from(schema.libraryColumns)
      .where(
        and(
          eq(schema.libraryColumns.id, columnId),
          eq(schema.libraryColumns.libraryId, libraryId),
        ),
      )
      .limit(1);
    if (!existing) throw new NotFoundException('Column not found');

    const [updated] = await this.db
      .update(schema.libraryColumns)
      .set({
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.type !== undefined && { type: dto.type }),
        ...(dto.enumOptions !== undefined && { enumOptions: dto.enumOptions }),
        ...(dto.defaultValue !== undefined && { defaultValue: dto.defaultValue }),
        ...(dto.position !== undefined && { position: dto.position }),
      })
      .where(eq(schema.libraryColumns.id, columnId))
      .returning();
    return updated;
  }

  async deleteColumn(
    libraryId: string,
    columnId: string,
    userId: string,
  ): Promise<{ success: boolean }> {
    await this.requireLibraryOwner(libraryId, userId);
    await this.db
      .delete(schema.libraryColumns)
      .where(
        and(
          eq(schema.libraryColumns.id, columnId),
          eq(schema.libraryColumns.libraryId, libraryId),
        ),
      );
    return { success: true };
  }

  async getItemColumnValues(
    itemId: string,
    itemType: 'file' | 'folder',
    userId: string,
  ): Promise<{ columns: schema.LibraryColumn[]; values: Record<string, string | null> }> {
    const libraryId =
      itemType === 'folder'
        ? await this.findLibraryRootForFolder(itemId)
        : await this.findLibraryRootForFile(itemId);

    const columns = await this.getColumns(libraryId);

    const storedValues = await this.db
      .select()
      .from(schema.itemColumnValues)
      .where(
        and(
          eq(schema.itemColumnValues.itemId, itemId),
          eq(schema.itemColumnValues.itemType, itemType),
        ),
      );

    const valuesMap: Record<string, string | null> = {};
    for (const col of columns) {
      const stored = storedValues.find((v) => v.columnId === col.id);
      valuesMap[col.id] = stored !== undefined ? stored.value : (col.defaultValue ?? null);
    }

    return { columns, values: valuesMap };
  }

  async setItemColumnValues(
    itemId: string,
    itemType: 'file' | 'folder',
    userId: string,
    dto: SetColumnValuesDto,
  ): Promise<{ success: boolean }> {
    const libraryId =
      itemType === 'folder'
        ? await this.findLibraryRootForFolder(itemId)
        : await this.findLibraryRootForFile(itemId);

    const validCols = await this.db
      .select({ id: schema.libraryColumns.id })
      .from(schema.libraryColumns)
      .where(eq(schema.libraryColumns.libraryId, libraryId));
    const validIdSet = new Set(validCols.map((c) => c.id));

    for (const entry of dto.values) {
      if (!validIdSet.has(entry.columnId)) continue;
      await this.db
        .insert(schema.itemColumnValues)
        .values({
          columnId: entry.columnId,
          itemId,
          itemType,
          value: entry.value ?? null,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [
            schema.itemColumnValues.columnId,
            schema.itemColumnValues.itemId,
            schema.itemColumnValues.itemType,
          ],
          set: { value: entry.value ?? null, updatedAt: new Date() },
        });
    }

    return { success: true };
  }
}
