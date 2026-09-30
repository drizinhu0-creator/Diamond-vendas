const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require('discord.js');
const { construirOpcoesVariacoesDoProduto, formatarReal } = require('./carrinho');
const { aplicarEmoji } = require('./personalizacao');

// Editor do /painel-loja: guarda o rascunho do painel em memória enquanto o
// administrador edita (mensagem efêmera, por isso não precisa ir pro banco).

const CORES = [
  { nome: 'Roxo', valor: '9B59B6' },
  { nome: 'Azul', valor: '3498DB' },
  { nome: 'Verde', valor: '2ECC71' },
  { nome: 'Vermelho', valor: 'E74C3C' },
  { nome: 'Amarelo', valor: 'F1C40F' },
  { nome: 'Laranja', valor: 'E67E22' },
  { nome: 'Rosa', valor: 'E91E63' },
  { nome: 'Ciano', valor: '1ABC9C' },
  { nome: 'Branco', valor: 'FFFFFF' },
  { nome: 'Grafite', valor: '2C3E50' },
];

const drafts = new Map();

function chaveDraft(guildId, userId) {
  return `${guildId}:${userId}`;
}

function criarDraft(guildId, userId, tipo) {
  const draft = {
    tipo: tipo === 'botao' ? 'botao' : 'menu',
    nome: '🛍️ Loja',
    descricao: '',
    produtoId: null,
    cor: '9B59B6',
    variacaoEstoqueId: null,
  };
  drafts.set(chaveDraft(guildId, userId), draft);
  return draft;
}

function obterDraft(guildId, userId) {
  return drafts.get(chaveDraft(guildId, userId)) || null;
}

function limparDraft(guildId, userId) {
  drafts.delete(chaveDraft(guildId, userId));
}

function montarEmbedPainel(draft, produto) {
  const cor = parseInt(draft.cor, 16);
  const embed = new EmbedBuilder().setColor(Number.isNaN(cor) ? 0x9b59b6 : cor);

  embed.setTitle((draft.nome || '🛍️ Loja').slice(0, 256));
  if (draft.descricao) embed.setDescription(draft.descricao.slice(0, 4096));
  if (produto?.imagemUrl) embed.setImage(produto.imagemUrl);

  if (produto) {
    const ativas = produto.variacoes.filter((v) => v.ativo);
    const valor = ativas.length
      ? ativas
          .slice(0, 15)
          .map((v) => `• **${v.nome}**: ${v.estoque}${v.estoque > 0 ? '' : ' (esgotado)'}`)
          .join('\n')
      : 'Sem variações cadastradas';
    embed.addFields({ name: '📦 Estoque', value: valor.slice(0, 1024) });
  }

  return embed;
}

function botao(id, label, style) {
  return new ButtonBuilder().setCustomId(`pnlbtn_${id}`).setLabel(label).setStyle(style);
}

function botoesEditor() {
  return [
    new ActionRowBuilder().addComponents(
      botao('nome', '📝 Nome', ButtonStyle.Primary),
      botao('desc', '📄 Descrição', ButtonStyle.Primary),
      botao('produto', '🛍️ Produto', ButtonStyle.Secondary)
    ),
    new ActionRowBuilder().addComponents(
      botao('estoque', '📦 Estoque', ButtonStyle.Secondary),
      botao('cor', '🎨 Cor', ButtonStyle.Secondary),
      botao('previa', '👁️ Prévia', ButtonStyle.Secondary)
    ),
    new ActionRowBuilder().addComponents(
      botao('publicar', '🚀 Publicar', ButtonStyle.Success),
      botao('cancelar', '❌ Cancelar', ButtonStyle.Danger)
    ),
  ];
}

function montarMensagemEditor(draft, produto, linhasExtras = [], conteudo = null) {
  const estilo = draft.tipo === 'botao' ? '🔘 Botão' : '📋 Menu de seleção';
  const texto =
    conteudo ??
    [
      '🎨 **Editor do painel da loja**',
      `Estilo escolhido: **${estilo}**`,
      produto ? `Produto: **${produto.nome}**` : 'Produto: *nenhum selecionado*',
      '',
      'Edite com os botões abaixo — a embed é a prévia de como vai ficar publicado.',
    ].join('\n');

  return {
    content: texto,
    embeds: [montarEmbedPainel(draft, produto)],
    components: [...linhasExtras, ...botoesEditor()],
  };
}

