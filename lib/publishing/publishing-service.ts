// Service to manage theme and set publishing for consumer visibility

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/supabase.types';
import type { LegoSet, Theme, PublishedTheme } from '@/lib/types';

export interface PublishedSetInfo {
  id: string;
  setNum: string;
  name: string;
  year: number | null;
  themeId: number | null;
  numParts: number | null;
  setImgUrl: string | null;
  setUrl: string | null;
  publishOverride: boolean | null;
  isThemePublished: boolean;
}

export interface ThemeWithPublishStatus extends Theme {
  isPublished: boolean;
  publishedAt: string | null;
  setCount: number;
}

export class PublishingService {
  constructor(private supabase: SupabaseClient<Database>) {}

  /**
   * Get all published sets using the database function
   */
  async getPublishedSets(): Promise<PublishedSetInfo[]> {
    const { data, error } = await this.supabase
      .schema('catalog')
      .rpc('get_published_sets');

    if (error) {
      throw new Error(`Failed to get published sets: ${error.message}`);
    }

    return (data || []).map((row: {
      id: string;
      set_num: string;
      name: string;
      year: number;
      theme_id: number;
      num_parts: number;
      set_img_url: string;
      set_url: string;
      publish_override: boolean;
      is_theme_published: boolean;
    }) => ({
      id: row.id,
      setNum: row.set_num,
      name: row.name,
      year: row.year,
      themeId: row.theme_id,
      numParts: row.num_parts,
      setImgUrl: row.set_img_url,
      setUrl: row.set_url,
      publishOverride: row.publish_override,
      isThemePublished: row.is_theme_published,
    }));
  }

  /**
   * Get a single published set by set number
   */
  async getPublishedSetBySetNum(setNum: string): Promise<PublishedSetInfo | null> {
    const sets = await this.getPublishedSets();
    return sets.find((s) => s.setNum === setNum) || null;
  }

  /**
   * Check if a specific set is published
   */
  async isSetPublished(setId: string): Promise<boolean> {
    // Get the set with its theme publishing status
    const { data: set, error: setError } = await this.supabase
      .schema('catalog')
      .from('lego_sets')
      .select('publish_override, theme_id')
      .eq('id', setId)
      .single();

    if (setError || !set) {
      return false;
    }

    // If there's an override, use it
    if (set.publish_override !== null) {
      return set.publish_override;
    }

    // Otherwise, check if the theme is published
    if (!set.theme_id) {
      return false;
    }

    const { data: themePublished } = await this.supabase
      .schema('catalog')
      .from('published_themes')
      .select('is_published')
      .eq('theme_id', set.theme_id)
      .single();

    return themePublished?.is_published ?? false;
  }

  /**
   * Publish a theme (make all sets in theme visible to consumers)
   */
  async publishTheme(themeId: number): Promise<void> {
    const now = new Date().toISOString();

    const { error } = await this.supabase
      .schema('catalog')
      .from('published_themes')
      .upsert(
        {
          theme_id: themeId,
          is_published: true,
          published_at: now,
          updated_at: now,
        },
        {
          onConflict: 'theme_id',
        }
      );

    if (error) {
      throw new Error(`Failed to publish theme: ${error.message}`);
    }
  }

  /**
   * Unpublish a theme (hide all sets in theme from consumers, unless individually published)
   */
  async unpublishTheme(themeId: number): Promise<void> {
    const { error } = await this.supabase
      .schema('catalog')
      .from('published_themes')
      .upsert(
        {
          theme_id: themeId,
          is_published: false,
          published_at: null,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'theme_id',
        }
      );

    if (error) {
      throw new Error(`Failed to unpublish theme: ${error.message}`);
    }
  }

  /**
   * Set publishing override for an individual set
   * @param setId The set ID
   * @param override TRUE = force publish, FALSE = force unpublish, NULL = inherit from theme
   */
  async setPublishOverride(setId: string, override: boolean | null): Promise<void> {
    const { error } = await this.supabase
      .schema('catalog')
      .from('lego_sets')
      .update({
        publish_override: override,
        updated_at: new Date().toISOString(),
      })
      .eq('id', setId);

    if (error) {
      throw new Error(`Failed to set publish override: ${error.message}`);
    }
  }

  /**
   * Get all themes with their publish status and set counts
   */
  async getThemesWithPublishStatus(): Promise<ThemeWithPublishStatus[]> {
    // Get all themes
    const { data: themes, error: themesError } = await this.supabase
      .schema('catalog')
      .from('themes')
      .select('*')
      .order('name');

    if (themesError) {
      throw new Error(`Failed to get themes: ${themesError.message}`);
    }

    // Get publish status for all themes
    const { data: publishedThemes, error: publishedError } = await this.supabase
      .schema('catalog')
      .from('published_themes')
      .select('theme_id, is_published, published_at');

    if (publishedError) {
      throw new Error(`Failed to get published themes: ${publishedError.message}`);
    }

    // Get set counts per theme
    const { data: setCounts, error: countError } = await this.supabase
      .schema('catalog')
      .from('lego_sets')
      .select('theme_id')
      .not('theme_id', 'is', null);

    if (countError) {
      throw new Error(`Failed to get set counts: ${countError.message}`);
    }

    // Count sets per theme
    const setCountMap = new Map<number, number>();
    for (const set of setCounts || []) {
      if (set.theme_id) {
        setCountMap.set(set.theme_id, (setCountMap.get(set.theme_id) || 0) + 1);
      }
    }

    // Create publish status map
    const publishStatusMap = new Map<number, { isPublished: boolean; publishedAt: string | null }>();
    for (const pt of publishedThemes || []) {
      publishStatusMap.set(pt.theme_id, {
        isPublished: pt.is_published,
        publishedAt: pt.published_at,
      });
    }

    // Combine data
    return (themes || []).map((theme) => {
      const status = publishStatusMap.get(theme.id);
      return {
        ...theme,
        isPublished: status?.isPublished ?? false,
        publishedAt: status?.publishedAt ?? null,
        setCount: setCountMap.get(theme.id) ?? 0,
      };
    });
  }

  /**
   * Get sets by theme with their publish status
   */
  async getSetsByTheme(themeId: number): Promise<(LegoSet & { effectivelyPublished: boolean })[]> {
    // Get theme publish status
    const { data: themeStatus } = await this.supabase
      .schema('catalog')
      .from('published_themes')
      .select('is_published')
      .eq('theme_id', themeId)
      .single();

    const isThemePublished = themeStatus?.is_published ?? false;

    // Get all sets in the theme
    const { data: sets, error } = await this.supabase
      .schema('catalog')
      .from('lego_sets')
      .select('*')
      .eq('theme_id', themeId)
      .order('year', { ascending: false });

    if (error) {
      throw new Error(`Failed to get sets: ${error.message}`);
    }

    return (sets || []).map((set) => ({
      ...set,
      effectivelyPublished:
        set.publish_override !== null ? set.publish_override : isThemePublished,
    }));
  }
}
