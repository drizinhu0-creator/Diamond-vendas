const { Schema, model } = require('mongoose');

const CupomSchema = new Schema(
  {
    guildId: { type: String, required: true, index: true },
    codigo: { type: String, required: true, uppercase: true, trim: true },
    tipo: { type: String, enum: ['percentual', 'fixo'], required: true },
    valor: { type: Number, required: true, min: 0 },
    ativo: { type: Boolean, default: true },
    usosMax: { type: Number, default: 0 },
    usos: { type: Number, default: 0 },
  },
  { timestamps: true }
);

CupomSchema.index({ guildId: 1, codigo: 1 }, { unique: true });

module.exports = model('Cupom', CupomSchema);
