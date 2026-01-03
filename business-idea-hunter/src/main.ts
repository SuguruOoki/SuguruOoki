#!/usr/bin/env tsx
/**
 * Business Idea Hunter - メイン実行スクリプト
 *
 * Usage:
 *   npm start                           # 全ソース収集
 *   npm start -- --sources note,reddit  # 特定ソースのみ
 *   npm start -- --dry-run              # Notion保存なし
 */

import { config as loadEnv } from "dotenv";
import { program } from "commander";
import { loadConfig } from "./config.js";
import {
  RSSCollector,
  HackerNewsCollector,
  RedditCollector,
  XCollector,
  InstagramCollector,
  TikTokCollector,
} from "./collectors/index.js";
import { IdeaAnalyzer } from "./analyzer.js";
import { NotionDatabase } from "./notion.js";
import type { CollectedItem, Collector, BusinessIdea } from "./types.js";

// 環境変数読み込み
loadEnv();

// CLI引数定義
program
  .option("--sources <sources>", "Comma-separated list of sources")
  .option("--dry-run", "Don't save to Notion")
  .option("--skip-analysis", "Skip Claude analysis")
  .parse();

const options = program.opts();

async function collectAll(
  config: ReturnType<typeof loadConfig>,
  sources?: string[]
): Promise<CollectedItem[]> {
  const allItems: CollectedItem[] = [];

  const collectors: [string, Collector][] = [];

  // RSS系
  if (!sources || sources.includes("note")) {
    collectors.push(["note", new RSSCollector(config, "note")]);
  }
  if (!sources || sources.includes("zenn")) {
    collectors.push(["zenn", new RSSCollector(config, "zenn")]);
  }
  if (!sources || sources.includes("hackernews")) {
    collectors.push(["hackernews", new HackerNewsCollector(config)]);
  }
  if (!sources || sources.includes("indiehackers")) {
    collectors.push(["indiehackers", new RSSCollector(config, "indiehackers")]);
  }
  if (!sources || sources.includes("producthunt")) {
    collectors.push(["producthunt", new RSSCollector(config, "producthunt")]);
  }

  // API系
  if (!sources || sources.includes("reddit")) {
    collectors.push(["reddit", new RedditCollector(config)]);
  }

  // クローリング系
  if (!sources || sources.includes("x")) {
    collectors.push(["x", new XCollector(config)]);
  }
  if (!sources || sources.includes("instagram")) {
    collectors.push(["instagram", new InstagramCollector(config)]);
  }
  if (!sources || sources.includes("tiktok")) {
    collectors.push(["tiktok", new TikTokCollector(config)]);
  }

  for (const [name, collector] of collectors) {
    console.log(`📥 Collecting from ${name}...`);
    try {
      const items = await collector.collect();
      console.log(`   ✓ ${items.length} items collected`);
      allItems.push(...items);
    } catch (error) {
      console.error(`   ✗ Error:`, error);
    }
  }

  return allItems;
}

function filterItems(
  items: CollectedItem[],
  config: ReturnType<typeof loadConfig>
): CollectedItem[] {
  const { excludeKeywords, minEngagement } = config.filters;

  let filtered = items;

  // 除外キーワード
  if (excludeKeywords.length > 0) {
    filtered = filtered.filter((item) => {
      const text = `${item.title} ${item.content}`.toLowerCase();
      return !excludeKeywords.some((kw) => text.includes(kw.toLowerCase()));
    });
  }

  // 最小エンゲージメント（0の場合はフィルタしない）
  if (minEngagement > 0) {
    filtered = filtered.filter(
      (item) => item.engagement >= minEngagement || item.engagement === 0
    );
  }

  return filtered;
}

function deduplicate(
  items: CollectedItem[],
  existingUrls: Set<string>
): CollectedItem[] {
  const seen = new Set(existingUrls);
  const unique: CollectedItem[] = [];

  for (const item of items) {
    if (item.url && !seen.has(item.url)) {
      seen.add(item.url);
      unique.push(item);
    }
  }

  return unique;
}

