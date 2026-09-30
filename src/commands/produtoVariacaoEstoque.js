const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const Produto = require('../models/Produto');
const AvisoEstoque = require('../models/AvisoEstoque');
const { autocompleteProduto, autocompleteVariacao } = require('../autocomplete');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('produto-variacao-estoque')
    .setDescription('Define a quantidade em estoque de uma variação')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption((opt) => opt.setName('produto').setDescription('Produto').setRequired(true).setAutocomplete(true))
    .addStringOption((opt) => opt.setName('variacao').setDescription('Variação').setRequired(true).setAutocomplete(true))
    .addIntegerOption((opt) => opt.setName('quantidade').setDescription('Novo estoque').setRequired(true)),

  async autocomplete(interaction) {
    const focused = interaction.options.getFocused(true);
    if (focused.name === 'produto') return autocompleteProduto(interaction);
    return autocompleteVariacao(interaction);
  },

  async execute(interaction) {
    const produtoId = interaction.options.getString('produto');
    const variacaoId = interaction.options.getString('variacao');
    const quantidade = interaction.options.getInteger('quantidade');

    const produto = await Produto.findOne({ _id: produtoId, guildId: interaction.guild.id });
    const variacao = produto?.variacoes.id(variacaoId);
    if (!produto || !variacao) {
      return interaction.reply({ content: '❌ Produto ou variação não encontrados.', ephemeral: true });
    }

    const estoqueAnterior = variacao.estoque;
    variacao.estoque = quantidade;
    await produto.save();

    await interaction.reply({
      content: `✅ Estoque de **${produto.nome} — ${variacao.nome}** atualizado: ${estoqueAnterior} → **${quantidade}**.`,
      ephemeral: true,
    });

    if (estoqueAnterior <= 0 && quantidade > 0) {
      const avisos = await AvisoEstoque.find({ variacaoId: variacao._id });
      for (const aviso of avisos) {

        const user = await interaction.client.users.fetch(aviso.userId).catch(() => null);
        if (user) {

          await user
            .send(
              `🔔 O estoque de **${produto.nome} — ${variacao.nome}** voltou! Já dá pra comprar de novo em **${interaction.guild.name}**.`
            )
            .catch(() => null);
        }
      }
      await AvisoEstoque.deleteMany({ variacaoId: variacao._id });
    }
  },
};
