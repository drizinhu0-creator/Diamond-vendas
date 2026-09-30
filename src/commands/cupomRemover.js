const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const Cupom = require('../models/Cupom');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('cupom-remover')
    .setDescription('Remove um cupom')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption((opt) => opt.setName('codigo').setDescription('Código do cupom').setRequired(true)),

  async execute(interaction) {
    const codigo = interaction.options.getString('codigo').toUpperCase().trim();
    const removido = await Cupom.findOneAndDelete({ guildId: interaction.guild.id, codigo });
    if (!removido) {
      return interaction.reply({ content: `❌ Cupom \`${codigo}\` não encontrado.`, ephemeral: true });
    }
    await interaction.reply({ content: `🗑️ Cupom \`${codigo}\` removido.`, ephemeral: true });
  },
};
