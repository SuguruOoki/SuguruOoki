/**
 * Next Engine TODO マネージャー
 *
 * 複数プロジェクト・複数モールのTODO管理を行います。
 */

import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";

// 型定義
interface Task {
  id: string;
  category: string;
  title: string;
  description: string;
  priority: "high" | "medium" | "low";
  order: number;
}

interface TaskTemplate {
  templateName: string;
  mallName?: string;
  description: string;
  tasks: Task[];
}

interface ProjectTask extends Task {
  status: "pending" | "in_progress" | "completed" | "skipped";
  completedAt?: string;
  notes?: string;
}

interface ProjectTodos {
  projectId: string;
  projectName: string;
  createdAt: string;
  updatedAt: string;
  common: ProjectTask[];
  malls: {
    [key: string]: ProjectTask[];
  };
}

interface ProjectConfig {
  projectId: string;
  projectName: string;
  companyName?: string;
  createdAt: string;
  updatedAt: string;
  status: "setup" | "testing" | "active" | "suspended";
  envFile: string;
  malls: string[];
  notes?: string;
}

interface ProjectList {
  projects: ProjectConfig[];
}

// パス設定
const DATA_DIR = path.join(process.cwd(), "data");
const CONFIGS_DIR = path.join(DATA_DIR, "configs");
const TODOS_DIR = path.join(DATA_DIR, "todos");
const TEMPLATES_DIR = path.join(TODOS_DIR, "templates");
const PROJECTS_FILE = path.join(CONFIGS_DIR, "projects.json");

