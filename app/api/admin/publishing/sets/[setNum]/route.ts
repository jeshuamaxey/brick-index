// Admin API endpoint for managing individual set publishing overrides
// Requires backend.manage permission

import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth/auth-helpers';
import { supabaseServer } from '@/lib/supabase/server';
import { PublishingService } from '@/lib/publishing/publishing-service';

/**
 * GET - Get set publish status
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ setNum: string }> }
) {
  try {
    // Check permission
    await requirePermission('backend.manage');

    const { setNum } = await params;

    // Get the set
    const { data: set, error: setError } = await supabaseServer
      .schema('catalog')
      .from('lego_sets')
      .select('*')
      .eq('set_num', setNum)
      .single();

    if (setError || !set) {
      return NextResponse.json(
        { error: 'Set not found' },
        { status: 404 }
      );
    }

    // Get theme publish status
    let isThemePublished = false;
    if (set.theme_id) {
      const { data: themeStatus } = await supabaseServer
        .schema('catalog')
        .from('published_themes')
        .select('is_published')
        .eq('theme_id', set.theme_id)
        .single();
      isThemePublished = themeStatus?.is_published ?? false;
    }

    // Calculate effective publish status
    const effectivelyPublished =
      set.publish_override !== null
        ? set.publish_override
        : isThemePublished;

    return NextResponse.json({
      set: {
        id: set.id,
        setNum: set.set_num,
        name: set.name,
        themeId: set.theme_id,
        publishOverride: set.publish_override,
        isThemePublished,
        effectivelyPublished,
      },
    });
  } catch (error) {
    console.error('Error fetching set:', error);

    if (error instanceof Error && error.message.includes('Permission required')) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }
    if (error instanceof Error && error.message.includes('Authentication required')) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH - Set or clear publish override for a set
 * Body: { publishOverride: boolean | null }
 * - true = force publish
 * - false = force unpublish
 * - null = inherit from theme
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ setNum: string }> }
) {
  try {
    // Check permission
    await requirePermission('backend.manage');

    const { setNum } = await params;
    const body = await request.json();
    const { publishOverride } = body;

    // Validate publishOverride
    if (publishOverride !== null && typeof publishOverride !== 'boolean') {
      return NextResponse.json(
        { error: 'publishOverride must be a boolean or null' },
        { status: 400 }
      );
    }

    // Get the set
    const { data: set, error: setError } = await supabaseServer
      .schema('catalog')
      .from('lego_sets')
      .select('id')
      .eq('set_num', setNum)
      .single();

    if (setError || !set) {
      return NextResponse.json(
        { error: 'Set not found' },
        { status: 404 }
      );
    }

    // Update the override
    const publishingService = new PublishingService(supabaseServer);
    await publishingService.setPublishOverride(set.id, publishOverride);

    // Get updated status
    const isPublished = await publishingService.isSetPublished(set.id);

    return NextResponse.json({
      success: true,
      setNum,
      publishOverride,
      effectivelyPublished: isPublished,
    });
  } catch (error) {
    console.error('Error updating set:', error);

    if (error instanceof Error && error.message.includes('Permission required')) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }
    if (error instanceof Error && error.message.includes('Authentication required')) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
