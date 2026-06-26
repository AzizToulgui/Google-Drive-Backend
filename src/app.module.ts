import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { FoldersModule } from './folders/folders.module';
import { FilesModule } from './files/files.module';
import { StorageModule } from './storage/storage.module';
import { SearchModule } from './search/search.module';
import { LibraryColumnsModule } from './library-columns/library-columns.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    StorageModule,
    AuthModule,
    UsersModule,
    LibraryColumnsModule,
    FoldersModule,
    FilesModule,
    SearchModule,
  ],
})
export class AppModule {}
