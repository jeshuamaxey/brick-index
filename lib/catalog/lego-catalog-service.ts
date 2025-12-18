// Service to refresh LEGO sets catalog from Rebrickable CSV files
// Provides methods that can be called from Inngest steps for orchestration

import { gunzipSync } from 'zlib';
import { parse } from 'csv-parse';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/supabase.types';

const REBRICKABLE_CDN_BASE_URL = 'https://cdn.rebrickable.com/media/downloads/';

// Exported interfaces for use by Inngest function
export interface CsvFileMetadata {
  filename: string;
  etag: string | null;
  last_modified: string | null;
  content_length: number | null;
  last_checked_at: string | null;
  last_downloaded_at: string | null;
}

export interface FileMetadata {
  etag: string | null;
  last_modified: string | null;
  content_length: number | null;
}

export interface LegoSetData {
  set_num: string;
  name: string;
  year: number | null;
  theme_id: number | null;
  num_parts: number | null;
  set_img_url: string | null;
  set_url: string | null;
  last_modified: string | null;
}

export interface ThemeData {
  id: number;
  name: string;
  parent_id: number | null;
}

export interface ParsedCsvData {
  themes?: ThemeData[];
  sets?: LegoSetData[];
}

export interface UpsertResult {
  found: number;
  new: number;
  updated: number;
}

export class LegoCatalogService {
  constructor(private supabase: SupabaseClient<Database>) {}

  /**
   * Check if a CSV file has changed using HTTP conditional requests
   * Uses both ETag (primary) and Last-Modified (fallback) for reliability
   */
  async checkFileChanged(
    filename: string
  ): Promise<{ changed: boolean; metadata?: FileMetadata }> {
    // 1. Get last known metadata from database
    const lastMetadata = await this.getCsvMetadata(filename);

    // 2. Build conditional request headers
    const headers: HeadersInit = {};
    if (lastMetadata?.etag) {
      // ETag format from server: "694257c4-73615" (quoted)
      headers['If-None-Match'] = lastMetadata.etag;
    }
    if (lastMetadata?.last_modified) {
      // Last-Modified format: RFC 1123 date string
      const lastModifiedDate = new Date(lastMetadata.last_modified);
      headers['If-Modified-Since'] = lastModifiedDate.toUTCString();
    }

    // 3. Make HEAD request (no body download)
    const csvUrl = `${REBRICKABLE_CDN_BASE_URL}${filename}`;
    const response = await fetch(csvUrl, { method: 'HEAD', headers });

    // 4. Handle 304 Not Modified
    if (response.status === 304) {
      // Update last_checked_at but don't download
      await this.updateCsvFileMetadata(filename, {
        last_checked_at: new Date().toISOString(),
      });
      return { changed: false };
    }

    // 5. File changed - extract new metadata
    if (!response.ok) {
      throw new Error(
        `Failed to check ${filename}: ${response.status} ${response.statusText}`
      );
    }

    // Extract headers (validated to exist on this server)
    const etag = response.headers.get('ETag'); // e.g., "694257c4-73615"
    const lastModified = response.headers.get('Last-Modified'); // RFC 1123 format
    const contentLength = response.headers.get('Content-Length');

    return {
      changed: true,
      metadata: {
        etag: etag || null,
        last_modified: lastModified
          ? new Date(lastModified).toISOString()
          : null,
        content_length: contentLength ? parseInt(contentLength, 10) : null,
      },
    };
  }

  /**
   * Download and parse a CSV file from Rebrickable CDN
   * Returns parsed data based on file type
   */
  async downloadAndParseCsv(filename: string): Promise<ParsedCsvData> {
    // Download the file
    const csvContent = await this.downloadCsvFile(filename);

    // Parse based on file type
    if (filename === 'themes.csv.gz') {
      const themes = await this.parseThemesCsv(csvContent);
      return { themes };
    } else if (filename === 'sets.csv.gz') {
      const sets = await this.parseSetsCsv(csvContent);
      return { sets };
    }

    throw new Error(`Unknown CSV file type: ${filename}`);
  }

  /**
   * Upsert themes to database
   */
  async upsertThemes(themes: ThemeData[]): Promise<UpsertResult> {
    if (themes.length === 0) {
      return { found: 0, new: 0, updated: 0 };
    }

    const totalThemes = themes.length;

    // Upsert themes
    const { error } = await this.supabase
      .schema('catalog')
      .from('themes')
      .upsert(
        themes.map((theme) => ({
          id: theme.id,
          name: theme.name,
          parent_id: theme.parent_id,
        })),
        {
          onConflict: 'id',
          ignoreDuplicates: false,
        }
      );

    if (error) {
      throw new Error(`Failed to upsert themes: ${error.message}`);
    }

    // Count new vs updated (simplified)
    const { count: existingCount } = await this.supabase
      .schema('catalog')
      .from('themes')
      .select('*', { count: 'exact', head: true });

    const newCount = Math.max(0, totalThemes - (existingCount || 0));
    const updatedCount = totalThemes - newCount;

    return {
      found: totalThemes,
      new: newCount,
      updated: updatedCount,
    };
  }

