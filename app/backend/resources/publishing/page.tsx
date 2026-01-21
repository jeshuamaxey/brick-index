'use client';

import { useState, useEffect, Fragment, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { StatusBadge } from '@/components/ui/status-badge';
import { 
  RefreshCw, 
  Search, 
  EyeOff, 
  Eye,
  ChevronDown,
  ChevronRight,
  Blocks,
  AlertCircle,
  FolderTree
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ThemeWithStatus {
  id: number;
  name: string;
  parent_id: number | null;
  isPublished: boolean;
  publishedAt: string | null;
  setCount: number;
}

// Theme with computed children and total sets
interface ThemeNode extends ThemeWithStatus {
  children: ThemeNode[];
  totalSetCount: number; // Including all descendants
  hasPublishedDescendant: boolean;
}

export default function PublishingPage() {
  const [themes, setThemes] = useState<ThemeWithStatus[]>([]);
  const [isLoadingThemes, setIsLoadingThemes] = useState(true);
  const [themesError, setThemesError] = useState<string | null>(null);
  
  const [expandedThemes, setExpandedThemes] = useState<Set<number>>(new Set());
  
  const [searchTerm, setSearchTerm] = useState('');
  const [hideEmptyThemes, setHideEmptyThemes] = useState(true); // Default to hiding empty themes
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshSuccess, setRefreshSuccess] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  // Fetch themes
  const fetchThemes = async () => {
    try {
      setIsLoadingThemes(true);
      setThemesError(null);
      
      const response = await fetch('/api/admin/publishing/themes');
      if (!response.ok) {
        throw new Error('Failed to fetch themes');
      }
      
      const data = await response.json();
      setThemes(data.themes || []);
    } catch (err) {
      setThemesError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoadingThemes(false);
    }
  };

  useEffect(() => {
    fetchThemes();
  }, []);

  // Build hierarchical theme tree
  const { rootThemes, themeMap } = useMemo(() => {
    const map = new Map<number, ThemeNode>();
    
    // First pass: create nodes for all themes
    for (const theme of themes) {
      map.set(theme.id, {
        ...theme,
        children: [],
        totalSetCount: theme.setCount,
        hasPublishedDescendant: theme.isPublished,
      });
    }
    
    // Second pass: build parent-child relationships
    const roots: ThemeNode[] = [];
    for (const theme of themes) {
      const node = map.get(theme.id)!;
      if (theme.parent_id && map.has(theme.parent_id)) {
        const parent = map.get(theme.parent_id)!;
        parent.children.push(node);
      } else {
        roots.push(node);
      }
    }
    
    // Third pass: calculate total set counts and published descendants (bottom-up)
    const calculateTotals = (node: ThemeNode): { totalSets: number; hasPublished: boolean } => {
      let totalSets = node.setCount;
      let hasPublished = node.isPublished;
      
      for (const child of node.children) {
        const childTotals = calculateTotals(child);
        totalSets += childTotals.totalSets;
        hasPublished = hasPublished || childTotals.hasPublished;
      }
      
      node.totalSetCount = totalSets;
      node.hasPublishedDescendant = hasPublished;
      return { totalSets, hasPublished };
    };
    
    for (const root of roots) {
      calculateTotals(root);
    }
    
    // Sort children by name
    const sortChildren = (node: ThemeNode) => {
      node.children.sort((a, b) => a.name.localeCompare(b.name));
      for (const child of node.children) {
        sortChildren(child);
      }
    };
    
    for (const root of roots) {
      sortChildren(root);
    }
    
    // Sort roots by total set count (descending) then name
    roots.sort((a, b) => b.totalSetCount - a.totalSetCount || a.name.localeCompare(b.name));
    
    return { rootThemes: roots, themeMap: map };
  }, [themes]);

  // Filter themes by search term and empty filter
  const filteredRootThemes = useMemo(() => {
    let filtered = rootThemes;
    
    // Filter out empty themes if enabled
    if (hideEmptyThemes) {
      const hasContent = (node: ThemeNode): boolean => {
        return node.totalSetCount > 0;
      };
      filtered = filtered.filter(hasContent);
    }
    
    // Filter by search term
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      
      const matchesSearch = (node: ThemeNode): boolean => {
        if (node.name.toLowerCase().includes(searchLower) || 
            node.id.toString().includes(searchTerm)) {
          return true;
        }
        return node.children.some(matchesSearch);
      };
      
      filtered = filtered.filter(matchesSearch);
    }
    
    return filtered;
  }, [rootThemes, searchTerm, hideEmptyThemes]);

  // Toggle theme publishing
  const toggleThemePublishing = async (themeId: number, currentlyPublished: boolean, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      setActionLoading(themeId);
      
      const response = await fetch('/api/admin/publishing/themes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          themeId,
          isPublished: !currentlyPublished,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update theme');
      }

      // Refresh themes list
      await fetchThemes();
    } catch (err) {
      console.error('Error toggling theme:', err);
    } finally {
      setActionLoading(null);
    }
  };

  // Expand/collapse theme
  const toggleExpanded = (themeId: number) => {
    setExpandedThemes(prev => {
      const next = new Set(prev);
      if (next.has(themeId)) {
        next.delete(themeId);
      } else {
        next.add(themeId);
      }
      return next;
    });
  };

  // Refresh materialized view
  const handleRefreshAggregates = async () => {
    try {
      setIsRefreshing(true);
      setRefreshSuccess(null);
      
      const response = await fetch('/api/admin/publishing/refresh', {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to refresh aggregates');
      }

      setRefreshSuccess('Price aggregates refreshed successfully');
      setTimeout(() => setRefreshSuccess(null), 3000);
    } catch (err) {
      console.error('Error refreshing:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Highlight modular buildings theme
  const MODULAR_BUILDINGS_THEME_ID = 155;

  // Render a theme row and its children recursively
  const renderThemeRow = (theme: ThemeNode, depth: number = 0) => {
    const isExpanded = expandedThemes.has(theme.id);
    const hasChildren = theme.children.length > 0;
    const paddingLeft = 16 + depth * 24;
    
    return (
      <Fragment key={theme.id}>
        <tr
          className={cn(
            'transition-colors hover:bg-muted/10 cursor-pointer',
            theme.id === MODULAR_BUILDINGS_THEME_ID && 'bg-brand/5',
            theme.isPublished && 'bg-green-500/5',
            theme.hasPublishedDescendant && !theme.isPublished && 'bg-green-500/[0.02]'
          )}
          onClick={() => hasChildren && toggleExpanded(theme.id)}
        >
          <td className="px-4 py-3" style={{ paddingLeft }}>
            <div className="flex items-center gap-2">
              {hasChildren ? (
                <button
                  onClick={(e) => { e.stopPropagation(); toggleExpanded(theme.id); }}
                  className="p-1 hover:bg-muted/20 rounded"
                >
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                </button>
              ) : (
                <div className="w-6" /> // Spacer for alignment
              )}
              {theme.id === MODULAR_BUILDINGS_THEME_ID && (
                <Blocks className="h-4 w-4 text-brand" />
              )}
              {hasChildren && !theme.id.toString().startsWith('MOD') && (
                <FolderTree className="h-4 w-4 text-muted-foreground/50" />
              )}
              <span className={cn(
                'font-medium',
                depth === 0 ? 'text-foreground' : 'text-foreground/80'
              )}>
                {theme.name}
              </span>
              {hasChildren && (
                <span className="text-xs text-muted-foreground">
                  ({theme.children.length} sub-themes)
                </span>
              )}
            </div>
          </td>
          <td className="px-4 py-3 font-mono tabular-nums text-sm text-muted-foreground">
            {theme.id}
          </td>
          <td className="px-4 py-3 font-mono tabular-nums text-sm text-foreground">
            <div className="flex items-center gap-2">
              <span>{theme.setCount}</span>
              {hasChildren && theme.totalSetCount > theme.setCount && (
                <span className="text-xs text-muted-foreground">
                  ({theme.totalSetCount} total)
                </span>
              )}
            </div>
          </td>
          <td className="px-4 py-3">
            {theme.isPublished ? (
              <StatusBadge status="active">Published</StatusBadge>
            ) : theme.hasPublishedDescendant ? (
              <StatusBadge status="running">Partial</StatusBadge>
            ) : (
              <StatusBadge status="expired">Unpublished</StatusBadge>
            )}
          </td>
          <td className="px-4 py-3 text-right">
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => toggleThemePublishing(theme.id, theme.isPublished, e)}
              disabled={actionLoading === theme.id}
              className={cn(
                theme.isPublished
                  ? 'border-destructive/30 text-destructive hover:bg-destructive/10'
                  : 'border-brand/30 text-brand hover:bg-brand/10'
              )}
            >
              {actionLoading === theme.id ? (
                <RefreshCw className="h-4 w-4 animate-spin mr-2" />
              ) : theme.isPublished ? (
                <EyeOff className="h-4 w-4 mr-2" />
              ) : (
                <Eye className="h-4 w-4 mr-2" />
              )}
              {theme.isPublished ? 'Unpublish' : 'Publish'}
            </Button>
          </td>
        </tr>
        {/* Render children if expanded */}
        {isExpanded && theme.children.map(child => renderThemeRow(child, depth + 1))}
      </Fragment>
    );
  };

  return (
    <div className="p-8 bg-background text-foreground">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Publishing Management</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Control which themes and sets are visible to consumers
          </p>
        </div>
        <div className="flex items-center gap-3">
          {refreshSuccess && (
            <span className="text-sm text-green-600 dark:text-green-400">
              {refreshSuccess}
            </span>
          )}
          <Button
            onClick={handleRefreshAggregates}
            disabled={isRefreshing}
            variant="outline"
            className="border-foreground/20"
          >
            <RefreshCw className={cn('h-4 w-4 mr-2', isRefreshing && 'animate-spin')} />
            Refresh Aggregates
          </Button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="mb-6 flex items-center gap-4">
        <div className="relative max-w-sm flex-1">
          <Label htmlFor="search" className="sr-only">Search themes</Label>
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            id="search"
            placeholder="Search themes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer select-none">
          <input
            type="checkbox"
            checked={hideEmptyThemes}
            onChange={(e) => setHideEmptyThemes(e.target.checked)}
            className="rounded border-foreground/20"
          />
          Hide themes without sets
        </label>
        <span className="text-xs text-muted-foreground">
          {filteredRootThemes.length} of {rootThemes.length} themes
        </span>
      </div>

      {/* Themes Table */}
      {isLoadingThemes ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <LoadingSkeleton key={i} variant="table-row" />
          ))}
        </div>
      ) : themesError ? (
        <EmptyState
          variant="error"
          title="Failed to load themes"
          description={themesError}
          action={{
            label: 'Retry',
            onClick: fetchThemes,
          }}
        />
      ) : filteredRootThemes.length === 0 ? (
        <EmptyState
          icon={Search}
          title="No themes found"
          description={searchTerm ? 'Try a different search term' : 'No themes with sets available'}
        />
      ) : (
        <div className="rounded-lg border border-foreground/10 overflow-hidden">
          <table className="w-full">
            <thead className="bg-muted/20">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Theme
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider w-20">
                  ID
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider w-32">
                  Sets
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider w-28">
                  Status
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider w-32">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-foreground/5">
              {filteredRootThemes.map(theme => renderThemeRow(theme, 0))}
            </tbody>
          </table>
        </div>
      )}

      {/* Info Section */}
      <div className="mt-8 rounded-lg border border-foreground/10 bg-muted/5 p-6">
        <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-brand" />
          Publishing Rules
        </h3>
        <ul className="text-sm text-muted-foreground space-y-2">
          <li>
            <strong className="text-foreground">Theme-level publishing:</strong> When a theme is published, all sets in that theme become visible to consumers.
          </li>
          <li>
            <strong className="text-foreground">Individual overrides:</strong> Sets can be individually published or unpublished regardless of their theme status.
          </li>
          <li>
            <strong className="text-foreground">Modular Buildings (ID 155):</strong> Highlighted above. Publish this theme to enable the consumer experience.
          </li>
          <li>
            <strong className="text-foreground">Refresh Aggregates:</strong> Use this after publishing changes to update the pre-computed pricing data.
          </li>
        </ul>
      </div>
    </div>
  );
}
