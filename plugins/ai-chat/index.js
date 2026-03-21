module.exports = {
    name: "AI Chat Bot",
    dependencies: {},
    hooks: {
        "on_message": async (message, client) => {
            if (message.author.bot) return;
            if (message.mentions.has(client.user.id)) {
                const prompt = message.content.replace(`<@${client.user.id}>`, "").trim();
                if (!prompt) return message.reply("How can I help you today?");
                await message.channel.sendTyping();
                try {
                    const encodedPrompt = encodeURIComponent(prompt);
                    const url = "https://text.pollinations.ai/prompt/" + encodedPrompt;
                    const response = await fetch(url);
                    const text = await response.text();
                    if (text.length > 2000) {
                        return message.reply(text.substring(0, 1997) + "...");
                    }
                    message.reply(text);
                } catch (error) {
                    console.error("AI Chat Error:", error);
                    message.reply("Sorry, my brain is a bit foggy right now. (AI API Error)");
                }
            }
        }
    },
    commands: [
        {
            name: "ask",
            dependencies: {},
            description: "Ask the AI a specific question.",
            type: "slash",
            arguments: [{ name: "question", type: "string", required: true }],
            actions: [
                { type: "api_request", method: "GET", url: "https://text.pollinations.ai/prompt/${question}" },
                { type: "send_message", content: "🤖 **AI Response:**\n${apiData}" }
            ]
        },
        {
            name: "imagine",
            dependencies: {},
            description: "Generate an image using AI.",
            type: "slash",
            arguments: [{ name: "prompt", type: "string", required: true }],
            actions: [
                { type: "create_embed", embed: { title: "🎨 Image Generation", description: "Prompt: ${prompt}", image: "https://image.pollinations.ai/prompt/${prompt}" } }
            ]
        }
    ],
    init() {
        console.log("🤖 AI Chat Bot: Integrated with text.pollinations.ai & image.pollinations.ai");
    }
};
