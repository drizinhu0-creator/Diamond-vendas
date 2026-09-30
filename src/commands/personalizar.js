const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { montarPainelPrincipal } = require('../personalizacao');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('personalizar')
    .setDescription('Abre o painel para trocar o emoji dos botões e o título/cor das embeds do bot')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    await interaction.reply(montarPainelPrincipal());
  },
};
