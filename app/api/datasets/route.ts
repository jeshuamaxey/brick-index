// API route for datasets

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { DatasetService } from '@/lib/datasets/dataset-service';
import type { Database } from '@/lib/supabase/supabase.types';

// Helper to create authenticated Supabase client
async function getAuthenticatedClient() {
  const cookieStore = await cookies();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase configuration missing');
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

  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    throw new Error('Authentication required');
  }

  return { supabase, user };
}

// GET /api/datasets - Get all datasets for current user
export async function GET(request: NextRequest) {
  try {
    const { supabase, user } = await getAuthenticatedClient();
    const datasetService = new DatasetService(supabase);
    const datasets = await datasetService.getDatasetsForUser(user.id);

    return NextResponse.json(datasets);
  } catch (error) {
    console.error('Error fetching datasets:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      },
      { status: error instanceof Error && error.message === 'Authentication required' ? 401 : 500 }
    );
  }
}

// POST /api/datasets - Create a new dataset
export async function POST(request: NextRequest) {
  try {
    const { supabase, user } = await getAuthenticatedClient();
    const body = await request.json();
    const { name, description } = body as { name?: string; description?: string };

    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: 'name is required' },
        { status: 400 }
      );
    }

    const datasetService = new DatasetService(supabase);
    const dataset = await datasetService.createDataset(
      user.id,
      name.trim(),
      description?.trim()
    );

    return NextResponse.json(dataset);
  } catch (error) {
    console.error('Error creating dataset:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      },
      { status: error instanceof Error && error.message === 'Authentication required' ? 401 : 500 }
    );
  }
}
