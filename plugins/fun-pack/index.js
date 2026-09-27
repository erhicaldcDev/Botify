module.exports = {
    name: "Premium Fun Pack",
    dependencies: {},
    blocks: [
        {
            type: "send_meme", label: "Send Meme", label_pl: "Wyślij Mema", icon: "🐸", category: "plugin",
            description: "Reply with a random meme from meme-api.com",
            fields: [{ key: "subreddit", label: "Subreddit (optional)", type: "text", default: "" }],
            compile: {
                node: (a) => `try {\n  const meme = await B.http(${JSON.stringify("https://meme-api.com/gimme" + (a.subreddit ? "/" + encodeURIComponent(a.subreddit) : ""))});\n  await B.reply(ctx, { embeds: [B.embed(ctx, { title: meme.title, image: meme.url, footer: \`👍 \${meme.ups} upvotes\`, color: "#FF4500" })] });\n} catch (e) {\n  await B.reply(ctx, "Couldn't fetch a meme right now.");\n}`,
            },
        }
    ],
    commands: [
        {
            name: "8ball",
            description: "Ask the magic 8-ball a question.",
            type: "slash",
            arguments: [{ name: "question", type: "string", required: true }],
            actions: [
                { type: "set_variable", name: "answers", value: "['Yes', 'No', 'Maybe', 'Definitely not', 'Ask again later', 'Without a doubt']" },
                { type: "set_variable", name: "answer", value: "answers[Math.floor(Math.random() * answers.length)]" },
                { type: "create_embed", embed: { title: "🎱 Magic 8-Ball", description: "**Q:** ${question}\n**A:** ${answer}", color: "#000000" } }
            ]
        },
        {
            name: "meme",
            description: "Fetches a random meme.",
            type: "slash",
            actions: [
                { type: "api_request", method: "GET", url: "https://meme-api.com/gimme" },
                { type: "create_embed", embed: { title: "${apiData.title}", image: "${apiData.url}", footer: "👍 ${apiData.ups} upvotes", color: "#FF4500" } }
            ]
        },
        {
            name: "coinflip",
            description: "Flip a coin.",
            type: "slash",
            actions: [
                { type: "set_variable", name: "side", value: "Math.random() > 0.5 ? 'Heads' : 'Tails'" },
                { type: "send_message", content: "🪙 The coin landed on **${side}**!" }
            ]
        },
        {
            name: "mini-quiz",
            description: "Play a quick interactive quiz!",
            type: "slash",
            actions: [
                {
                    type: "set_variable",
                    name: "points",
                    value: "0"
                },
                {
                    type: "send_await_interaction",
                    content: "🧠 **Pytanie:** Który z tych formatów dotyczy obrazków?",
                    saveTo: "wybor_gracza",
                    time: 30000,
                    components: [
                        { label: "A: .png", id: "odp_a", style: 1 },
                        { label: "B: .exe", id: "odp_b", style: 4 },
                        { label: "C: .txt", id: "odp_c", style: 2 }
                    ]
                },
                {
                    type: "if_condition",
                    condition: "wybor_gracza === 'odp_a'",
                    then: [
                        { type: "set_variable", name: "points", value: "points + 1" },
                        { type: "send_message", content: "🎉 Poprawna odpowiedź! .png to format graficzny bezstratny." }
                    ],
                    else: [
                        { type: "send_message", content: "💀 Błąd! Poprawna odpowiedź to A (.png)." }
                    ]
                },
                {
                    type: "ephemeral_message",
                    content: "Zakończyłeś quiz. Twój wynik: ${points}/1"
                }
            ]
        }
    ]
};
