import fs from "fs";
import fetch from "node-fetch";
import * as github from "@actions/github";

const key = process.env.OPENROUTER_API_KEY;
const token = process.env.GITHUB_TOKEN;
const event = JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH, "utf8"));

if (!key || !token) {
  console.error("Missing OPENROUTER_API_KEY or GITHUB_TOKEN");
  process.exit(1);
}

const octokit = github.getOctokit(token);
const owner = event.repository.owner.login;
const repo = event.repository.name;
const prNumber = event.pull_request.number;

async function getFiles() {
  const files = await octokit.rest.pulls.listFiles({
    owner,
    repo,
    pull_number: prNumber,
    per_page: 100
  });
  return files.data;
}

function buildChunks(files, maxChars = 12000) {
  const chunks = [];
  let current = "";

  for (const file of files) {
    const block = `File: ${file.filename}
Patch:
${file.patch || "[no patch]"}

`;
    if (current.length + block.length > maxChars && current) {
      chunks.push(current);
      current = block;
    } else {
      current += block;
    }
  }

  if (current) chunks.push(current);
  return chunks;
}

async function reviewChunk(chunk) {
  const prompt = `
You are a strict senior software engineer.

Review this PR diff and return only concise findings under these headings:
### Bugs
### Security Issues
### Performance Issues
### Improvements

Diff:
${chunk}
`;

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "openai/gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 1000
    })
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenRouter error: ${res.status} ${text}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content || "No content returned";
}

async function run() {
  const files = await getFiles();
  if (!files.length) {
    console.log("No changed files found");
    return;
  }

  const chunks = buildChunks(files);
  const reviews = [];

  for (const chunk of chunks.slice(0, 4)) {
    reviews.push(await reviewChunk(chunk));
  }

  const body = `🤖 AI Code Review

${reviews.join("

---

")}`;

  await octokit.rest.issues.createComment({
    owner,
    repo,
    issue_number: prNumber,
    body
  });
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});