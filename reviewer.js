import fs from "fs";
import fetch from "node-fetch";
import * as github from "@actions/github";

// 🔑 Get keys
const key = process.env.OPENROUTER_API_KEY;
const token = process.env.GITHUB_TOKEN;

// 📦 GitHub API
const octokit = github.getOctokit(token);

// 📂 Read file from argument
const filePath = process.argv[2];
const userCode = fs.readFileSync(filePath, "utf-8");

async function run() {

    console.log("Token:", token ? "FOUND" : "MISSING");
    console.log("API Key:", key ? "FOUND" : "MISSING");

    if (!userCode) {
        console.log("No code found");
        return;
    }

    const prompt = `
You are a strict senior software engineer.

Analyze the following code and give a professional code review.

Return output in this format:

### Bugs
### Security Issues
### Performance Issues
### Improvements

Code:
${userCode}
`;

    console.log("Sending request to OpenRouter...");

    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${key}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            model: "openai/gpt-4o-mini",
            messages: [
                {
                    role: "user",
                    content: prompt
                }
            ]
        })
    });

    console.log("Response status:", res.status);

    const text = await res.text();
    console.log("RAW RESPONSE:", text);

    let data;
    try {
        data = JSON.parse(text);
    } catch (e) {
        console.log("JSON parse error");
        return;
    }

    let review = "Error generating review";

    if (data.choices && data.choices.length > 0) {
        review = data.choices[0]?.message?.content || "No content returned";
    }

    console.log("FINAL REVIEW:", review);

    // 💬 Post comment to PR
    const context = github.context;

    await octokit.rest.issues.createComment({
        owner: context.repo.owner,
        repo: context.repo.repo,
        issue_number: context.issue.number,
        body: `🤖 AI Code Review:\n\n${review}`
    });
}

run();