// ユーティリティ関数
function ensureDirectories(): void {
  [DATA_DIR, CONFIGS_DIR, TODOS_DIR, TEMPLATES_DIR].forEach((dir) => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
}

function loadTemplate(name: string): TaskTemplate | null {
  const templatePath = path.join(TEMPLATES_DIR, `${name}-tasks.json`);
  if (!fs.existsSync(templatePath)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(templatePath, "utf-8"));
}

function loadProjects(): ProjectList {
  if (!fs.existsSync(PROJECTS_FILE)) {
    return { projects: [] };
  }
  return JSON.parse(fs.readFileSync(PROJECTS_FILE, "utf-8"));
}

function saveProjects(projects: ProjectList): void {
  fs.writeFileSync(PROJECTS_FILE, JSON.stringify(projects, null, 2));
}

function loadProjectTodos(projectId: string): ProjectTodos | null {
  const todosPath = path.join(TODOS_DIR, `${projectId}.json`);
  if (!fs.existsSync(todosPath)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(todosPath, "utf-8"));
}

function saveProjectTodos(todos: ProjectTodos): void {
  todos.updatedAt = new Date().toISOString();
  const todosPath = path.join(TODOS_DIR, `${todos.projectId}.json`);
  fs.writeFileSync(todosPath, JSON.stringify(todos, null, 2));
}

function convertToProjectTasks(template: TaskTemplate): ProjectTask[] {
  return template.tasks.map((task) => ({
    ...task,
    status: "pending" as const,
  }));
}

// コマンド実装
async function createProject(args: string[]): Promise<void> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const question = (prompt: string): Promise<string> =>
    new Promise((resolve) => rl.question(prompt, resolve));

  console.log("\n📦 新規プロジェクト作成\n");

  const projectId =
    args[0] ||
    (await question("プロジェクトID (例: bjc-main): ")).trim();
  const projectName =
    args[1] ||
    (await question("プロジェクト名 (例: BJC本店): ")).trim();
  const companyName = await question("会社名 (省略可): ");

  console.log("\n有効化するモールを選択 (カンマ区切り):");
  console.log("  1. rakuten (楽天市場)");
  console.log("  2. amazon (Amazon)");
  console.log("  3. qoo10 (Qoo10)");
  console.log("  4. yahoo (Yahoo!ショッピング)");
  const mallInput = await question("選択 (例: 1,2,3,4): ");

  const mallMap: { [key: string]: string } = {
    "1": "rakuten",
    "2": "amazon",
    "3": "qoo10",
    "4": "yahoo",
    rakuten: "rakuten",
    amazon: "amazon",
    qoo10: "qoo10",
    yahoo: "yahoo",
  };

  const malls = mallInput
    .split(",")
    .map((m) => mallMap[m.trim()])
    .filter(Boolean);

  if (malls.length === 0) {
    console.log("❌ 少なくとも1つのモールを選択してください。");
    rl.close();
    return;
  }

  rl.close();

  // プロジェクト設定作成
  const config: ProjectConfig = {
    projectId,
    projectName,
    companyName: companyName || undefined,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: "setup",
    envFile: `.env.${projectId}`,
    malls,
  };

  // プロジェクトリストに追加
  const projects = loadProjects();
  if (projects.projects.some((p) => p.projectId === projectId)) {
    console.log(`❌ プロジェクト '${projectId}' は既に存在します。`);
    return;
  }
  projects.projects.push(config);
  saveProjects(projects);

  // TODOを初期化
  const commonTemplate = loadTemplate("common");
  if (!commonTemplate) {
    console.log("❌ 共通タスクテンプレートが見つかりません。");
    return;
  }

  const todos: ProjectTodos = {
    projectId,
    projectName,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    common: convertToProjectTasks(commonTemplate),
    malls: {},
  };

  // モール別TODOを追加
  for (const mall of malls) {
    const mallTemplate = loadTemplate(mall);
    if (mallTemplate) {
      todos.malls[mall] = convertToProjectTasks(mallTemplate);
    }
  }

  saveProjectTodos(todos);

  // .envファイルテンプレート作成
  const envPath = path.join(process.cwd(), config.envFile);
  if (!fs.existsSync(envPath)) {
    const envContent = `# Next Engine Configuration - ${projectName}
# ================================
# Project ID: ${projectId}
# Created: ${config.createdAt}

# OAuth認証情報（必須）
NEXT_ENGINE_CLIENT_ID=
NEXT_ENGINE_CLIENT_SECRET=
NEXT_ENGINE_REDIRECT_URI=

# OAuth認証後に取得されるトークン
NEXT_ENGINE_ACCESS_TOKEN=
NEXT_ENGINE_REFRESH_TOKEN=

# API設定
NEXT_ENGINE_API_BASE_URL=https://api.next-engine.org

${malls.includes("rakuten") ? `# 楽天市場
RAKUTEN_SHOP_URL=
RAKUTEN_SERVICE_SECRET=
RAKUTEN_LICENSE_KEY=
` : ""}
${malls.includes("amazon") ? `# Amazon (SP-API)
AMAZON_SELLER_ID=
AMAZON_MARKETPLACE_ID=A1VC38T7YXB528
AMAZON_SP_API_CLIENT_ID=
AMAZON_SP_API_CLIENT_SECRET=
AMAZON_SP_API_REFRESH_TOKEN=
AMAZON_AWS_ACCESS_KEY=
AMAZON_AWS_SECRET_KEY=
AMAZON_ROLE_ARN=
` : ""}
${malls.includes("qoo10") ? `# Qoo10
QOO10_SELLER_ID=
QOO10_API_KEY=
QOO10_USER_ID=
` : ""}
${malls.includes("yahoo") ? `# Yahoo!ショッピング
YAHOO_STORE_ACCOUNT=
YAHOO_PUBLIC_KEY=
YAHOO_SECRET_KEY=
` : ""}
# ログ設定
LOG_LEVEL=info
LOG_OUTPUT_DIR=./logs
`;
    fs.writeFileSync(envPath, envContent);
  }

  console.log("\n✅ プロジェクト作成完了！");
  console.log(`\n📋 プロジェクト: ${projectName} (${projectId})`);
  console.log(`🏪 モール: ${malls.join(", ")}`);
  console.log(`📄 設定ファイル: ${config.envFile}`);
  console.log(`\n次のコマンドでTODOを確認:`);
  console.log(`  npm run todo show ${projectId}`);
}

function listProjects(): void {
  const projects = loadProjects();

  console.log("\n╔════════════════════════════════════════════════════════╗");
  console.log("║     プロジェクト一覧                                     ║");
  console.log("╚════════════════════════════════════════════════════════╝\n");

  if (projects.projects.length === 0) {
    console.log("プロジェクトがありません。");
    console.log("\n新規作成: npm run todo create");
    return;
  }

  for (const project of projects.projects) {
    const todos = loadProjectTodos(project.projectId);
    const stats = getProjectStats(todos);

    const statusEmoji = {
      setup: "🔧",
      testing: "🧪",
      active: "✅",
      suspended: "⏸️",
    };

    console.log(
      `${statusEmoji[project.status]} ${project.projectName} (${project.projectId})`
    );
    console.log(`   モール: ${project.malls.join(", ")}`);
    console.log(`   進捗: ${stats.completed}/${stats.total} タスク完了`);
    console.log(`   ステータス: ${project.status}`);
    console.log("");
  }
}

function getProjectStats(todos: ProjectTodos | null): {
  total: number;
  completed: number;
  inProgress: number;
  pending: number;
} {
  if (!todos) {
    return { total: 0, completed: 0, inProgress: 0, pending: 0 };
  }

  let total = 0;
  let completed = 0;
  let inProgress = 0;

  // 共通タスク
  total += todos.common.length;
  completed += todos.common.filter((t) => t.status === "completed").length;
  inProgress += todos.common.filter((t) => t.status === "in_progress").length;

  // モール別タスク
  for (const mall of Object.values(todos.malls)) {
    total += mall.length;
    completed += mall.filter((t) => t.status === "completed").length;
    inProgress += mall.filter((t) => t.status === "in_progress").length;
  }

  return {
    total,
    completed,
    inProgress,
    pending: total - completed - inProgress,
  };
}

