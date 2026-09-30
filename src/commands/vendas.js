const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const Pedido = require('../models/Pedido');
const { calcularTotais, formatarReal } = require('../carrinho');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('vendas')
    .setDescription('Mostra um relatório das vendas confirmadas')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const pedidos = await Pedido.find({ guildId: interaction.guild.id, status: 'pago' }).sort({ pagoEm: -1 }).limit(15);
    const todosPagos = await Pedido.find({ guildId: interaction.guild.id, status: 'pago' });

    const totalGeral = todosPagos.reduce((soma, p) => soma + calcularTotais(p).totalFinal, 0);

    const embed = new EmbedBuilder()
      .setTitle('📊 Relatório de vendas')
      .setColor(0x9b59b6)
      .addFields(
        { name: 'Vendas confirmadas', value: String(todosPagos.length), inline: true },
        { name: 'Faturamento total', value: formatarReal(totalGeral), inline: true }
      );

    if (pedidos.length > 0) {
      const linhas = pedidos.map((p) => {
        const { totalFinal } = calcularTotais(p);
        const itens = p.itens.map((i) => `${i.quantidade}x ${i.variacaoNome}`).join(', ');
        return `\`${p.codigo}\` — ${itens} — ${formatarReal(totalFinal)} — <@${p.userId}>`;
      });
      embed.addFields({ name: 'Últimas vendas', value: linhas.join('\n').slice(0, 1024) });
    }

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
