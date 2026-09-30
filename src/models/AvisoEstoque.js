const { Schema, model } = require('mongoose');

const AvisoEstoqueSchema = new Schema(
  {
    guildId: { type: String, required: true },
    produtoId: { type: Schema.Types.ObjectId, required: true },
    produtoNome: { type: String },
    variacaoId: { type: Schema.Types.ObjectId, required: true },
    variacaoNome: { type: String },
    userId: { type: String, required: true },
  },
  { timestamps: true }
);

AvisoEstoqueSchema.index({ variacaoId: 1, userId: 1 }, { unique: true });

module.exports = model('AvisoEstoque', AvisoEstoqueSchema);
