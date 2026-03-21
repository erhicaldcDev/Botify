module.exports = {
    name: "Translation Tool",
    dependencies: {},
    commands: [
        {
            name: "translate",
            description: "Translate any text via Google Translate API.",
            type: "slash",
            arguments: [
                { name: "text", type: "string", required: true },
                { name: "target", type: "string", required: true }
            ],
            actions: [
                { type: "api_request", method: "GET", url: "https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${target}&dt=t&q=${text}" },
                {
                    type: "create_embed",
                    embed: {
                        title: "🌍 Translation Server",
                        description: "**Original:**\n${text}\n\n**Translated (${target}):**\n${apiData[0][0][0]}",
                        color: "#4285F4"
                    }
                }
            ]
        }
    ]
};
