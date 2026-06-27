// CLI: ask one question.  Usage: npm run ask -- "what's the weather in Tokyo?"
import { config } from "./config.js";
import { ask } from "./agent.js";

const question = process.argv.slice(2).join(" ").trim() || "What's the weather in Berlin and the latest technology news?";
console.log(`[provider=${config.provider} offline=${config.offline}]  Q: ${question}\n`);

const res = await ask(question);
console.log(res.answer);
console.log(`\n(tools used: ${res.toolsUsed.join(", ") || "none"})`);
process.exit(0);