function showProjectTodos(projectId: string, filter?: string): void {
  const todos = loadProjectTodos(projectId);
  if (!todos) {
    console.log(`❌ プロジェクト '${projectId}' が見つかりません。`);
    return;
  }

  const stats = getProjectStats(todos);
  const progress = Math.round((stats.completed / stats.total) * 100);

  console.log("\n╔════════════════════════════════════════════════════════╗");
  console.log(`║     ${todos.projectName} - TODO一覧`);
  console.log("╚════════════════════════════════════════════════════════╝");

  // 進捗バー
  const barLength = 30;
  const filled = Math.round((progress / 100) * barLength);
  const bar = "█".repeat(filled) + "░".repeat(barLength - filled);
  console.log(`\n進捗: [${bar}] ${progress}%`);
  console.log(
    `完了: ${stats.completed} | 進行中: ${stats.inProgress} | 未着手: ${stats.pending}\n`
  );

  // 共通タスク表示
  if (!filter || filter === "common") {
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("📋 共通タスク");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    displayTasks(todos.common);
  }

  // モール別タスク表示
  for (const [mall, tasks] of Object.entries(todos.malls)) {
    if (filter && filter !== mall && filter !== "all") continue;

    const mallNames: { [key: string]: string } = {
      rakuten: "🛒 楽天市場",
      amazon: "📦 Amazon",
      qoo10: "🌏 Qoo10",
      yahoo: "🔶 Yahoo!ショッピング",
    };

    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(mallNames[mall] || mall);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    displayTasks(tasks);
  }

  console.log("\n" + "=".repeat(60));
  console.log("コマンド:");
  console.log(`  完了: npm run todo complete ${projectId} <task-id>`);
  console.log(`  開始: npm run todo start ${projectId} <task-id>`);
  console.log(`  スキップ: npm run todo skip ${projectId} <task-id>`);
}

function displayTasks(tasks: ProjectTask[]): void {
  const statusIcons = {
    pending: "⬜",
    in_progress: "🔄",
    completed: "✅",
    skipped: "⏭️",
  };

  const priorityIcons = {
    high: "🔴",
    medium: "🟡",
    low: "🟢",
  };

  let currentCategory = "";

  for (const task of tasks.sort((a, b) => a.order - b.order)) {
    if (task.category !== currentCategory) {
      currentCategory = task.category;
      console.log(`\n  【${currentCategory}】`);
    }

    console.log(
      `  ${statusIcons[task.status]} ${priorityIcons[task.priority]} [${task.id}] ${task.title}`
    );
    if (task.status !== "completed" && task.status !== "skipped") {
      console.log(`      ${task.description}`);
    }
  }
}

function updateTaskStatus(
  projectId: string,
  taskId: string,
  status: "pending" | "in_progress" | "completed" | "skipped"
): void {
  const todos = loadProjectTodos(projectId);
  if (!todos) {
    console.log(`❌ プロジェクト '${projectId}' が見つかりません。`);
    return;
  }

  let found = false;

  // 共通タスクを検索
  for (const task of todos.common) {
    if (task.id === taskId) {
      task.status = status;
      if (status === "completed") {
        task.completedAt = new Date().toISOString();
      }
      found = true;
      break;
    }
  }

  // モール別タスクを検索
  if (!found) {
    for (const mall of Object.values(todos.malls)) {
      for (const task of mall) {
        if (task.id === taskId) {
          task.status = status;
          if (status === "completed") {
            task.completedAt = new Date().toISOString();
          }
          found = true;
          break;
        }
      }
      if (found) break;
    }
  }

  if (!found) {
    console.log(`❌ タスク '${taskId}' が見つかりません。`);
    return;
  }

  saveProjectTodos(todos);

  const statusText = {
    pending: "未着手に戻しました",
    in_progress: "開始しました",
    completed: "完了しました",
    skipped: "スキップしました",
  };

  console.log(`✅ タスク [${taskId}] を${statusText[status]}`);
}

