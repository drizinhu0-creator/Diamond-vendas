require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { REST, Routes } = require('discord.js');

const commands = [];
const commandsPath = path.join(__dirname, 'src', 'commands');
for (const arquivo of fs.readdirSync(commandsPath).filter((f) => f.endsWith('.js'))) {
  const command = require(path.join(commandsPath, arquivo));
  commands.push(command.data.toJSON());
}

const rest = new REST().setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    console.log(`🔁 Registrando ${commands.length} comando(s)...`);

    const rota =
      process.env.GUILD_ID && process.env.GUILD_ID.trim()
        ? Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID)
        : Routes.applicationCommands(process.env.CLIENT_ID);

    await rest.put(rota, { body: commands });

    console.log(
      `✅ Comandos registrados ${process.env.GUILD_ID ? 'no servidor de testes (aparecem na hora)' : 'globalmente (pode levar até 1h para propagar)'}.`
    );
  } catch (err) {
    console.error(err);
  }
})();
