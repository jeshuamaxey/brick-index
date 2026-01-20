// API route to trigger listing enrichment via Inngest

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { inngest } from '@/lib/inngest/client';
import type { Database } from '@/lib/supabase/supabase.types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const {
      marketplace = 'ebay',
      captureJobId,
      limit,
      delayMs = 200,
      datasetId,
    }: {
      marketplace?: string;
      captureJobId?: string;
      limit?: number;
      delayMs?: number;
      datasetId?: string;
    } = body;

    // Validate marketplace
    if (marketplace !== 'ebay') {
      return NextResponse.json(
        { error: `Unsupported marketplace: ${marketplace}` },
        { status: 400 }
      );
    }

    // Validate eBay configuration
    if (!process.env.EBAY_APP_ID) {
      return NextResponse.json(
        {
          error:
            'EBAY_APP_ID environment variable is required for enrichment',
        },
        { status: 400 }
      );
    }

    // Validate dataset_id if provided
    if (datasetId) {
      const cookieStore = await cookies();
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      if (!supabaseUrl || !supabaseAnonKey) {
        return NextResponse.json(
          { error: 'Supabase configuration missing' },
          { status: 500 }
        );
      }

      const supabase = createServerClient<Database>(
        supabaseUrl,
        supabaseAnonKey,
        {
          cookies: {
            getAll() {
              return cookieStore.getAll();
            },
            setAll() {
              // Not needed for reading auth state
            },
          },
        }
      );

      const { data: { user }, error: userError } = await supabase.auth.getUser();

      if (userError || !user) {
        return NextResponse.json(
          { error: 'Authentication required for dataset filtering' },
          { status: 401 }
        );
      }

      // Verify dataset belongs to user
      const { data: dataset, error: datasetError } = await supabase
        .schema('public')
        .from('datasets')
        .select('id')
        .eq('id', datasetId)
        .eq('user_id', user.id)
        .single();

      if (datasetError || !dataset) {
        return NextResponse.json(
          { error: 'Dataset not found or access denied' },
          { status: 404 }
        );
      }
    }

    // Send Inngest event to trigger enrichment job
    await inngest.send({
      name: 'job/enrich.triggered',
      data: {
        marketplace,
        captureJobId,
        limit,
        delayMs,
        datasetId,
      },
    });

    // Return immediately - job will be processed asynchronously by Inngest
    return NextResponse.json({
      status: 'running',
      message: 'Job started, check /api/jobs for status',
    });
  } catch (error) {
    console.error('Error enriching listings:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      },
      { status: 500 }
    );
  }
}

