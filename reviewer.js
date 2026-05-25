import fs from "fs";
import fetch from "node-fetch";
import * as github from "@actions/github";

const key = process.env.OPENROUTER_API_KEY;
const token = process.env.GITHUB_TOKEN;

if (!key || !token) {
  console.error("Missing OPENROUTER_API_KEY or GITHUB_TOKEN");
  process.exit(1);
}

const octokit = github.getOctokit(token);
const filePath = process.argv[2];

if (!filePath || !fs.existsSync(filePath)) {
  console.error("diff file not found");
  process.exit(1);
}

const userCode = fs.readFileSync(filePath, "utf-8");

async function run() {
  const prompt = `
You are a strict senior software engineer.

Analyze the following pull request diff and give a professional code review.

Return output in this format:

### Bugs
### Security Issues
### Performance Issues
### Improvements

Diff:
${userCode}
`;

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "openai/gpt-4o-mini",
      messages: [{ role: "user", content: prompt }]
    })
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("OpenRouter error:", res.status, text);
    process.exit(1);
  }

  const data = await res.json();
  const review = data.choices?.[0]?.message?.content || "No review content returned";

  const context = github.context;

  await octokit.rest.issues.createComment({
    owner: context.repo.owner,
    repo: context.repo.repo,
    issue_number: context.issue.number,
    body: `🤖 AI Code Review:\n\n${review}`
  });
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});