function printSummary(items: CollectedItem[], ideas: BusinessIdea[]): void {
  console.log("\n📊 Collection Summary");

  // ソース別集計
  const sourceCounts: Record<string, number> = {};
  for (const item of items) {
    sourceCounts[item.source] = (sourceCounts[item.source] || 0) + 1;
  }

  console.log("\nItems by Source:");
  for (const [source, count] of Object.entries(sourceCounts).sort()) {
    console.log(`  ${source}: ${count}`);
  }
  console.log(`  Total: ${items.length}`);

  // アイデア集計
  if (ideas.length > 0) {
    console.log(`\n💡 ${ideas.length} Business Ideas Extracted`);

    const potentialCounts = { High: 0, Medium: 0, Low: 0 };
    for (const idea of ideas) {
      potentialCounts[idea.potential] = (potentialCounts[idea.potential] || 0) + 1;
    }

    console.log(
      `   High: ${potentialCounts.High}, Medium: ${potentialCounts.Medium}, Low: ${potentialCounts.Low}`
    );
  }
}

async function main(): Promise<void> {
  console.log("🎯 Business Idea Hunter");
  console.log(`   Started at: ${new Date().toISOString()}`);
  console.log();

  // 設定読み込み
  const config = loadConfig();

  // ソース指定
  const sources = options.sources?.split(",") as string[] | undefined;

  // データ収集
  let items = await collectAll(config, sources);

  if (items.length === 0) {
    console.log("No items collected. Exiting.");
    return;
  }

  // フィルタリング
  console.log("\n🔍 Filtering...");
  items = filterItems(items, config);
  console.log(`   ✓ ${items.length} items after filtering`);

  // 重複除去
  if (!options.dryRun) {
    try {
      const notion = new NotionDatabase();
      const existingUrls = await notion.getRecentUrls(config.collection.dedupDays);
      items = deduplicate(items, existingUrls);
      console.log(`   ✓ ${items.length} items after deduplication`);
    } catch (error) {
      console.warn("   ⚠ Could not check duplicates:", error);
    }
  }

  if (items.length === 0) {
    console.log("No new items to analyze. Exiting.");
    return;
  }

  // Claude分析
  let ideas: BusinessIdea[] = [];
  if (!options.skipAnalysis) {
    console.log("\n🧠 Analyzing with Claude...");
    try {
      const analyzer = new IdeaAnalyzer(config);
      ideas = await analyzer.analyze(items);
      console.log(`   ✓ ${ideas.length} ideas extracted`);
    } catch (error) {
      console.error("   ✗ Analysis error:", error);
    }
  }

  // Notion保存
  if (!options.dryRun && ideas.length > 0) {
    console.log("\n📝 Saving to Notion...");
    try {
      const notion = new NotionDatabase();
      const createdIds = await notion.saveIdeas(ideas);
      console.log(`   ✓ ${createdIds.length} ideas saved`);

      // 優先度がHighのアイデアをTODOリストに追加
      const highPriorityIdeas = ideas.filter((idea) => idea.potential === "High");
      if (highPriorityIdeas.length > 0) {
        console.log(`\n🎯 Creating TODO list for ${highPriorityIdeas.length} high priority ideas...`);
        try {
          // 保存直後なので、少し待ってから取得
          await new Promise((resolve) => setTimeout(resolve, 2000));
          
          const highPriorityFromDb = await notion.getHighPriorityIdeas();
          
          // 今回保存したアイデアのみをフィルタリング（重複を避けるため）
          const newlyCreatedHighPriority = highPriorityFromDb.filter((idea) =>
            createdIds.some((id) => idea.id === id)
          );

          if (newlyCreatedHighPriority.length > 0) {
            const todoIds = await notion.createTodos(newlyCreatedHighPriority);
            console.log(`   ✓ ${todoIds.length} TODOs created`);
          } else {
            console.log("   ⚠ No new high priority ideas found in database");
          }
        } catch (error) {
          console.error("   ✗ TODO creation error:", error);
        }
      }
    } catch (error) {
      console.error("   ✗ Save error:", error);
    }
  }

  // サマリー表示
  printSummary(items, ideas);

  console.log(`\n✅ Completed at: ${new Date().toISOString()}`);
}

main().catch(console.error);
