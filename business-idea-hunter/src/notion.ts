import type { BusinessIdea } from "./types.js";

const NOTION_API_VERSION = "2025-09-03";
const NOTION_BASE_URL = "https://api.notion.com/v1";

export class NotionDatabase {
  private apiKey: string;
  private databaseId: string;

  constructor() {
    const apiKey = process.env.NOTION_API_KEY;
    const databaseId = process.env.NOTION_DATABASE_ID;

    if (!apiKey) {
      throw new Error("NOTION_API_KEY not set");
    }
    if (!databaseId) {
      throw new Error("NOTION_DATABASE_ID not set");
    }

    this.apiKey = apiKey;
    this.databaseId = databaseId;
  }

  private async request(endpoint: string, body: unknown): Promise<unknown> {
    const response = await fetch(`${NOTION_BASE_URL}${endpoint}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        "Notion-Version": NOTION_API_VERSION,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Notion API error: ${response.status} - ${errorBody}`);
    }

    return response.json();
  }

  async saveIdeas(ideas: BusinessIdea[]): Promise<string[]> {
    const createdIds: string[] = [];

    for (const idea of ideas) {
      try {
        const page = await this.createPage(idea);
        createdIds.push((page as { id: string }).id);
        console.log(`[notion] Created: ${idea.title}`);
      } catch (error) {
        console.error("[notion] Error creating page:", error);
      }
    }

    return createdIds;
  }

  private async createPage(idea: BusinessIdea): Promise<unknown> {
    const properties: Record<string, unknown> = {
      Title: {
        title: [
          {
            text: {
              content: idea.title.slice(0, 100),
            },
          },
        ],
      },
      Source: {
        select: {
          name: idea.originalSource || "unknown",
        },
      },
      Category: {
        select: {
          name: idea.category || "その他",
        },
      },
      "Pain Point": {
        rich_text: [
          {
            text: {
              content: (idea.painPoint || "").slice(0, 2000),
            },
          },
        ],
      },
      Idea: {
        rich_text: [
          {
            text: {
              content: (idea.idea || "").slice(0, 2000),
            },
          },
        ],
      },
      Potential: {
        select: {
          name: idea.potential || "Medium",
        },
      },
      "Original URL": {
        url: idea.originalUrl || null,
      },
      "Collected At": {
        date: {
          start: idea.collectedAt || new Date().toISOString(),
        },
      },
    };

    // 理由はページ本文に追加
    const children: unknown[] = [];
    if (idea.potentialReason) {
      children.push({
        object: "block",
        type: "heading_3",
        heading_3: {
          rich_text: [{ type: "text", text: { content: "ポテンシャル判定理由" } }],
        },
      });
      children.push({
        object: "block",
        type: "paragraph",
        paragraph: {
          rich_text: [{ type: "text", text: { content: idea.potentialReason } }],
        },
      });
    }

    return this.request("/pages", {
      parent: { database_id: this.databaseId },
      properties,
      children: children.length > 0 ? children : undefined,
    });
  }

  async checkDuplicate(url: string): Promise<boolean> {
    try {
      const response = (await this.request(`/databases/${this.databaseId}/query`, {
        filter: {
          property: "Original URL",
          url: {
            equals: url,
          },
        },
      })) as { results: unknown[] };
      return response.results.length > 0;
    } catch {
      return false;
    }
  }

  async getRecentUrls(days: number = 7): Promise<Set<string>> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    const urls = new Set<string>();

    try {
      const response = (await this.request(`/databases/${this.databaseId}/query`, {
        filter: {
          property: "Collected At",
          date: {
            after: cutoff.toISOString(),
          },
        },
      })) as { results: Array<{ properties?: Record<string, unknown> }> };

      for (const page of response.results) {
        if (page.properties) {
          const urlProp = page.properties["Original URL"] as { url?: string } | undefined;
          if (urlProp && typeof urlProp.url === "string") {
            urls.add(urlProp.url);
          }
        }
      }
    } catch (error) {
      console.error("[notion] Error fetching recent URLs:", error);
    }

    return urls;
  }
}
