import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SearchService } from './search.service';

@UseGuards(JwtAuthGuard)
@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  search(
    @CurrentUser() user: { id: string },
    @Query('q') query: string,
  ) {
    if (!query || query.trim().length === 0) return { files: [], folders: [] };
    return this.searchService.search(user.id, query.trim());
  }
}
