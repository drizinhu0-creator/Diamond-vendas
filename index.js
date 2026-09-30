require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client, GatewayIntentBits, Collection } = require('discord.js');
const { conectarMongo } = require('./src/db/mongo');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent,
  ],
});
client.commands = new Collection();

client.on('error', (err) => console.error('❌ Erro no client do Discord:', err));
client.on('warn', (msg) => console.warn('⚠️ Aviso do client do Discord:', msg));
process.on('unhandledRejection', (err) => console.error('❌ Promise rejeitada sem tratamento:', err));
process.on('uncaughtException', (err) => console.error('❌ Exceção não tratada:', err));

const commandsPath = path.join(__dirname, 'src', 'commands');
for (const arquivo of fs.readdirSync(commandsPath).filter((f) => f.endsWith('.js'))) {
  const command = require(path.join(commandsPath, arquivo));
  client.commands.set(command.data.name, command);
}

const eventsPath = path.join(__dirname, 'src', 'events');
for (const arquivo of fs.readdirSync(eventsPath).filter((f) => f.endsWith('.js'))) {
  const event = require(path.join(eventsPath, arquivo));
  const handler = (...args) =>
    Promise.resolve(event.execute(...args, client)).catch((err) =>
      console.error(`❌ Erro no evento "${event.name}":`, err)
    );
  if (event.once) {
    client.once(event.name, handler);
  } else {
    client.on(event.name, handler);
  }
}

// Servidor HTTP simples para o UptimeRobot (monitor "HTTP(s)") manter o bot acordado
const http = require('http');
const PORTA = process.env.PORT || 3000;
http
  .createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Bot online');
  })
  .listen(PORTA, '0.0.0.0', () => console.log(`🌐 Servidor de monitoramento ativo na porta ${PORTA}`));

(async () => {
  await conectarMongo();
  await client.login(process.env.DISCORD_TOKEN);
})();
