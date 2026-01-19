// Backend page listing all available actions organized by pipeline stages

import Link from 'next/link';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

const stages = [
  {
    title: "Stage 1: Collection",
    description: "Collect all necessary raw data from marketplace APIs",
    actions: [
      {
        title: "Capture",
        description: "Searches for LEGO listings on eBay using keywords and stores them in the database. Uses real eBay API if configured, or snapshot data in cache mode. Deduplicates listings and updates existing ones.",
        href: "/backend/actions/capture",
      },
      {
        title: "Enrich",
        description: "Enriches unenriched listings with detailed data from the eBay Browse API. Fetches descriptions, images, condition details, and other metadata to enhance the listing information in the database.",
        href: "/backend/actions/enrich",
      },
    ],
  },
  {
    title: "Stage 2: Enhance",
    description: "Transform raw data into a form that can be used in the application",
    actions: [
      {
        title: "Materialize",
        description: "Transforms raw listings from a capture job into structured listings in the database. Processes raw API responses, deduplicates listings, and inserts or updates entries in the listings table.",
        href: "/backend/actions/materialize",
      },
      {
        title: "Sanitize",
        description: "Sanitizes listing title and description fields by removing HTML markup, images, scripts, and styles. Converts HTML to clean plain text while preserving text structure.",
        href: "/backend/actions/sanitize",
      },
      {
        title: "Analyze",
        description: "Analyzes listings to extract piece count, minifig count, condition, and calculate price per piece from listing titles and descriptions. Processes all unanalyzed listings by default.",
        href: "/backend/actions/analyze",
      },
    ],
  },
  {
    title: "Stage 3: Reconcile",
    description: "Final processing and validation of listing data",
    actions: [
      {
        title: "Reconcile",
        description: "Extracts LEGO set IDs from listing titles and descriptions, validates them against the catalog, and creates join records linking listings to LEGO sets.",
        href: "/backend/actions/reconcile",
      },
    ],
  },
];

export default function ActionsPage() {
  return (
    <div className="p-8 bg-background">
      <h1 className="text-2xl font-bold mb-6 text-foreground">Pipeline Actions</h1>

      <div className="space-y-8">
        {stages.map((stage) => (
          <div key={stage.title}>
            <div className="mb-4">
              <h2 className="text-xl font-semibold text-foreground">{stage.title}</h2>
              <p className="text-sm text-muted-foreground mt-1">{stage.description}</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {stage.actions.map((action) => (
                <Card key={action.href} className="hover:shadow-md transition-shadow">
                  <CardHeader>
                    <CardTitle>
                      <Link href={action.href} className="hover:underline">
                        {action.title}
                      </Link>
                    </CardTitle>
                    <CardDescription>{action.description}</CardDescription>
                  </CardHeader>
                </Card>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
