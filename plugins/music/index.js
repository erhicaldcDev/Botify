module.exports = {
    name: "Music Core",
    dependencies: {
        "distube": "^4.2.1",
        "@discordjs/voice": "^0.17.0",
        "ffmpeg-static": "^5.2.0",
        "libsodium-wrappers": "^0.7.13"
    },
    hooks: {
        on_init: (client) => {
            const { DisTube } = require("distube");
            client.distube = new DisTube(client, {
                emitNewSongOnly: true,
                leaveOnFinish: true,
                leaveOnEmpty: true,
            });

            client.distube.on("playSong", (queue, song) => {
                queue.textChannel?.send({
                    embeds: [{
                        title: "🎶 Now Playing",
                        description: `**[${song.name}](${song.url})**\nDuration: \`${song.formattedDuration}\``,
                        color: 0x1DB954,
                        thumbnail: { url: song.thumbnail }
                    }]
                });
            });

            client.distube.on("addSong", (queue, song) => {
                queue.textChannel?.send(`🎵 Added **${song.name}** to the queue!`);
            });

            client.distube.on("error", (channel, e) => {
                if (channel) channel.send(`❌ An error occurred: ${e.toString().slice(0, 1000)}`);
                console.error(e);
            });
        }
    },
    commands: [
        {
            name: "play",
            description: "Play music from a search term or URL.",
            type: "slash",
            arguments: [{ name: "query", type: "string", required: true }],
            actions: [
                { type: "set_variable", name: "vChannel", value: "interaction.member.voice.channel" },
                {
                    type: "if_condition", condition: "vChannel", then: [
                        { type: "send_message", content: "🔍 Searching for your track..." },
                        { type: "raw_code", code: "      try {\n        await client.distube.play(vChannel, interaction.options.getString('query'), { textChannel: interaction.channel, member: interaction.member });\n      } catch (e) {\n        console.error(e);\n        interaction.followUp('Failed to play the track.');\n      }" }
                    ], else: [
                        { type: "send_message", content: "❌ You must be in a voice channel to use this command!" }
                    ]
                }
            ]
        },
        {
            name: "skip",
            description: "Skip the currently playing track.",
            type: "slash",
            actions: [
                { type: "raw_code", code: "      const queue = client.distube.getQueue(interaction.guildId);\n      if (!queue) { await interaction.reply('There is no music playing!'); return; }\n      try { queue.skip(); await interaction.reply('⏭️ Skipped the current track.'); } catch (e) { await interaction.reply('Could not skip track (is there a next track?).'); }" }
            ]
        },
        {
            name: "stop",
            description: "Stop music and clear the queue.",
            type: "slash",
            actions: [
                { type: "raw_code", code: "      const queue = client.distube.getQueue(interaction.guildId);\n      if (!queue) { await interaction.reply('There is no music playing!'); return; }\n      queue.stop();\n      await interaction.reply('⏹️ Stopped the music and cleared the queue.');" }
            ]
        },
        {
            name: "queue",
            description: "Show the current song queue.",
            type: "slash",
            actions: [
                { type: "raw_code", code: "      const queue = client.distube.getQueue(interaction.guildId);\n      if (!queue) { await interaction.reply('There is no queue!'); return; }\n      const q = queue.songs.slice(0, 10).map((song, i) => `${i === 0 ? 'Playing:' : `${i}.`} ${song.name} - \`${song.formattedDuration}\``).join('\\n');\n      await interaction.reply({ embeds: [{ title: '📄 Current Queue', description: q, color: 0x1DB954 }] });" }
            ]
        }
    ],
    init() {
        console.log("🎵 Music Core initialized with DisTube. Ready to rock.");
    }
};
