export interface CollectedItem {
  source: string;
  title: string;
  content: string;
  url: string;
  author?: string;
  engagement: number;
  collectedAt: Date;
  metadata: Record<string, unknown>;
}

export interface BusinessIdea {
  title: string;
  category: string;
  painPoint: string;
  idea: string;
  potential: "High" | "Medium" | "Low";
  potentialReason: string;
  sourceIndex: number;
  originalUrl?: string;
  originalSource?: string;
  collectedAt?: string;
}

export interface RSSSourceConfig {
  enabled: boolean;
  feeds: string[];
  keywords: string[];
}

export interface Config {
  collection: {
    maxItemsPerSource: number;
    dedupDays: number;
  };
  rss: {
    note: RSSSourceConfig;
    zenn: RSSSourceConfig;
    hackernews: RSSSourceConfig;
    indiehackers: RSSSourceConfig;
    producthunt: RSSSourceConfig;
  };
  reddit: RSSSourceConfig;
  x: {
    enabled: boolean;
    searchQueries: string[];
    maxScroll: number;
  };
  instagram: {
    enabled: boolean;
    hashtags: string[];
    maxPosts: number;
  };
  tiktok: {
    enabled: boolean;
    searchQueries: string[];
    maxVideos: number;
  };
  analysis: {
    model: string;
    minPotentialScore: number;
    japanFocus: boolean;
  };
  filters: {
    excludeKeywords: string[];
    minEngagement: number;
  };
}

export interface Collector {
  name: string;
  collect(): Promise<CollectedItem[]>;
}
