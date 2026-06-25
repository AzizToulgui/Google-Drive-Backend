import { Injectable, Inject } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, and, ilike, or } from 'drizzle-orm';
import * as schema from '../database/schema';
import { DRIZZLE } from '../database/database.module';

type DrizzleDB = NodePgDatabase<typeof schema>;

@Injectable()
export class SearchService {
  constructor(@Inject(DRIZZLE) private db: DrizzleDB) {}

  async search(userId: string, query: string) {
    const q = `%${query}%`;

    const [files, folders] = await Promise.all([
      this.db
        .select()
        .from(schema.files)
        .where(
          and(
            eq(schema.files.userId, userId),
            eq(schema.files.isDeleted, false),
            ilike(schema.files.name, q),
          ),
        ),
      this.db
        .select()
        .from(schema.folders)
        .where(
          and(
            eq(schema.folders.userId, userId),
            eq(schema.folders.isDeleted, false),
            ilike(schema.folders.name, q),
          ),
        ),
    ]);

    return { files, folders };
  }
}
