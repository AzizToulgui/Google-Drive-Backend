import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as path from 'path';
import * as fs from 'fs';

@Injectable()
export class StorageService {
  private readonly uploadDir: string;

  constructor(private readonly config: ConfigService) {
    this.uploadDir = path.resolve(config.get<string>('UPLOAD_DIR', 'uploads'));
    fs.mkdirSync(this.uploadDir, { recursive: true });
  }

  sanitizeFilename(filename: string): string {
    return filename
      .replace(/[^a-zA-Z0-9._\-À-ɏ ]/g, '_')
      .replace(/\.{2,}/g, '.')
      .replace(/^\./, '_')
      .substring(0, 255);
  }

  getUserDir(userId: string): string {
    const dir = path.join(this.uploadDir, userId);
    fs.mkdirSync(dir, { recursive: true });
    return dir;
  }

  getFilePath(userId: string, fileId: string, filename: string): string {
    const dir = path.join(this.getUserDir(userId), fileId);
    fs.mkdirSync(dir, { recursive: true });
    return path.join(dir, this.sanitizeFilename(filename));
  }

  async deleteFile(filePath: string): Promise<void> {
    try {
      fs.unlinkSync(filePath);
      const dir = path.dirname(filePath);
      const files = fs.readdirSync(dir);
      if (files.length === 0) fs.rmdirSync(dir);
    } catch {
      // File may already be gone
    }
  }

  fileExists(filePath: string): boolean {
    return fs.existsSync(filePath);
  }
}
