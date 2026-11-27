import { Global, Module } from '@nestjs/common';
import { FileStorage } from './file-storage.js';
import { LocalFileStorage } from './local-file-storage.js';

@Global()
@Module({
  providers: [{ provide: FileStorage, useClass: LocalFileStorage }],
  exports: [FileStorage],
})
export class StorageModule {}