function showDashboard(): void {
  const projects = loadProjects();

  console.log("\n╔════════════════════════════════════════════════════════╗");
  console.log("║     Next Engine TODO ダッシュボード                      ║");
  console.log("╚════════════════════════════════════════════════════════╝\n");

  if (projects.projects.length === 0) {
    console.log("プロジェクトがありません。");
    console.log("\n新規作成: npm run todo create");
    return;
  }

  let totalTasks = 0;
  let totalCompleted = 0;

  for (const project of projects.projects) {
    const todos = loadProjectTodos(project.projectId);
    const stats = getProjectStats(todos);
    totalTasks += stats.total;
    totalCompleted += stats.completed;

    const progress = stats.total > 0
      ? Math.round((stats.completed / stats.total) * 100)
      : 0;
    const barLength = 20;
    const filled = Math.round((progress / 100) * barLength);
    const bar = "█".repeat(filled) + "░".repeat(barLength - filled);

    console.log(`📦 ${project.projectName}`);
    console.log(`   [${bar}] ${progress}% (${stats.completed}/${stats.total})`);

    // 進行中のタスクを表示
    if (todos) {
      const inProgressTasks = [
        ...todos.common.filter((t) => t.status === "in_progress"),
        ...Object.values(todos.malls)
          .flat()
          .filter((t) => t.status === "in_progress"),
      ];

      if (inProgressTasks.length > 0) {
        console.log("   🔄 進行中:");
        for (const task of inProgressTasks.slice(0, 3)) {
          console.log(`      - ${task.title}`);
        }
      }

      // 次のタスクを表示
      const nextTasks = [
        ...todos.common.filter((t) => t.status === "pending"),
        ...Object.values(todos.malls)
          .flat()
          .filter((t) => t.status === "pending"),
      ]
        .sort((a, b) => {
          if (a.priority !== b.priority) {
            const priorityOrder = { high: 0, medium: 1, low: 2 };
            return priorityOrder[a.priority] - priorityOrder[b.priority];
          }
          return a.order - b.order;
        })
        .slice(0, 2);

      if (nextTasks.length > 0) {
        console.log("   ⏳ 次のタスク:");
        for (const task of nextTasks) {
          console.log(`      - [${task.id}] ${task.title}`);
        }
      }
    }
    console.log("");
  }

  const overallProgress =
    totalTasks > 0 ? Math.round((totalCompleted / totalTasks) * 100) : 0;
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`全体進捗: ${overallProgress}% (${totalCompleted}/${totalTasks} タスク完了)`);
}

// メイン処理
async function main(): Promise<void> {
  ensureDirectories();

  const args = process.argv.slice(2);
  const command = args[0];

  switch (command) {
    case "create":
      await createProject(args.slice(1));
      break;

    case "list":
      listProjects();
      break;

    case "show":
      if (!args[1]) {
        console.log("使用法: npm run todo show <project-id> [filter]");
        console.log("フィルター: common, rakuten, amazon, qoo10, yahoo, all");
        return;
      }
      showProjectTodos(args[1], args[2]);
      break;

    case "start":
      if (!args[1] || !args[2]) {
        console.log("使用法: npm run todo start <project-id> <task-id>");
        return;
      }
      updateTaskStatus(args[1], args[2], "in_progress");
      break;

    case "complete":
      if (!args[1] || !args[2]) {
        console.log("使用法: npm run todo complete <project-id> <task-id>");
        return;
      }
      updateTaskStatus(args[1], args[2], "completed");
      break;

    case "skip":
      if (!args[1] || !args[2]) {
        console.log("使用法: npm run todo skip <project-id> <task-id>");
        return;
      }
      updateTaskStatus(args[1], args[2], "skipped");
      break;

    case "reset":
      if (!args[1] || !args[2]) {
        console.log("使用法: npm run todo reset <project-id> <task-id>");
        return;
      }
      updateTaskStatus(args[1], args[2], "pending");
      break;

    case "dashboard":
    case "":
    case undefined:
      showDashboard();
      break;

    default:
      console.log("╔════════════════════════════════════════════════════════╗");
      console.log("║     Next Engine TODO マネージャー                        ║");
      console.log("╚════════════════════════════════════════════════════════╝");
      console.log("\n使用可能なコマンド:");
      console.log("");
      console.log("  npm run todo                    ダッシュボード表示");
      console.log("  npm run todo list               プロジェクト一覧");
      console.log("  npm run todo create             新規プロジェクト作成");
      console.log("  npm run todo show <id>          TODO一覧表示");
      console.log("  npm run todo show <id> <mall>   モール別TODO表示");
      console.log("  npm run todo start <id> <task>  タスク開始");
      console.log("  npm run todo complete <id> <task> タスク完了");
      console.log("  npm run todo skip <id> <task>   タスクスキップ");
      console.log("  npm run todo reset <id> <task>  タスクリセット");
      console.log("");
      console.log("例:");
      console.log("  npm run todo create");
      console.log("  npm run todo show bjc-main");
      console.log("  npm run todo show bjc-main rakuten");
      console.log("  npm run todo complete bjc-main common-001");
      break;
  }
}

main();
