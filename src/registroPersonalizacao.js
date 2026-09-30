// Catálogo central de TUDO que pode ser personalizado no bot.
// Cada "chave" aqui é o identificador usado para salvar/buscar a personalização
// no MongoDB (Personalizacao.botoes / Personalizacao.embeds) e também é usado
// nos menus de seleção do comando /personalizar.
//
// Se um dia adicionar um botão ou embed novo ao bot, basta cadastrar aqui que
// ele já aparece automaticamente no /personalizar.

const BOTOES = [
  { chave: 'comprar', nome: 'Comprar (botão do painel publicado)', emojiPadrao: '🛒' },
  { chave: 'avisarestoque', nome: 'Avisar quando o estoque voltar', emojiPadrao: '🔔' },
  { chave: 'ircarrinho', nome: 'Ir para o carrinho (link)', emojiPadrao: '🛒' },
  { chave: 'irpagamento', nome: 'Ir para o Pagamento', emojiPadrao: '✅' },
  { chave: 'editarqtd', nome: 'Editar Quantidade', emojiPadrao: '✏️' },
  { chave: 'usarcupom', nome: 'Usar / Trocar Cupom', emojiPadrao: '🏷️' },
  { chave: 'cancelarcarrinho', nome: 'Cancelar Carrinho', emojiPadrao: '🗑️' },
  { chave: 'pix', nome: 'Pagar com Pix', emojiPadrao: '💠' },
  { chave: 'voltarcarrinho', nome: 'Voltar ao Carrinho', emojiPadrao: '↩️' },
  { chave: 'copiarpix', nome: 'Código Copia e Cola', emojiPadrao: '📋' },
  { chave: 'confirmarpg', nome: 'Confirmar Pagamento (staff)', emojiPadrao: '✅' },
  { chave: 'cancelarpg', nome: 'Cancelar Pedido (staff)', emojiPadrao: '❌' },
  { chave: 'confirmado', nome: 'Botão travado "Confirmado por..."', emojiPadrao: '✅' },
  { chave: 'cancelado', nome: 'Botão travado "Cancelado por..."', emojiPadrao: '❌' },
];

const EMBEDS = [
  {
    chave: 'revisaoPedido',
    nome: 'Revisão do Pedido (carrinho)',
    tituloPadrao: '🛍️ Revisão do Pedido — {usuario}',
    corPadrao: '9B59B6',
    variaveis: ['usuario'],
  },
  {
    chave: 'pagamento',
    nome: 'Forma de Pagamento',
    tituloPadrao: '🛒 Forma de Pagamento',
    corPadrao: '9B59B6',
    variaveis: [],
  },
  {
    chave: 'pedidoPix',
    nome: 'Cobrança Pix (QR Code)',
    tituloPadrao: '🧾 Pedido {codigo}',
    corPadrao: '5865F2',
    variaveis: ['codigo'],
  },
  {
    chave: 'pagamentoConfirmado',
    nome: 'Pagamento Confirmado',
    tituloPadrao: '✅ Pagamento confirmado!',
    corPadrao: '57F287',
    variaveis: [],
  },
  {
    chave: 'novaCompra',
    nome: 'Nova Compra (canal de logs)',
    tituloPadrao: '🛒 Nova compra!',
    corPadrao: '57F287',
    variaveis: [],
  },
  {
    chave: 'compraAprovada',
    nome: 'Compra Aprovada (canal de entregas)',
    tituloPadrao: 'Compra Aprovada',
    corPadrao: '57F287',
    variaveis: [],
  },
];

function buscarBotao(chave) {
  return BOTOES.find((b) => b.chave === chave);
}

function buscarEmbed(chave) {
  return EMBEDS.find((e) => e.chave === chave);
}

module.exports = { BOTOES, EMBEDS, buscarBotao, buscarEmbed };
