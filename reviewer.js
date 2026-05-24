import fetch from "node-fetch";
import * as github from "@actions/github";

const key = process.env.OPENROUTER_API_KEY;
const token = process.env.GITHUB_TOKEN;

const octokit = github.getOctokit(token);

async function run() {

    const userCode = process.env.CODE;

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

    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${key}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            model: "openai/gpt-3.5-turbo",
            messages: [
                {
                    role: "user",
                    content: prompt
                }
            ]
        })
    });

    const data = await res.json();

    let review = "Error generating review";

    if (data.choices) {
        review = data.choices[0].message.content;
    }

    console.log(review);

    // 🔥 POST COMMENT TO PR
    const context = github.context;

    await octokit.rest.issues.createComment({
        owner: context.repo.owner,
        repo: context.repo.repo,
        issue_number: context.issue.number,
        body: `🤖 AI Code Review:\n\n${review}`
    });
}

run();