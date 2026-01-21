// API route to trigger a capture job via Inngest

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { inngest } from '@/lib/inngest/client';
import { DatasetService } from '@/lib/datasets/dataset-service';
import type { EbaySearchParams } from '@/lib/capture/marketplace-adapters/ebay-adapter';
import type { Database } from '@/lib/supabase/supabase.types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      marketplace = 'ebay',
      keywords,
      ebayParams,
      datasetName,
    }: {
      marketplace?: string;
      keywords?: string[];
      ebayParams?: EbaySearchParams;
      datasetName?: string;
    } = body;

    // Validate keywords (required)
    if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
      return NextResponse.json(
        { error: 'keywords is required and must be a non-empty array' },
        { status: 400 }
      );
    }

    // Validate marketplace
    if (marketplace !== 'ebay') {
      return NextResponse.json(
        { error: `Unsupported marketplace: ${marketplace}` },
        { status: 400 }
      );
    }

    // Validate eBay configuration if needed
    const dataMode = process.env.EBAY_DATA_MODE ?? 'live';
    if (dataMode === 'live' && !process.env.EBAY_APP_ID) {
      return NextResponse.json(
        {
          error:
            'EBAY_APP_ID is required when EBAY_DATA_MODE=live. Either set EBAY_DATA_MODE=cache or provide EBAY_APP_ID.',
        },
        { status: 400 }
      );
    }

    // Handle dataset creation if datasetName is provided
    let datasetId: string | undefined;
    let userId: string | undefined;
    
    if (datasetName) {
      // Get current user from session
      const cookieStore = await cookies();
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      if (!supabaseUrl || !supabaseAnonKey) {
        return NextResponse.json(
          { error: 'Supabase configuration missing' },
          { status: 500 }
        );
      }

      // Create a server client that can properly read cookies
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
          { error: 'Authentication required for dataset creation' },
          { status: 401 }
        );
      }

      userId = user.id;

      // Create or get dataset
      const datasetService = new DatasetService(supabase);
      const dataset = await datasetService.getOrCreateDataset(
        user.id,
        datasetName.trim()
      );
      datasetId = dataset.id;
      
      // Ensure datasetId is set - if dataset creation succeeded, this should always be truthy
      if (!datasetId) {
        return NextResponse.json(
          { error: 'Failed to create or retrieve dataset' },
          { status: 500 }
        );
      }
    }

    // Send Inngest event to trigger capture job
    // Build event data object, ensuring datasetId is included when datasetName is provided
    const eventData: {
      marketplace: string;
      keywords: string[];
      ebayParams?: EbaySearchParams;
      datasetName?: string;
      datasetId?: string;
      userId?: string;
    } = {
      marketplace,
      keywords,
    };
    
    if (ebayParams && Object.keys(ebayParams).length > 0) {
      eventData.ebayParams = ebayParams;
    }
    if (datasetName) {
      eventData.datasetName = datasetName.trim();
      // If datasetName is provided, datasetId MUST be set (we validated it above)
      // Always include it to ensure it's passed to the job
      if (!datasetId) {
        // This should never happen due to validation above, but throw error if it does
        throw new Error('Critical error: datasetName provided but datasetId is not set after dataset creation');
      }
      eventData.datasetId = datasetId;
    }
    if (userId) {
      eventData.userId = userId;
    }

    await inngest.send({
      name: 'job/capture.triggered',
      data: eventData,
    });

    // Return immediately - job will be processed asynchronously by Inngest
    return NextResponse.json({
      status: 'running',
      message: 'Job started, check /api/jobs for status',
    });
  } catch (error) {
    console.error('Error triggering capture:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      },
      { status: 500 }
    );
  }
}

