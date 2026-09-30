const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const Produto = require('../models/Produto');
const { autocompleteProduto } = require('../autocomplete');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('produto-variacao-add')
    .setDescription('Adiciona uma opção/variação a um produto (ex: "Mensal", "Anual"), com preço e estoque próprios')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption((opt) =>
      opt.setName('produto').setDescription('Produto').setRequired(true).setAutocomplete(true)
    )
    .addStringOption((opt) => opt.setName('nome').setDescription('Nome da variação (ex: Trial 14 dias)').setRequired(true))
    .addNumberOption((opt) => opt.setName('preco').setDescription('Preço em R$').setRequired(true))
    .addIntegerOption((opt) => opt.setName('estoque').setDescription('Quantidade em estoque').setRequired(true)),

  async autocomplete(interaction) {
    await autocompleteProduto(interaction);
  },

  async execute(interaction) {
    const produtoId = interaction.options.getString('produto');
    const nome = interaction.options.getString('nome');
    const preco = interaction.options.getNumber('preco');
    const estoque = interaction.options.getInteger('estoque');

    const produto = await Produto.findOne({ _id: produtoId, guildId: interaction.guild.id });
    if (!produto) {
      return interaction.reply({ content: '❌ Produto não encontrado.', ephemeral: true });
    }

    produto.variacoes.push({ nome, preco, estoque });
    await produto.save();

    const embed = new EmbedBuilder()
      .setTitle('✅ Variação adicionada')
      .setColor(0x57f287)
      .setDescription(
        `Produto: **${produto.nome}**\nVariação: **${nome}**\nPreço: R$ ${preco.toFixed(2)}\nEstoque: ${estoque}`
      );

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
