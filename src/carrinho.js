const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
} = require('discord.js');
const { aplicarEmoji, aplicarEmbedChrome } = require('./personalizacao');

const COR_PRINCIPAL = 0x9b59b6;
const COR_SUCESSO = 0x57f287;
const COR_ERRO = 0xed4245;

function formatarReal(valor) {
  return `R$ ${Number(valor || 0).toFixed(2).replace('.', ',')}`;
}

function gerarCodigoPedido() {
  return `PED-${Date.now().toString(36).toUpperCase()}`;
}

const MESES_PT = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

function formatarDataExtenso(data) {
  const d = data instanceof Date ? data : new Date(data);
  const dia = String(d.getDate()).padStart(2, '0');
  const mes = MESES_PT[d.getMonth()];
  const ano = d.getFullYear();
  const hora = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${dia} de ${mes} de ${ano} às ${hora}:${min}`;
}

const DIAS_PT = [
  'domingo', 'segunda-feira', 'terça-feira', 'quarta-feira',
  'quinta-feira', 'sexta-feira', 'sábado',
];

const MESES_PT_BAIXO = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

// "sábado, 26 de setembro de 2026 às 01:10" — data por extenso como na embed de entregas.
function formatarDataLonga(data) {
  const d = data instanceof Date ? data : new Date(data);
  const dia = String(d.getDate()).padStart(2, '0');
  const mes = MESES_PT_BAIXO[d.getMonth()];
  const ano = d.getFullYear();
  const hora = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${DIAS_PT[d.getDay()]}, ${dia} de ${mes} de ${ano} às ${hora}:${min}`;
}

function calcularTotais(pedido) {
  const totalBruto = pedido.itens.reduce((soma, item) => soma + item.preco * item.quantidade, 0);
  let desconto = 0;

  if (pedido.cupom?.tipo === 'percentual') {
    desconto = totalBruto * (pedido.cupom.valor / 100);
  } else if (pedido.cupom?.tipo === 'fixo') {
    desconto = Math.min(pedido.cupom.valor, totalBruto);
  }

  const totalFinal = Math.max(0, totalBruto - desconto);
  return { totalBruto, desconto, totalFinal };
}

function construirOpcoesVariacoesDoProduto(produto) {
  return produto.variacoes
    .filter((v) => v.ativo)
    .slice(0, 25)
    .map((v) => ({
      label: v.nome.slice(0, 100),
      description: `Preço: ${formatarReal(v.preco)} | Estoque: ${v.estoque > 0 ? v.estoque : 'Esgotado'}`.slice(0, 100),
      value: `${produto._id}:${v._id}`,
      ...((v.emoji || produto.emoji) ? { emoji: v.emoji || produto.emoji } : {}),
    }));
}

function construirOpcoesTodasVariacoes(produtos) {
  const opcoes = [];
  for (const produto of produtos) {
    for (const v of produto.variacoes) {
      if (!v.ativo) continue;
      opcoes.push({
        label: `${produto.nome} — ${v.nome}`.slice(0, 100),
        description: `Preço: ${formatarReal(v.preco)} | Estoque: ${v.estoque > 0 ? v.estoque : 'Esgotado'}`.slice(0, 100),
        value: `${produto._id}:${v._id}`,
        ...((v.emoji || produto.emoji) ? { emoji: v.emoji || produto.emoji } : {}),
      });
    }
  }
  return opcoes.slice(0, 25);
}

// Mantém a imagem do item igual à do produto publicado no painel.
function aplicarImagensItens(pedido, produtos) {
  const porId = new Map(produtos.map((p) => [String(p._id), p.imagemUrl]));
  for (const item of pedido.itens) {
    const url = porId.get(String(item.produtoId));
    if (url) item.imagemUrl = url;
  }
}

