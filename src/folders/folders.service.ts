import {
  Injectable,
  Inject,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, and, isNull, or, ne } from 'drizzle-orm';
import * as schema from '../database/schema';
import { DRIZZLE } from '../database/database.module';
import { CreateFolderDto } from './dto/create-folder.dto';
import { UpdateFolderDto } from './dto/update-folder.dto';
import { SetVisibilityDto } from './dto/set-visibility.dto';
import { AddSharesDto } from './dto/add-shares.dto';

type DrizzleDB = NodePgDatabase<typeof schema>;

export interface FolderNode extends schema.Folder {
  children: FolderNode[];
}

const folderWithOwnerSelect = {
  id: schema.folders.id,
  name: schema.folders.name,
  parentId: schema.folders.parentId,
  userId: schema.folders.userId,
  visibility: schema.folders.visibility,
  isDeleted: schema.folders.isDeleted,
  createdAt: schema.folders.createdAt,
  ownerEmail: schema.users.email,
};

@Injectable()
export class FoldersService {
  constructor(@Inject(DRIZZLE) private db: DrizzleDB) {}

  async create(userId: string, dto: CreateFolderDto) {
    if (dto.parentId) {
      await this.getAccessibleFolder(dto.parentId, userId);
    }
    const result = await this.db
      .insert(schema.folders)
      .values({ name: dto.name, parentId: dto.parentId ?? null, userId })
      .returning();
    return result[0];
  }

  // Own folder tree – used by sidebar only
  async getTree(userId: string): Promise<FolderNode[]> {
    const allFolders = await this.db
      .select()
      .from(schema.folders)
      .where(and(eq(schema.folders.userId, userId), eq(schema.folders.isDeleted, false)));

    return this.buildTree(allFolders, null);
  }

  // All root-level folders the user can see: own + team public + shared private
  async getAccessibleRoots(userId: string) {
    const ownAndPublic = await this.db
      .select(folderWithOwnerSelect)
      .from(schema.folders)
      .innerJoin(schema.users, eq(schema.folders.userId, schema.users.id))
      .where(
        and(
          isNull(schema.folders.parentId),
          eq(schema.folders.isDeleted, false),
          or(
            eq(schema.folders.userId, userId),
            and(
              eq(schema.folders.visibility, 'public'),
              ne(schema.folders.userId, userId),
            ),
          ),
        ),
      );

    const sharedPrivate = await this.db
      .select(folderWithOwnerSelect)
      .from(schema.folders)
      .innerJoin(schema.users, eq(schema.folders.userId, schema.users.id))
      .innerJoin(schema.folderShares, eq(schema.folderShares.folderId, schema.folders.id))
      .where(
        and(
          isNull(schema.folders.parentId),
          eq(schema.folders.isDeleted, false),
          eq(schema.folderShares.sharedWithUserId, userId),
          ne(schema.folders.userId, userId),
        ),
      );

    const seen = new Set<string>();
    return [...ownAndPublic, ...sharedPrivate]
      .filter((f) => (seen.has(f.id) ? false : seen.add(f.id) && true))
      .map((f) => ({ ...f, isOwner: f.userId === userId }));
  }

  // Direct children of a folder the user can access
  async getAccessibleChildren(folderId: string, userId: string) {
    await this.getAccessibleFolder(folderId, userId);
    const rows = await this.db
      .select(folderWithOwnerSelect)
      .from(schema.folders)
      .innerJoin(schema.users, eq(schema.folders.userId, schema.users.id))
      .where(
        and(eq(schema.folders.parentId, folderId), eq(schema.folders.isDeleted, false)),
      );
    return rows.map((f) => ({ ...f, isOwner: f.userId === userId }));
  }

  // Walk up the parent chain to build breadcrumbs
  async getBreadcrumbs(id: string, userId: string) {
    const crumbs: { id: string; name: string; isOwner: boolean }[] = [];
    let currentId: string | null = id;
    while (currentId) {
      const folder = await this.getAccessibleFolder(currentId, userId);
      crumbs.unshift({ id: folder.id, name: folder.name, isOwner: folder.isOwner });
      currentId = folder.parentId;
    }
    return crumbs;
  }

