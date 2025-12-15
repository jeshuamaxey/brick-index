// Script to delete all eBay snapshot files

// Load environment variables from .env.local or .env FIRST
import { config } from 'dotenv';
import path from 'path';

config({ path: path.resolve(process.cwd(), '.env.local') });
config({ path: path.resolve(process.cwd(), '.env') });

import fs from 'node:fs/promises';

const DEFAULT_SNAPSHOT_DIR = path.join(process.cwd(), 'data', 'ebay-snapshots');
const INDEX_FILE = '_index.json';

function parseArgs() {
  const args = process.argv.slice(2);
  const result: { dir?: string; confirm?: boolean } = {};

  for (const arg of args) {
    if (arg.startsWith('--dir=')) {
      result.dir = arg.slice('--dir='.length);
    } else if (arg === '--confirm' || arg === '-y') {
      result.confirm = true;
    }
  }

  return result;
}

async function deleteAllSnapshots(snapshotDir: string, confirmed: boolean) {
  try {
    // Check if directory exists
    try {
      await fs.access(snapshotDir);
    } catch {
      // eslint-disable-next-line no-console
      console.log(`Snapshot directory does not exist: ${snapshotDir}`);
      return;
    }

    // List all files in the directory
    const files = await fs.readdir(snapshotDir);
    const snapshotFiles = files.filter(
      (f) => f.toLowerCase().endsWith('.json') && f !== INDEX_FILE
    );

    if (snapshotFiles.length === 0) {
      // eslint-disable-next-line no-console
      console.log('No snapshot files found to delete.');
      return;
    }

    if (!confirmed) {
      // eslint-disable-next-line no-console
      console.log(
        `Found ${snapshotFiles.length} snapshot file(s) in ${snapshotDir}:`
      );
      snapshotFiles.forEach((file) => {
        // eslint-disable-next-line no-console
        console.log(`  - ${file}`);
      });
      // eslint-disable-next-line no-console
      console.log(
        '\nTo delete all snapshots, run with --confirm or -y flag:'
      );
      // eslint-disable-next-line no-console
      console.log('  npm run seed:delete-ebay-snapshots -- --confirm');
      return;
    }

    // Delete all snapshot files
    let deletedCount = 0;
    for (const file of snapshotFiles) {
      const filePath = path.join(snapshotDir, file);
      try {
        await fs.unlink(filePath);
        deletedCount++;
        // eslint-disable-next-line no-console
        console.log(`Deleted: ${file}`);
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error(`Error deleting ${file}:`, error);
      }
    }

    // Delete or reset the index file
    const indexPath = path.join(snapshotDir, INDEX_FILE);
    try {
      await fs.unlink(indexPath);
      // eslint-disable-next-line no-console
      console.log(`Deleted: ${INDEX_FILE}`);
    } catch (error) {
      // Index file might not exist, which is fine
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        // eslint-disable-next-line no-console
        console.error(`Error deleting ${INDEX_FILE}:`, error);
      }
    }

    // eslint-disable-next-line no-console
    console.log(`\nSuccessfully deleted ${deletedCount} snapshot file(s).`);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error deleting snapshots:', error);
    process.exitCode = 1;
  }
}

async function main() {
  const { dir, confirm } = parseArgs();
  const snapshotDir = dir ?? process.env.EBAY_SNAPSHOT_DIR ?? DEFAULT_SNAPSHOT_DIR;

  await deleteAllSnapshots(snapshotDir, confirm ?? false);
}

// eslint-disable-next-line @typescript-eslint/no-floating-promises
main();