  /**
   * Upsert a batch of sets to database
   */
  async upsertSetsBatch(sets: LegoSetData[]): Promise<{ updated: number }> {
    if (sets.length === 0) {
      return { updated: 0 };
    }

    // Use PostgreSQL UPSERT (ON CONFLICT)
    const { error } = await this.supabase
      .schema('catalog')
      .from('lego_sets')
      .upsert(
        sets.map((set) => ({
          set_num: set.set_num,
          name: set.name,
          year: set.year,
          theme_id: set.theme_id,
          num_parts: set.num_parts,
          set_img_url: set.set_img_url,
          set_url: set.set_url,
          last_modified: set.last_modified
            ? new Date(set.last_modified).toISOString()
            : null,
        })),
        {
          onConflict: 'set_num',
          ignoreDuplicates: false,
        }
      );

    if (error) {
      throw new Error(`Failed to upsert sets batch: ${error.message}`);
    }

    return { updated: sets.length };
  }

  /**
   * Update CSV file metadata in database
   */
  async updateCsvFileMetadata(
    filename: string,
    metadata: Partial<CsvFileMetadata>
  ): Promise<void> {
    const { error } = await this.supabase
      .schema('catalog')
      .from('csv_file_metadata')
      .upsert(
        {
          filename,
          ...metadata,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'filename',
        }
      );

    if (error) {
      throw new Error(`Failed to update CSV metadata: ${error.message}`);
    }
  }

  /**
   * Download CSV file from Rebrickable CDN
   */
  private async downloadCsvFile(filename: string): Promise<string> {
    const csvUrl = `${REBRICKABLE_CDN_BASE_URL}${filename}`;

    const response = await fetch(csvUrl);

    if (!response.ok) {
      throw new Error(
        `Failed to download ${filename}: ${response.status} ${response.statusText}`
      );
    }

    // Decompress gzip and return as string
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    try {
      const decompressed = gunzipSync(buffer);
      return decompressed.toString('utf-8');
    } catch (error) {
      throw new Error(`Failed to decompress ${filename}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Parse themes CSV content
   */
  private async parseThemesCsv(csvContent: string): Promise<ThemeData[]> {
    const records = await this.parseCsvContent(csvContent, ['id', 'parent_id']);
    
    return records.map((record) => ({
      id: record.id,
      name: record.name || '',
      parent_id: record.parent_id ?? null,
    }));
  }

  /**
   * Parse sets CSV content
   */
  private async parseSetsCsv(csvContent: string): Promise<LegoSetData[]> {
    const records = await this.parseCsvContent(csvContent, ['year', 'theme_id', 'num_parts']);
    
    return records.map((record) => ({
      set_num: record.set_num || '',
      name: record.name || '',
      year: record.year ?? null,
      theme_id: record.theme_id ?? null,
      num_parts: record.num_parts ?? null,
      set_img_url: record.set_img_url || null,
      set_url: record.set_url || null,
      last_modified: record.last_modified_dt || null,
    }));
  }

  /**
   * Generic CSV parsing with numeric field casting
   */
  private async parseCsvContent(
    csvContent: string,
    numericFields: string[]
  ): Promise<any[]> {
    return new Promise<any[]>((resolve, reject) => {
      const records: any[] = [];
      const parser = parse({
        columns: true,
        skip_empty_lines: true,
        cast: (value, context) => {
          // Handle numeric fields
          if (numericFields.includes(context.column as string)) {
            const num = parseInt(value, 10);
            return isNaN(num) ? null : num;
          }
          return value || null;
        },
      });

      parser.on('readable', () => {
        let record;
        while ((record = parser.read()) !== null) {
          records.push(record);
        }
      });

      parser.on('error', reject);
      parser.on('end', () => resolve(records));

      parser.write(csvContent);
      parser.end();
    });
  }

  /**
   * Get CSV file metadata from database
   */
  private async getCsvMetadata(
    filename: string
  ): Promise<CsvFileMetadata | null> {
    const { data, error } = await this.supabase
      .schema('catalog')
      .from('csv_file_metadata')
      .select('*')
      .eq('filename', filename)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // Not found - return null
        return null;
      }
      throw new Error(`Failed to get CSV metadata: ${error.message}`);
    }

    return data as CsvFileMetadata;
  }
}
