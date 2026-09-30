const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const Pedido = require('../models/Pedido');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ticket-fechar')
    .setDescription('Fecha (apaga) o canal do carrinho/ticket atual')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  async execute(interaction) {
    const canal = interaction.channel;

    const ehCarrinho =
      canal.type === ChannelType.GuildText ||
      canal.type === ChannelType.PrivateThread ||
      canal.type === ChannelType.PublicThread;

    if (!ehCarrinho) {
      return interaction.reply({ content: '❌ Use esse comando dentro do canal de um carrinho.', ephemeral: true });
    }

    const pedido = await Pedido.findOne({ threadId: canal.id });
    if (!pedido) {
      return interaction.reply({ content: '❌ Esse canal não é um carrinho de compra.', ephemeral: true });
    }

    await Pedido.updateOne({ _id: pedido._id, status: { $in: ['carrinho', 'pagamento'] } }, { status: 'cancelado' });

    await interaction.reply('🔒 Fechando este ticket em 3 segundos...');
    setTimeout(async () => {
      await canal.delete('Ticket fechado com /ticket-fechar').catch(async (err) => {
        console.error('❌ Não consegui apagar o canal do carrinho:', err.message);
        if (canal.isThread?.()) {
          await canal.setLocked(true).catch(() => null);
          await canal.setArchived(true).catch(() => null);
        }
      });
    }, 3000);
  },
};
