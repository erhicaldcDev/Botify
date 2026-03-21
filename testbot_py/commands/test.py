import discord
from discord.ext import commands
from discord import app_commands

class Test(commands.Cog):
    def __init__(self, bot):
        self.bot = bot

    @app_commands.command(name="test", description="test")
    async def test(self, interaction: discord.Interaction):
        if True:
            await interaction.response.send_message("test")

async def setup(bot):
    await bot.add_cog(Test(bot))
