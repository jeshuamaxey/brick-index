'use client';

import Link from 'next/link';
import { ExternalLink } from 'lucide-react';

interface ActionPageHeaderProps {
  title: string;
  inngestUrl?: string;
}

export function ActionPageHeader({ title, inngestUrl }: ActionPageHeaderProps) {
  // In development, use local Inngest dev server (runs on port 8288)
  // In production, use configured dashboard URL or default to cloud dashboard
  const isDevelopment = process.env.NODE_ENV === 'development';
  const dashboardUrl = inngestUrl 
    || (isDevelopment ? 'http://localhost:8288' : undefined)
    || process.env.NEXT_PUBLIC_INNGEST_DASHBOARD_URL 
    || 'https://app.inngest.com';

  return (
    <div className="flex items-center justify-between mb-6">
      <h1 className="text-2xl font-bold text-foreground">{title}</h1>
      <Link
        href={dashboardUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
      >
        Inngest
        <ExternalLink className="h-3 w-3" />
      </Link>
    </div>
  );
}