function menuProdutos(produtos) {
  const menu = new StringSelectMenuBuilder()
    .setCustomId('pnlproduto')
    .setPlaceholder('Selecione o produto que vai no painel')
    .addOptions(
      produtos.slice(0, 25).map((p) => ({
        label: p.nome.slice(0, 100),
        description: `${p.variacoes.length} variação/ões`.slice(0, 100),
        value: String(p._id),
      }))
    );
  return new ActionRowBuilder().addComponents(menu);
}

function menuCores() {
  const menu = new StringSelectMenuBuilder()
    .setCustomId('pnlcor')
    .setPlaceholder('Selecione a cor da embed')
    .addOptions(CORES.map((c) => ({ label: `🎨 ${c.nome}`, description: `#${c.valor}`, value: c.valor })));
  return new ActionRowBuilder().addComponents(menu);
}

function menuVariacoesEstoque(produto) {
  const menu = new StringSelectMenuBuilder()
    .setCustomId('pnlestvar')
    .setPlaceholder('📦 Qual variação você quer repor?')
    .addOptions(
      produto.variacoes
        .filter((v) => v.ativo)
        .slice(0, 25)
        .map((v) => ({
          label: v.nome.slice(0, 100),
          description: `Estoque atual: ${v.estoque}`.slice(0, 100),
          value: String(v._id),
        }))
    );
  return new ActionRowBuilder().addComponents(menu);
}

function modalNome(draft) {
  const input = new TextInputBuilder()
    .setCustomId('titulo')
    .setLabel('Nome do painel')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(256)
    .setValue(String(draft.nome || '').slice(0, 256));
  return new ModalBuilder().setCustomId('pnlmodal_nome').setTitle('Nome do painel').addComponents(
    new ActionRowBuilder().addComponents(input)
  );
}

function modalDesc(draft) {
  const input = new TextInputBuilder()
    .setCustomId('descricao')
    .setLabel('Descrição do painel')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(false)
    .setMaxLength(4000)
    .setValue(String(draft.descricao || '').slice(0, 4000));
  return new ModalBuilder().setCustomId('pnlmodal_desc').setTitle('Descrição do painel').addComponents(
    new ActionRowBuilder().addComponents(input)
  );
}

function modalEstoque(variacao) {
  const input = new TextInputBuilder()
    .setCustomId('quantidade')
    .setLabel(`Nova quantidade — ${variacao?.nome || 'variação'}`.slice(0, 45))
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setPlaceholder('Ex: 50')
    .setValue(variacao ? String(variacao.estoque) : '');
  return new ModalBuilder().setCustomId('pnlmodal_estoque').setTitle('Repor estoque').addComponents(
    new ActionRowBuilder().addComponents(input)
  );
}

// Painel final publicado no canal (modo botão = 1 botão por variação,
// modo menu = barra de seleção com as variações).
function montarPainelCliente(draft, produto, personalizacao = null) {
  const embed = montarEmbedPainel(draft, produto);
  const ativas = produto.variacoes.filter((v) => v.ativo).slice(0, 25);

  if (ativas.length === 0) {
    embed.setFooter({ text: 'Sem variações cadastradas ainda' });
    return { embeds: [embed], components: [] };
  }

  if (draft.tipo === 'botao') {
    const linhas = [];
    let linha = new ActionRowBuilder();
    ativas.forEach((v, i) => {
      if (i > 0 && i % 5 === 0) {
        linhas.push(linha);
        linha = new ActionRowBuilder();
      }
      linha.addComponents(
        aplicarEmoji(
          new ButtonBuilder()
            .setCustomId(`opcoesbtn_${produto._id}:${v._id}`)
            .setLabel(`Comprar: ${v.nome} — ${formatarReal(v.preco)}`.slice(0, 80))
            .setStyle(ButtonStyle.Success),
          'comprar',
          personalizacao
        )
      );
    });
    linhas.push(linha);
    return { embeds: [embed], components: linhas };
  }

  return {
    embeds: [embed],
    components: [
      new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(`opcoes_${produto._id}`)
          .setPlaceholder('🛍️ Clique aqui para ver as opções')
          .addOptions(construirOpcoesVariacoesDoProduto(produto))
      ),
    ],
  };
}

module.exports = {
  CORES,
  criarDraft,
  obterDraft,
  limparDraft,
  montarEmbedPainel,
  montarMensagemEditor,
  montarPainelCliente,
  menuProdutos,
  menuCores,
  menuVariacoesEstoque,
  modalNome,
  modalDesc,
  modalEstoque,
};
