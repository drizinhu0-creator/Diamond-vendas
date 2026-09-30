const { iniciarMonitoramentoDias } = require('../dias');

module.exports = {
  name: 'clientReady',
  once: true,
  async execute(client) {
    console.log(`✅ Bot online como ${client.user.tag}`);

    iniciarMonitoramentoDias(client);

    // Registra os slash commands (GUILD_ID no .env → só nesse servidor; sem → global).
    await registrarComandos(client);

    const servidores = [...client.guilds.cache.values()];

    // Log 1 — todos os servidores em que o bot está.
    console.log(`\n🏠 Servidores em que o bot está: ${servidores.length}`);
    if (servidores.length === 0) {
      console.log('   ⚠️ O bot não está em nenhum servidor.');
    }
    for (const guild of servidores) {
      console.log(`   • ${guild.name} (${guild.id}) — ${guild.memberCount} membro(s)`);
    }

    // Log 2 — situação dos slash commands em cada servidor.
    await verificarSlashCommands(client, servidores);
    console.log('');
  },
};

async function registrarComandos(client) {
  const comandos = [...client.commands.values()]
    .filter((cmd) => cmd?.data)
    .map((cmd) => cmd.data.toJSON());

  if (comandos.length === 0) {
    console.log('⚠️ Nenhum slash command carregado para registrar.');
    return;
  }

  const guildId = (process.env.GUILD_ID || '').trim();
  const escopo = guildId ? `no servidor ${guildId}` : 'globalmente';

  try {
    if (guildId) {
      await client.application.commands.set(comandos, guildId);
    } else {
      await client.application.commands.set(comandos);
    }
    console.log(`✅ ${comandos.length} slash command(s) registrados ${escopo}.`);
  } catch (err) {
    console.error(`❌ Erro ao registrar slash commands ${escopo}:`, err.message);
  }
}

async function verificarSlashCommands(client, servidores) {
  const esperados = [...client.commands.keys()].sort((a, b) => a.localeCompare(b));

  console.log(`\n📦 Slash commands carregados no código: ${esperados.length}`);

  if (!client.application?.commands) {
    console.log('   ⚠️ Não consegui consultar os comandos registrados na API do Discord.');
    return;
  }

  const nomes = (colecao) => [...colecao.values()].map((cmd) => cmd.name);

  let globais = [];
  try {
    globais = nomes(await client.application.commands.fetch());
    console.log(`🌐 Slash commands globais registrados: ${globais.length}`);
  } catch (err) {
    console.error('   ❌ Erro ao consultar os comandos globais:', err.message);
  }

  if (servidores.length === 0) return;

  console.log('📋 Situação por servidor:');
  let pendentes = 0;

  for (const guild of servidores) {
    let doServidor = [];
    try {
      doServidor = nomes(await client.application.commands.fetch({ guildId: guild.id }));
    } catch (err) {
      pendentes += 1;
      console.log(`   • ${guild.name} — ❌ não consegui consultar (${err.message})`);
      continue;
    }

    const disponiveis = new Set([...globais, ...doServidor]);
    const faltando = esperados.filter((nome) => !disponiveis.has(nome));

    if (faltando.length === 0) {
      console.log(`   • ${guild.name} — ✅ ${esperados.length}/${esperados.length} comandos disponíveis`);
      continue;
    }

    pendentes += 1;
    const lista = faltando.slice(0, 8).map((nome) => `/${nome}`).join(', ');
    const resto = faltando.length > 8 ? ` e mais ${faltando.length - 8}` : '';
    console.log(`   • ${guild.name} — ⚠️ faltando ${faltando.length}/${esperados.length}: ${lista}${resto}`);
  }

  if (pendentes === 0) {
    console.log(`✅ Slash commands disponíveis em todos os ${servidores.length} servidor(es).`);
  } else {
    console.log(
      `⚠️ ${pendentes} servidor(es) sem todos os slash commands. ` +
        'Rode `npm run deploy-commands` para registrar (sem `GUILD_ID` no .env o registro é global e vale para todos os servidores).'
    );
  }
}
