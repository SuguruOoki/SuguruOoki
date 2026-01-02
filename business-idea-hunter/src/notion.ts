import { Client } from "@notionhq/client";
import type { BusinessIdea } from "./types.js";

export class NotionDatabase {
  private client: Client;
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

    this.client = new Client({ auth: apiKey });
    this.databaseId = databaseId;
  }

  async saveIdeas(ideas: BusinessIdea[]): Promise<string[]> {
    const createdIds: string[] = [];

    for (const idea of ideas) {
      try {
        const page = await this.createPage(idea);
        createdIds.push(page.id);
        console.log(`[notion] Created: ${idea.title}`);
      } catch (error) {
        console.error("[notion] Error creating page:", error);
      }
    }

    return createdIds;
  }

  private async createPage(idea: BusinessIdea) {
    const properties: Record<string, any> = {
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
    const children: any[] = [];
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

    return this.client.pages.create({
      parent: { database_id: this.databaseId },
      properties,
      children: children.length > 0 ? children : undefined,
    });
  }

  async checkDuplicate(url: string): Promise<boolean> {
    try {
      const response = await this.client.databases.query({
        database_id: this.databaseId,
        filter: {
          property: "Original URL",
          url: {
            equals: url,
          },
        },
      });
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
      const response = await this.client.databases.query({
        database_id: this.databaseId,
        filter: {
          property: "Collected At",
          date: {
            after: cutoff.toISOString(),
          },
        },
      });

      for (const page of response.results) {
        if ("properties" in page) {
          const urlProp = page.properties["Original URL"];
          if (urlProp && "url" in urlProp && typeof urlProp.url === "string") {
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
