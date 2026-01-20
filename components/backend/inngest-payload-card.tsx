'use client';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

interface InngestPayloadCardProps {
  payload: {
    name: string;
    data: unknown;
  };
}

export function InngestPayloadCard({ payload }: InngestPayloadCardProps) {
  const handleCopyData = () => {
    navigator.clipboard.writeText(JSON.stringify(payload.data, null, 2));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Inngest Event Payload</CardTitle>
        <CardDescription>
          Copy this JSON to paste into Inngest's event trigger. Use the <code>data</code> field value.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <pre className="text-xs bg-muted p-4 rounded-md overflow-auto max-h-[600px]">
          {JSON.stringify(payload, null, 2)}
        </pre>
      </CardContent>
      <CardFooter>
        <Button
          variant="outline"
          onClick={handleCopyData}
          className="w-full"
        >
          Copy Data Field
        </Button>
      </CardFooter>
    </Card>
  );
}
