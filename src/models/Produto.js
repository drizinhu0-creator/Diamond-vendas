const { Schema, model } = require('mongoose');

const VariacaoSchema = new Schema(
  {
    nome: { type: String, required: true, trim: true },
    preco: { type: Number, required: true, min: 0 },
    estoque: { type: Number, required: true, default: 0 },
    emoji: { type: String },
    ativo: { type: Boolean, default: true },
  },
  { timestamps: true }
);

const ProdutoSchema = new Schema(
  {
    guildId: { type: String, required: true, index: true },
    nome: { type: String, required: true, trim: true },
    descricao: { type: String, default: 'Sem descrição' },
    emoji: { type: String },
    imagemUrl: { type: String },
    ativo: { type: Boolean, default: true },
    variacoes: { type: [VariacaoSchema], default: [] },
  },
  { timestamps: true }
);

module.exports = model('Produto', ProdutoSchema);
