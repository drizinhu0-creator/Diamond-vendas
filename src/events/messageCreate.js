const { PermissionFlagsBits } = require('discord.js');
const { tratarTirar } = require('../tirar');
const { tratarDia } = require('../dias');

module.exports = {
  name: 'messageCreate',
  async execute(message, client) {
    if (message.author.bot || !message.guild) return;

    const conteudo = (message.content || '').trim();
    console.log(`📨 Mensagem recebida: "${conteudo}" de ${message.author.tag}`);

    if (!conteudo) {
      if (message.mentions?.has(client.user)) {
        await message
          .reply(
            '⚠️ Sua mensagem chegou **vazia** — o *Message Content Intent* está desativado para este bot. ' +
              'Ative em **Bot → Privileged Gateway Intents** no painel do desenvolvedor e tente de novo.'
          )
          .catch(() => null);
      }
      return;
    }

    if (conteudo.startsWith('!')) {
      const args = conteudo.slice(1).trim().split(/ +/);
      const comando = args.shift()?.toLowerCase();
      if (comando === 'tirar') {
        try {
          await tratarTirar(message, client);
        } catch (err) {
          console.error('Erro no comando !tirar:', err);
          await message.reply('❌ Ocorreu um erro ao abrir o painel de saída.').catch(() => null);
        }
        return;
      }
      if (comando === 'dia') {
        try {
          await tratarDia(message, client, args);
        } catch (err) {
          console.error('Erro no comando !dia:', err);
          await message.reply('❌ Ocorreu um erro ao configurar os dias.').catch(() => null);
        }
        return;
      }
      return;
    }

    if (!conteudo.startsWith('.')) return;
    const args = conteudo.slice(1).trim().split(/ +/);
    const comando = args.shift()?.toLowerCase();
    if (comando !== 'recovery') return;

    if (!message.member?.permissions?.has(PermissionFlagsBits.Administrator)) {
      return message.reply('❌ Apenas administradores podem usar `.recovery`.');
    }

    const guild = message.guild;
    const perms = guild.members.me?.permissions;
    if (!perms?.has(PermissionFlagsBits.ManageChannels) || !perms?.has(PermissionFlagsBits.BanMembers)) {
      return message.reply('❌ Me falta **Gerenciar Canais** ou **Banir Membros** — corrija os cargos do bot e tente de novo.');
    }

    const aviso = await message.reply(
      '🔄 **Recuperação em andamento...** Apagando todos os canais e banindo todos os membros. Aguarde!'
    );

    let membros;
    try {
      membros = await guild.members.fetch();
    } catch (err) {
      await aviso
        .edit(`❌ Não consegui listar os membros (${err.message}). **Nada foi alterado.**`)
        .catch(() => null);
      return;
    }

    const motivo = `Recuperação anti-raid por ${message.author.tag}`;
    let apagados = 0;
    let falhasCanal = 0;

    for (const canal of guild.channels.cache.values()) {
      try {
        await canal.delete(motivo);
        apagados++;
      } catch (err) {
        falhasCanal++;
      }
    }

    const isentar = new Set([message.author.id, guild.ownerId, client.user.id]);
    let banidos = 0;
    let falhasMembro = 0;

    for (const membro of membros.values()) {
      if (isentar.has(membro.id)) continue;
      try {
        await guild.members.ban(membro.id, { reason: motivo });
        banidos++;
      } catch (err) {
        falhasMembro++;
      }
    }

    const resumo =
      `✅ **Recuperação concluída!**\n` +
      `🗑️ Canais apagados: **${apagados}** (${falhasCanal} falhas)\n` +
      `🔨 Membros banidos: **${banidos}** de ${membros.size} (${falhasMembro} falhas — cargo do bot abaixo deles)`;

    console.log(`🧹 ${resumo.replace(/\*\*/g, '').replace(/\n/g, ' | ')}`);

    await aviso.edit(resumo).catch(() => null);
    await message.author.send(resumo).catch(() => null);
  },
};
