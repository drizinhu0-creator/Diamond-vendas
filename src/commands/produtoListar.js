const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const Produto = require('../models/Produto');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('produto-listar')
    .setDescription('Lista todos os produtos e suas variações')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const produtos = await Produto.find({ guildId: interaction.guild.id }).sort({ createdAt: 1 });

    if (produtos.length === 0) {
      return interaction.reply({ content: 'Nenhum produto cadastrado ainda. Use `/produto-add`.', ephemeral: true });
    }

    const embed = new EmbedBuilder().setTitle('📦 Produtos da loja').setColor(0x9b59b6);

    for (const p of produtos) {
      const linhas =
        p.variacoes.length > 0
          ? p.variacoes
              .map((v) => `• **${v.nome}** — R$ ${v.preco.toFixed(2)} — estoque: ${v.estoque} — id: \`${v._id}\``)
              .join('\n')
          : '_sem variações — use /produto-variacao-add_';

      embed.addFields({
        name: `${p.ativo ? '🟢' : '🔴'} ${p.nome} — id: \`${p._id}\``,
        value: linhas.slice(0, 1024),
      });
    }

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
