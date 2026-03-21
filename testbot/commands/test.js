const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("test")
    .setDescription("test")
,
  async execute(interaction, client) {
    if (true) {
        if (typeof interaction !== "undefined") { await interaction.reply("test"); }
        else if (typeof message !== "undefined") { await message.reply("test"); }
        else if (typeof member !== "undefined" && member.guild.systemChannel) { await member.guild.systemChannel.send("test"); }
    }
  },
};
