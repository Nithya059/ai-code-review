import fetch from "node-fetch";

const key = process.env.OPENROUTER_API_KEY;

async function run() {

    // ✅ Get code from terminal input
    const userCode = process.argv[2] || 
    process.env.CODE;

    // ❌ If no input, stop
    if (!userCode) {
        console.log("Please provide code to review.");
        return;
    }

    // ✅ Clean prompt
    const prompt = `
You are a strict senior software engineer.

Analyze the following code and give a professional code review.

Return output in this format:

### Bugs
- ...

### Security Issues
- ...

### Performance Issues
- ...

### Improvements
- ...

Code:
${userCode}
`;

    // ✅ API call
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

    // ✅ Safe output (no crash)
    if (data.choices) {
        console.log(data.choices[0].message.content);
    } else {
        console.log("Error:", data);
    }
}

run();