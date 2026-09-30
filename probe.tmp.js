const { Client, GatewayIntentBits, Events } = require('discord.js');
require('dotenv').config();
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.MessageContent],
});
const t0 = Date.now();
const ts = () => ((Date.now() - t0) / 1000).toFixed(1) + 's';
const contagem = {};
client.on('ready', () => {
  console.log(ts(), '[ready]', client.user.tag);
  const g = client.guilds.cache.get('1543674673685069957');
  console.log(ts(), '[cache SpiritualMist] guild?', !!g, 'canais:', g ? [...g.channels.cache.values()].map((c) => c.name).join(',') : '-');
});
client.on(Events.Raw, (data) => {
  contagem[data.t] = (contagem[data.t] || 0) + 1;
  if (['MESSAGE_CREATE', 'TYPING_START'].includes(data.t)) {
    console.log(ts(), '[RAW]', data.t, JSON.stringify(data.d).slice(0, 140));
  }
});
client.on('messageCreate', (m) => console.log(ts(), '[event messageCreate]', m.author.tag, JSON.stringify(m.content).slice(0, 60)));
client.login(process.env.DISCORD_TOKEN).catch((e) => console.log('login falhou', e.message));
setInterval(() => console.log(ts(), '[contagem]', JSON.stringify(contagem)), 30000);
setTimeout(() => { console.log(ts(), '[fim]', JSON.stringify(contagem)); process.exit(0); }, 180000);
