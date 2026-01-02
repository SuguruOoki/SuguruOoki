import { readFileSync } from "fs";
import { parse } from "yaml";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import type { Config } from "./types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export function loadConfig(): Config {
  const configPath = join(__dirname, "..", "config.yaml");
  const content = readFileSync(configPath, "utf-8");
  return parse(content) as Config;
}
