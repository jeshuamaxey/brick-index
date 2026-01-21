'use client';

import { Copy } from 'lucide-react';
import { useState } from 'react';

interface CopyableIdProps {
  id: string;
  truncateLength?: number;
  className?: string;
}

export function CopyableId({ id, truncateLength = 8, className = '' }: CopyableIdProps) {
  const [copied, setCopied] = useState(false);

  const truncateId = (id: string) => {
    return `${id.substring(0, truncateLength)}...`;
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  };

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        copyToClipboard(id);
      }}
      className={`hover:text-foreground flex items-center gap-1 group cursor-pointer ${className}`}
      title={copied ? 'Copied!' : 'Click to copy full ID'}
    >
      <span className="font-mono text-xs text-foreground/70">{truncateId(id)}</span>
      <Copy className={`h-3 w-3 transition-opacity ${copied ? 'opacity-100 text-green-500' : 'opacity-0 group-hover:opacity-100'}`} />
    </button>
  );
}
