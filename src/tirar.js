const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
} = require('discord.js');

// Painel do comando `!tirar` — só o dono do bot pode usá-lo (ver ehDono).
// Os handlers de componente ficam em interactionCreate.js (convenção do projeto);
// aqui ficam apenas a verificação de dono e a montagem das telas.

async function ehDono(client, userId) {
  if (!userId || !client.application) return false;

  let dono = client.application.owner;
  if (!dono) {
    try {
      await client.application.fetch();
      dono = client.application.owner;
    } catch (err) {
      console.error('Erro ao verificar o dono do bot:', err.message);
      return false;
    }
  }
  if (!dono) return false;

  // Dono é um time: aceita o dono do time ou qualquer membro dele.
  if (dono.members) return dono.members.has(userId) || dono.ownerId === userId;
  return dono.id === userId;
}

function listarGuilds(client) {
  return [...client.guilds.cache.values()].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
}

// Tela inicial: lista os servidores e o menu de seleção.
function montarPainelSaida(client) {
  const guilds = listarGuilds(client);

  if (guilds.length === 0) {
    return { content: '⚠️ Não estou em nenhum servidor.', embeds: [], components: [] };
  }

  const linhas = guilds.map((g) => `• **${g.name}** — \`${g.id}\` — ${g.memberCount} membro(s)`);
  const extra = linhas.length > 30 ? `\n... e mais ${linhas.length - 30}` : '';

  const embed = new EmbedBuilder()
    .setTitle('🚪 Sair de um servidor')
    .setColor(0xed4245)
    .setDescription(
      'Selecione abaixo o servidor do qual eu devo sair e confirme na próxima tela.\n\n' +
        linhas.slice(0, 30).join('\n') +
        extra
    )
    .setFooter({ text: `Bot presente em ${guilds.length} servidor(es)` });

  const menu = new StringSelectMenuBuilder()
    .setCustomId('tirarsel')
    .setPlaceholder('Selecione o servidor para sair')
    .addOptions(
      guilds.slice(0, 25).map((g) => ({
        label: g.name.slice(0, 100),
        description: `ID ${g.id} • ${g.memberCount} membro(s)`.slice(0, 100),
        value: g.id,
      }))
    );

  return { embeds: [embed], components: [new ActionRowBuilder().addComponents(menu)] };
}

// Tela de confirmação depois da escolha no menu.
function montarConfirmacaoSaida(guild) {
  const embed = new EmbedBuilder()
    .setTitle('⚠️ Confirmar saída')
    .setColor(0xed4245)
    .setDescription(
      `Tem certeza que deseja que eu saia de **${guild.name}**?\n\n` +
        `🆔 ID: \`${guild.id}\`\n` +
        `👥 Membros: **${guild.memberCount}**\n\n` +
        '⚠️ Depois disso você precisará me convidar de novo para voltar.'
    );

  const linha = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`tirarconf_${guild.id}`).setLabel('Confirmar saída').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('tirarcancel').setLabel('Cancelar').setStyle(ButtonStyle.Secondary)
  );

  return { embeds: [embed], components: [linha] };
}

// `!tirar` — chamado pelo messageCreate.
async function tratarTirar(message, client) {
  if (!(await ehDono(client, message.author.id))) {
    return message.reply('❌ Apenas o **dono do bot** pode usar `!tirar`.');
  }
  return message.reply(montarPainelSaida(client));
}

module.exports = {
  ehDono,
  montarPainelSaida,
  montarConfirmacaoSaida,
  tratarTirar,
};
