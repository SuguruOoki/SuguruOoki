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

async function createTodoDatabase(
  client: Client,
  parentPageId: string
): Promise<string> {
  const database = await client.databases.create({
    parent: { type: "page_id", page_id: parentPageId },
    title: [{ type: "text", text: { content: "✅ Business Idea TODOs" } }],
    properties: {
      Name: {
        title: {},
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
      Status: {
        select: {
          options: [
            { name: "Not Started", color: "gray" },
            { name: "In Progress", color: "yellow" },
            { name: "Done", color: "green" },
            { name: "Archived", color: "default" },
          ],
        },
      },
      "Original URL": {
        url: {},
      },
      "Idea Page": {
        url: {},
      },
      Priority: {
        select: {
          options: [
            { name: "High", color: "red" },
            { name: "Medium", color: "yellow" },
            { name: "Low", color: "gray" },
          ],
        },
      },
      "Created At": {
        date: {},
      },
    },
  });

  return database.id;
}

async function main(): Promise<void> {
  const dbType = process.argv[2]; // "ideas" or "todos"
  const parentPageId = process.argv[3];

  if (!dbType || !parentPageId) {
    console.error("Usage:");
    console.error("  npx tsx scripts/setup-notion.ts ideas <親ページID>");
    console.error("  npx tsx scripts/setup-notion.ts todos <親ページID>");
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

  try {
    if (dbType === "ideas") {
      console.log("Creating Business Ideas database...");
      const databaseId = await createDatabase(client, parentPageId);
      console.log("\n✅ Database created successfully!");
      console.log(`\nDatabase ID: ${databaseId}`);
      console.log("\nAdd this to your .env file:");
      console.log(`NOTION_DATABASE_ID=${databaseId}`);
    } else if (dbType === "todos") {
      console.log("Creating TODO database...");
      const databaseId = await createTodoDatabase(client, parentPageId);
      console.log("\n✅ TODO Database created successfully!");
      console.log(`\nDatabase ID: ${databaseId}`);
      console.log("\nAdd this to your .env file:");
      console.log(`NOTION_TODO_DATABASE_ID=${databaseId}`);
    } else {
      console.error(`Error: Unknown database type "${dbType}"`);
      console.error("Use 'ideas' or 'todos'");
      process.exit(1);
    }
  } catch (error) {
    console.error("\n❌ Error:", error);
    console.error("\nMake sure:");
    console.error("1. The Integration has access to the parent page");
    console.error("2. The parent page ID is correct");
    process.exit(1);
  }
}

main();
