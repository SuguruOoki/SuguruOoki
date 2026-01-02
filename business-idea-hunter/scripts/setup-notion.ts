#!/usr/bin/env tsx
/**
 * Notionデータベースを自動作成するスクリプト
 *
 * Usage:
 *   npx tsx scripts/setup-notion.ts <親ページID>
 */

import { config as loadEnv } from "dotenv";
import { Client } from "@notionhq/client";

loadEnv();

async function createDatabase(
  client: Client,
  parentPageId: string
): Promise<string> {
  const database = await client.databases.create({
    parent: { type: "page_id", page_id: parentPageId },
    title: [{ type: "text", text: { content: "💡 Business Ideas" } }],
    properties: {
      Title: {
        title: {},
      },
      Source: {
        select: {
          options: [
            { name: "note", color: "green" },
            { name: "zenn", color: "blue" },
            { name: "hackernews", color: "orange" },
            { name: "reddit", color: "red" },
            { name: "x", color: "default" },
            { name: "instagram", color: "pink" },
            { name: "tiktok", color: "purple" },
            { name: "producthunt", color: "brown" },
            { name: "indiehackers", color: "yellow" },
          ],
        },
      },
      Category: {
        select: {
          options: [
            { name: "SaaS", color: "blue" },
            { name: "EC", color: "green" },
            { name: "マーケットプレイス", color: "orange" },
            { name: "コミュニティ", color: "purple" },
            { name: "ツール", color: "yellow" },
            { name: "コンテンツ", color: "pink" },
            { name: "その他", color: "gray" },
          ],
        },
      },
      Potential: {
        select: {
          options: [
            { name: "High", color: "red" },
            { name: "Medium", color: "yellow" },
            { name: "Low", color: "gray" },
          ],
        },
      },
      "Pain Point": {
        rich_text: {},
      },
      Idea: {
        rich_text: {},
      },
      "Original URL": {
        url: {},
      },
      "Collected At": {
        date: {},
      },
      Status: {
        select: {
          options: [
            { name: "New", color: "blue" },
            { name: "Reviewing", color: "yellow" },
            { name: "Promising", color: "green" },
            { name: "Archived", color: "gray" },
          ],
        },
      },
      Notes: {
        rich_text: {},
      },
    },
  });

  return database.id;
}

async function main(): Promise<void> {
  const parentPageId = process.argv[2];

  if (!parentPageId) {
    console.error("Usage: npx tsx scripts/setup-notion.ts <親ページID>");
    console.error("");
    console.error("親ページIDは、Notionページを開いたときのURLから取得できます:");
    console.error("https://www.notion.so/xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx");
    process.exit(1);
  }

  const apiKey = process.env.NOTION_API_KEY;
  if (!apiKey) {
    console.error("Error: NOTION_API_KEY not set in .env");
    process.exit(1);
  }

  const client = new Client({ auth: apiKey });

  console.log("Creating Notion database...");

  try {
    const databaseId = await createDatabase(client, parentPageId);
    console.log("\n✅ Database created successfully!");
    console.log(`\nDatabase ID: ${databaseId}`);
    console.log("\nAdd this to your .env file:");
    console.log(`NOTION_DATABASE_ID=${databaseId}`);
  } catch (error) {
    console.error("\n❌ Error:", error);
    console.error("\nMake sure:");
    console.error("1. The Integration has access to the parent page");
    console.error("2. The parent page ID is correct");
    process.exit(1);
  }
}

main();
