const { Schema, model } = require('mongoose');

const ItemSchema = new Schema(
  {
    produtoId: { type: Schema.Types.ObjectId, required: true },
    produtoNome: { type: String, required: true },
    variacaoId: { type: Schema.Types.ObjectId, required: true },
    variacaoNome: { type: String, required: true },
    preco: { type: Number, required: true },
    quantidade: { type: Number, required: true, default: 1, min: 1 },
    imagemUrl: { type: String, default: null },
  },
  { _id: true }
);

const PedidoSchema = new Schema(
  {
    codigo: { type: String, unique: true, required: true },
    guildId: { type: String, required: true, index: true },
    userId: { type: String, required: true },
    username: { type: String, required: true },
    threadId: { type: String },
    canalPainelId: { type: String },
    mensagemRevisaoId: { type: String },
    mensagemPagamentoId: { type: String },
    status: {
      type: String,
      enum: ['carrinho', 'pagamento', 'pago', 'cancelado', 'expirado'],
      default: 'carrinho',
      index: true,
    },
    itens: { type: [ItemSchema], default: [] },
    cupom: {
      codigo: String,
      tipo: String,
      valor: Number,
    },
    confirmadoPor: { type: String },
    pagoEm: { type: Date },
  },
  { timestamps: true }
);

module.exports = model('Pedido', PedidoSchema);
