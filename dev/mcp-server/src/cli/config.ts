import { readFileSync } from "fs";
import { parse } from "yaml";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const configPath = join(__dirname, "../../config.yaml");

interface Config {
  login: {
    country: string;
    phone: string;
    code: string;
  };
  backend: string;
}

let cached: Config | null = null;

export function loadConfig(): Config {
  if (cached) return cached;
  try {
    const content = readFileSync(configPath, "utf-8");
    cached = parse(content) as Config;
    return cached;
  } catch {
    return {
      login: { country: "Germany", phone: "", code: "" },
      backend: "staging",
    };
  }
}
