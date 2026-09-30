const { ChannelType } = require('discord.js');
const Pedido = require('./models/Pedido');
const Produto = require('./models/Produto');
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

  // O carrinho vira um TÓPICO PRIVADO dentro do canal onde o painel foi publicado.
  // Se o clique veio de dentro de um tópico, usa o canal pai.
  const canalBase = interaction.channel.isThread?.() ? interaction.channel.parent : interaction.channel;

  if (!canalBase?.threads) {
    throw new Error('Não consegui criar o tópico: o painel precisa estar em um canal de texto.');
  }

  const topico = await canalBase.threads.create({
    name: `carrinho-${nomeLimpo}`,
    type: ChannelType.PrivateThread,
    autoArchiveDuration: 1440,
    invitable: false,
    reason: `Carrinho de compra de ${interaction.user.tag}`,
  });

  await topico.members.add(interaction.user.id);
  return topico;
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
