const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const Produto = require('../models/Produto');
const { autocompleteProduto } = require('../autocomplete');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('produto-remover')
    .setDescription('Remove um produto (e todas as suas variações) da loja')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption((opt) => opt.setName('produto').setDescription('Produto').setRequired(true).setAutocomplete(true)),

  async autocomplete(interaction) {
    await autocompleteProduto(interaction);
  },

  async execute(interaction) {
    const produtoId = interaction.options.getString('produto');
    const produto = await Produto.findOneAndDelete({ _id: produtoId, guildId: interaction.guild.id });
    if (!produto) {
      return interaction.reply({ content: '❌ Produto não encontrado.', ephemeral: true });
    }
    await interaction.reply({ content: `🗑️ Produto **${produto.nome}** removido.`, ephemeral: true });
  },
};