  async findById(id: string, userId: string) {
    return this.getAccessibleFolder(id, userId);
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

  // Returns all files in the folder – accessible to any user who can view the folder
  async getFilesInFolder(folderId: string, userId: string) {
    await this.getAccessibleFolder(folderId, userId);
    return this.db
      .select()
      .from(schema.files)
      .where(
        and(eq(schema.files.folderId, folderId), eq(schema.files.isDeleted, false)),
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

  // ── Visibility & Sharing ──────────────────────────────────────────────────

  async setVisibility(id: string, userId: string, dto: SetVisibilityDto) {
    await this.getOwnedFolder(id, userId);
    const result = await this.db
      .update(schema.folders)
      .set({ visibility: dto.visibility })
      .where(and(eq(schema.folders.id, id), eq(schema.folders.userId, userId)))
      .returning();
    if (dto.visibility === 'public') {
      await this.db
        .delete(schema.folderShares)
        .where(eq(schema.folderShares.folderId, id));
    }
    return result[0];
  }

  async getShares(id: string, userId: string) {
    await this.getOwnedFolder(id, userId);
    return this.db
      .select({
        id: schema.folderShares.id,
        sharedWithUserId: schema.folderShares.sharedWithUserId,
        email: schema.users.email,
        createdAt: schema.folderShares.createdAt,
      })
      .from(schema.folderShares)
      .innerJoin(schema.users, eq(schema.folderShares.sharedWithUserId, schema.users.id))
      .where(eq(schema.folderShares.folderId, id));
  }

  async addShares(id: string, userId: string, dto: AddSharesDto) {
    await this.getOwnedFolder(id, userId);
    const existing = await this.getShares(id, userId);
    const existingIds = new Set(existing.map((s) => s.sharedWithUserId));
    const newIds = dto.userIds.filter((uid) => uid !== userId && !existingIds.has(uid));
    if (newIds.length > 0) {
      await this.db
        .insert(schema.folderShares)
        .values(newIds.map((uid) => ({ folderId: id, sharedWithUserId: uid })));
    }
    return this.getShares(id, userId);
  }

  async removeShare(folderId: string, userId: string, sharedUserId: string) {
    await this.getOwnedFolder(folderId, userId);
    await this.db
      .delete(schema.folderShares)
      .where(
        and(
          eq(schema.folderShares.folderId, folderId),
          eq(schema.folderShares.sharedWithUserId, sharedUserId),
        ),
      );
    return { success: true };
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private buildTree(folders: schema.Folder[], parentId: string | null): FolderNode[] {
    return folders
      .filter((f) => f.parentId === parentId)
      .map((f) => ({ ...f, children: this.buildTree(folders, f.id) }));
  }

  // Access check: owns it, or it's public, or it's directly shared with user
  private async getAccessibleFolder(id: string, userId: string) {
    const result = await this.db
      .select(folderWithOwnerSelect)
      .from(schema.folders)
      .innerJoin(schema.users, eq(schema.folders.userId, schema.users.id))
      .where(and(eq(schema.folders.id, id), eq(schema.folders.isDeleted, false)))
      .limit(1);

    if (!result[0]) throw new NotFoundException('Folder not found');
    const folder = result[0];

    if (folder.userId === userId) return { ...folder, isOwner: true };
    if (folder.visibility === 'public') return { ...folder, isOwner: false };

    const share = await this.db
      .select()
      .from(schema.folderShares)
      .where(
        and(
          eq(schema.folderShares.folderId, id),
          eq(schema.folderShares.sharedWithUserId, userId),
        ),
      )
      .limit(1);

    if (share[0]) return { ...folder, isOwner: false };
    throw new ForbiddenException('Access denied');
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
