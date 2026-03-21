local discordia = require('discordia')
local client = discordia.Client()

client:on('ready', function()
    print('Logged in as ' .. client.user.username)
end)

client:on('messageCreate', function(message)
    local content = message.content
    local author = message.author
    if author.bot then return end

    if content == '!ping' then
        message:reply('pong!')
    end
end)

client:run('Bot YOUR_TOKEN_HERE')