function montarEmbedRevisao(pedido, personalizacao) {
  const { totalBruto, desconto, totalFinal } = calcularTotais(pedido);

  const embed = new EmbedBuilder().setColor(COR_PRINCIPAL);
  aplicarEmbedChrome(embed, 'revisaoPedido', personalizacao, { usuario: pedido.username });

  if (pedido.itens.length === 0) {
    embed.setDescription('Seu carrinho está vazio. Use o menu abaixo para adicionar um item.');
  } else {
    const linhas = pedido.itens.map(
      (item, i) =>
        `**${i + 1}. (${item.quantidade}x) ${item.produtoNome} — ${item.variacaoNome}**\n` +
        `${formatarReal(item.preco)} por unidade · subtotal ${formatarReal(item.preco * item.quantidade)}`
    );
    embed.setDescription(linhas.join('\n\n'));
  }

  const totalItens = pedido.itens.reduce((n, i) => n + i.quantidade, 0);
  const campos = [{ name: '🛒 Total de itens', value: String(totalItens), inline: true }];

  const imagemItem = pedido.itens.find((i) => i.imagemUrl)?.imagemUrl;
  if (imagemItem) embed.setImage(imagemItem);

  if (pedido.cupom?.codigo) {
    campos.push({ name: '🏷️ Cupom', value: `\`${pedido.cupom.codigo}\` (-${formatarReal(desconto)})`, inline: true });
  }

  campos.push({ name: '💳 Total à vista', value: formatarReal(totalFinal), inline: true });
  embed.addFields(campos);

  if (desconto > 0) {
    embed.setFooter({ text: `Total sem desconto: ${formatarReal(totalBruto)}` });
  }

  return embed;
}

function montarComponentesRevisao(pedido, opcoesAddItem, personalizacao) {
  const linhas = [];

  if (opcoesAddItem.length > 0) {
    linhas.push(
      new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(`additem_${pedido._id}`)
          .setPlaceholder('➕ Adicionar mais um item ao carrinho')
          .addOptions(opcoesAddItem)
      )
    );
  }

  const temItens = pedido.itens.length > 0;

  linhas.push(
    new ActionRowBuilder().addComponents(
      aplicarEmoji(
        new ButtonBuilder()
          .setCustomId(`irpagamento_${pedido._id}`)
          .setLabel('Ir para o Pagamento')
          .setStyle(ButtonStyle.Success)
          .setDisabled(!temItens),
        'irpagamento',
        personalizacao
      ),
      aplicarEmoji(
        new ButtonBuilder()
          .setCustomId(`editarqtd_${pedido._id}`)
          .setLabel('Editar Quantidade')
          .setStyle(ButtonStyle.Primary)
          .setDisabled(!temItens),
        'editarqtd',
        personalizacao
      )
    )
  );

  linhas.push(
    new ActionRowBuilder().addComponents(
      aplicarEmoji(
        new ButtonBuilder()
          .setCustomId(`usarcupom_${pedido._id}`)
          .setLabel(pedido.cupom?.codigo ? 'Trocar Cupom' : 'Usar Cupom')
          .setStyle(ButtonStyle.Secondary),
        'usarcupom',
        personalizacao
      ),
      aplicarEmoji(
        new ButtonBuilder().setCustomId(`cancelarcarrinho_${pedido._id}`).setLabel('Cancelar').setStyle(ButtonStyle.Danger),
        'cancelarcarrinho',
        personalizacao
      )
    )
  );

  return linhas;
}

function montarEmbedPagamento(pedido, personalizacao) {
  const { totalFinal } = calcularTotais(pedido);
  const totalItens = pedido.itens.reduce((n, i) => n + i.quantidade, 0);

  const embed = new EmbedBuilder().setColor(COR_PRINCIPAL);
  aplicarEmbedChrome(embed, 'pagamento', personalizacao);

  const imagemItem = pedido.itens.find((i) => i.imagemUrl)?.imagemUrl;
  if (imagemItem) embed.setImage(imagemItem);

  return embed
    .setDescription('Selecione abaixo como deseja pagar.')
    .addFields(
      { name: 'Itens', value: String(totalItens), inline: true },
      { name: 'Total', value: formatarReal(totalFinal), inline: true },
      {
        name: 'Itens no carrinho',
        value: pedido.itens.map((i) => `• ${i.quantidade}x ${i.variacaoNome}`).join('\n') || '—',
      }
    );
}

