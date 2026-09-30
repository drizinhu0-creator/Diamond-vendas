const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const Produto = require('../models/Produto');
const { autocompleteProduto, autocompleteVariacao } = require('../autocomplete');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('produto-variacao-remover')
    .setDescription('Remove uma variação de um produto')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption((opt) => opt.setName('produto').setDescription('Produto').setRequired(true).setAutocomplete(true))
    .addStringOption((opt) => opt.setName('variacao').setDescription('Variação').setRequired(true).setAutocomplete(true)),

  async autocomplete(interaction) {
    const focused = interaction.options.getFocused(true);
    if (focused.name === 'produto') return autocompleteProduto(interaction);
    return autocompleteVariacao(interaction);
  },

  async execute(interaction) {
    const produtoId = interaction.options.getString('produto');
    const variacaoId = interaction.options.getString('variacao');

    const produto = await Produto.findOne({ _id: produtoId, guildId: interaction.guild.id });
    const variacao = produto?.variacoes.id(variacaoId);
    if (!produto || !variacao) {
      return interaction.reply({ content: '❌ Produto ou variação não encontrados.', ephemeral: true });
    }

    const nome = variacao.nome;
    variacao.deleteOne();
    await produto.save();

    await interaction.reply({ content: `✅ Variação **${nome}** removida de **${produto.nome}**.`, ephemeral: true });
  },
};
