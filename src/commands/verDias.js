const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { buscarPrazo, formatarTempo, formatarData } = require('../dias');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ver-dias')
    .setDescription('Mostra por quanto tempo o bot ficará neste servidor e quanto tempo falta para ele sair')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const registro = await buscarPrazo(interaction.guild.id);

    if (!registro) {
      return interaction.reply({
        content:
          '♾️ **Nenhum limite de dias configurado** para este servidor — vou ficar aqui indefinidamente.\n' +
          'ℹ️ O dono do bot pode definir um prazo com `!dia <número de dias>`.',
        ephemeral: true,
      });
    }

    const restante = registro.sairEm.getTime() - Date.now();

    const embed = new EmbedBuilder()
      .setTitle('⏳ Dias do bot neste servidor')
      .setColor(restante > 0 ? 0x57f287 : 0xed4245)
      .addFields(
        { name: '🏠 Servidor', value: `${interaction.guild.name} (\`${interaction.guild.id}\`)`, inline: true },
        { name: '📅 Dias configurados', value: `**${registro.dias}** dia(s)`, inline: true },
        { name: '🕒 Início do prazo', value: `**${formatarData(registro.inicioEm)}**`, inline: true },
        { name: '🚪 Saída prevista', value: `**${formatarData(registro.sairEm)}**`, inline: true },
        {
          name: '⏳ Tempo restante',
          value: restante > 0 ? `**${formatarTempo(restante)}**` : '⏰ Prazo encerrado — sairei em instantes.',
          inline: true,
        }
      );

    return interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