function montarComponentesPagamento(pedido, personalizacao) {
  return [
    new ActionRowBuilder().addComponents(
      aplicarEmoji(
        new ButtonBuilder().setCustomId(`pix_${pedido._id}`).setLabel('Pix').setStyle(ButtonStyle.Success),
        'pix',
        personalizacao
      )
    ),
    new ActionRowBuilder().addComponents(
      aplicarEmoji(
        new ButtonBuilder().setCustomId(`voltarcarrinho_${pedido._id}`).setLabel('Voltar').setStyle(ButtonStyle.Secondary),
        'voltarcarrinho',
        personalizacao
      )
    ),
  ];
}

function montarEmbedEntrega(pedido, totalFinal, confirmadoEm = new Date(), personalizacao) {
  const itensTexto =
    pedido.itens.map((i) => `${i.quantidade}x ${i.produtoNome} — ${i.variacaoNome}`).join('\n') || '—';

  const embed = new EmbedBuilder().setColor(COR_SUCESSO);
  aplicarEmbedChrome(embed, 'novaCompra', personalizacao);

  return embed
    .setDescription(`👤 <@${pedido.userId}> teve seu produto entregue!`)
    .addFields(
      { name: '📦 Produto:', value: itensTexto },
      { name: '💰 Valor:', value: formatarReal(totalFinal) },
      { name: '🕐 Horário:', value: formatarDataExtenso(confirmadoEm) }
    )
    .setFooter({ text: `Pedido ${pedido.codigo}` });
}

// Embed publicada no canal de entregas quando o staff confirma o pagamento.
// Campos com o valor dentro de código (`) igual ao layout "Compra Aprovada".
function montarEmbedCompraAprovada(pedido, dados, personalizacao) {
  const { totalFinal, desconto = 0, confirmadoEm = new Date(), imagemUrl, avatarUrl } = dados;

  const itensTexto =
    pedido.itens
      .map((i) => `\`${i.quantidade}x ${i.variacaoNome} | ${formatarReal(i.preco * i.quantidade)}\``)
      .join('\n') || '—';

  const descontoTexto = pedido.cupom?.codigo
    ? `\`Cupom ${pedido.cupom.codigo} (-${formatarReal(desconto)})\``
    : '`Nenhum Cupom de desconto foi utilizado.`';

  const embed = new EmbedBuilder().setColor(COR_SUCESSO);
  aplicarEmbedChrome(embed, 'compraAprovada', personalizacao);

  embed.addFields(
    { name: '👤 | Comprador', value: `<@${pedido.userId}>` },
    { name: '📅 | Data da Compra', value: `\`${formatarDataLonga(confirmadoEm)}\`` },
    { name: '🛒 | Produtos Comprados', value: itensTexto.slice(0, 1024) },
    { name: '🎉 | Desconto', value: descontoTexto },
    { name: '💵 | Valor Total da Compra', value: `\`${formatarReal(totalFinal)}\`` }
  );

  if (avatarUrl) embed.setThumbnail(avatarUrl);
  if (imagemUrl) embed.setImage(imagemUrl);

  return embed;
}

module.exports = {
  COR_PRINCIPAL,
  COR_SUCESSO,
  COR_ERRO,
  formatarReal,
  formatarDataExtenso,
  formatarDataLonga,
  gerarCodigoPedido,
  calcularTotais,
  construirOpcoesVariacoesDoProduto,
  construirOpcoesTodasVariacoes,
  aplicarImagensItens,
  montarEmbedRevisao,
  montarComponentesRevisao,
  montarEmbedPagamento,
  montarComponentesPagamento,
  montarEmbedEntrega,
  montarEmbedCompraAprovada,
};
