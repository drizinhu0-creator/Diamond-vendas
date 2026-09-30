const { ChannelType, PermissionsBitField } = require('discord.js');
const Pedido = require('./models/Pedido');
const Produto = require('./models/Produto');
const Config = require('./models/Config');
const {
  gerarCodigoPedido,
  montarEmbedRevisao,
  montarComponentesRevisao,
  construirOpcoesTodasVariacoes,
  aplicarImagensItens,
} = require('./carrinho');

async function obterPedidoAberto(guildId, userId) {
  return Pedido.findOne({ guildId, userId, status: { $in: ['carrinho', 'pagamento'] } });
}

async function criarCanalCarrinho(interaction) {
  const nomeLimpo = interaction.user.username.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 30) || 'cliente';

  const cfg = await Config.findOne({ guildId: interaction.guild.id });
  const cargoStaff = cfg?.cargoStaffId
    ? await interaction.guild.roles.fetch(cfg.cargoStaffId).catch(() => null)
    : null;

  const acesso = [
    PermissionsBitField.Flags.ViewChannel,
    PermissionsBitField.Flags.SendMessages,
    PermissionsBitField.Flags.AttachFiles,
    PermissionsBitField.Flags.EmbedLinks,
    PermissionsBitField.Flags.ReadMessageHistory,
  ];

  const permissoes = [
    { id: interaction.guild.roles.everyone.id, deny: [PermissionsBitField.Flags.ViewChannel] },
    { id: interaction.user.id, allow: acesso },
  ];

  if (cargoStaff) {
    permissoes.push({ id: cargoStaff.id, allow: acesso });
  }

  // Cria na mesma categoria do painel (se houver).
  const fonte = interaction.channel.isThread?.() ? interaction.channel.parent : interaction.channel;
  const categoria =
    fonte?.parentId && interaction.guild.channels.cache.get(fonte.parentId)?.type === ChannelType.GuildCategory
      ? fonte.parentId
      : undefined;

  return interaction.guild.channels.create({
    name: `carrinho-${nomeLimpo}`,
    type: ChannelType.GuildText,
    parent: categoria,
    permissionOverwrites: permissoes,
    reason: `Carrinho de compra de ${interaction.user.tag}`,
  });
}

async function atualizarMensagemRevisao(client, pedido) {
  const canal = await client.channels.fetch(pedido.threadId).catch(() => null);
  if (!canal) return;

  const produtos = await Produto.find({ guildId: pedido.guildId, ativo: true });
  aplicarImagensItens(pedido, produtos);
  const opcoesAddItem = construirOpcoesTodasVariacoes(produtos);

  const embed = montarEmbedRevisao(pedido);
  const componentes = montarComponentesRevisao(pedido, opcoesAddItem);

  if (pedido.mensagemRevisaoId) {
    const msg = await canal.messages.fetch(pedido.mensagemRevisaoId).catch(() => null);
    if (msg) {
      await msg.edit({ embeds: [embed], components: componentes });
      return;
    }
  }

  const msg = await canal.send({ content: `<@${pedido.userId}>`, embeds: [embed], components: componentes });
  pedido.mensagemRevisaoId = msg.id;
  await pedido.save();
}

function adicionarItemAoPedido(pedido, produto, variacao) {
  const existente = pedido.itens.find((i) => String(i.variacaoId) === String(variacao._id));
  if (existente) {
    existente.quantidade += 1;
    if (produto.imagemUrl) existente.imagemUrl = produto.imagemUrl;
  } else {
    pedido.itens.push({
      produtoId: produto._id,
      produtoNome: produto.nome,
      variacaoId: variacao._id,
      variacaoNome: variacao.nome,
      preco: variacao.preco,
      quantidade: 1,
      imagemUrl: produto.imagemUrl || null,
    });
  }
}

async function novoCodigoPedidoUnico() {
  let codigo;
  do {
    codigo = gerarCodigoPedido();

  } while (await Pedido.exists({ codigo }));
  return codigo;
}

module.exports = {
  obterPedidoAberto,
  criarCanalCarrinho,
  atualizarMensagemRevisao,
  adicionarItemAoPedido,
  novoCodigoPedidoUnico,
};
