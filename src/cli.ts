// CLI: ask the assistant one question.
//   npm run ask -- "head-to-head Nadal vs Federer and can I challenge a line call on clay?"
import { config } from "./config.js";
import { ask } from "./agent.js";

const question = process.argv.slice(2).join(" ").trim() ||
  "What's the head-to-head between Nadal and Djokovic, and the weather in Paris?";
console.log(`[provider=${config.provider} offline=${config.offline}]  Q: ${question}\n`);
const res = await ask(question);
console.log(res.answer);
console.log(`\n(tools: ${res.toolsUsed.join(", ") || "none"}${res.citations.length ? " | cites: " + res.citations.join(", ") : ""})`);
process.exit(0);
