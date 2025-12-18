// Backend page listing all available actions

import Link from 'next/link';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

const actions = [
  {
    title: "Capture",
    description: "Searches for LEGO listings on eBay using keywords and stores them in the database. Uses real eBay API if configured, or snapshot data in cache mode. Deduplicates listings and updates existing ones.",
    href: "/backend/actions/capture",
  },
  {
    title: "Materialize",
    description: "Transforms raw listings from a capture job into structured listings in the database. Processes raw API responses, deduplicates listings, and inserts or updates entries in the listings table.",
    href: "/backend/actions/materialize",
  },
  {
    title: "Enrich",
    description: "Enriches unenriched listings with detailed data from the eBay Browse API. Fetches descriptions, images, condition details, and other metadata to enhance the listing information in the database.",
    href: "/backend/actions/enrich",
  },
  {
    title: "Analyze",
    description: "Analyzes listings to extract piece count, minifig count, condition, and calculate price per piece from listing titles and descriptions. Processes all unanalyzed listings by default.",
    href: "/backend/actions/analyze",
  },
];

export default function ActionsPage() {
  return (
    <div className="p-8 bg-background">
      <h1 className="text-2xl font-bold mb-6 text-foreground">Actions</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {actions.map((action) => (
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
  );
}
