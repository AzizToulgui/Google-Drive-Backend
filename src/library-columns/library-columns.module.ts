import { Module } from '@nestjs/common';
import { LibraryColumnsController } from './library-columns.controller';
import { LibraryColumnsService } from './library-columns.service';

@Module({
  controllers: [LibraryColumnsController],
  providers: [LibraryColumnsService],
  exports: [LibraryColumnsService],
})
export class LibraryColumnsModule {}
