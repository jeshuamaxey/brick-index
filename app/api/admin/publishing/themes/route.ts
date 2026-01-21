// Admin API endpoint for managing theme publishing
// Requires backend.manage permission

import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth/auth-helpers';
import { supabaseServer } from '@/lib/supabase/server';
import { PublishingService } from '@/lib/publishing/publishing-service';

/**
 * GET - List all themes with their publish status
 * Returns all themes from the catalog
 */
export async function GET() {
  try {
    // Check permission
    await requirePermission('backend.manage');

    const publishingService = new PublishingService(supabaseServer);
    const themes = await publishingService.getThemesWithPublishStatus();

    // Return all themes - no filtering
    // The UI will handle showing the hierarchy and can filter by set count if needed
    return NextResponse.json({
      themes,
      total: themes.length,
    });
  } catch (error) {
    console.error('Error fetching themes:', error);
    
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
 * POST - Publish or unpublish a theme
 * Body: { themeId: number, isPublished: boolean }
 */
export async function POST(request: NextRequest) {
  try {
    // Check permission
    await requirePermission('backend.manage');

    const body = await request.json();
    const { themeId, isPublished } = body;

    if (typeof themeId !== 'number') {
      return NextResponse.json(
        { error: 'themeId must be a number' },
        { status: 400 }
      );
    }

    if (typeof isPublished !== 'boolean') {
      return NextResponse.json(
        { error: 'isPublished must be a boolean' },
        { status: 400 }
      );
    }

    const publishingService = new PublishingService(supabaseServer);

    if (isPublished) {
      await publishingService.publishTheme(themeId);
    } else {
      await publishingService.unpublishTheme(themeId);
    }

    // Get updated theme info
    const themes = await publishingService.getThemesWithPublishStatus();
    const updatedTheme = themes.find((t) => t.id === themeId);

    return NextResponse.json({
      success: true,
      theme: updatedTheme,
    });
  } catch (error) {
    console.error('Error updating theme:', error);

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
