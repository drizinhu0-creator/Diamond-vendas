const { Schema, model } = require('mongoose');

const MembroVerificadoSchema = new Schema({
  guildId: { type: String, required: true },
  userId: { type: String, required: true },
  cargoVerificacaoId: { type: String, required: true },
  verificadoEm: { type: Date, default: Date.now },
  verificadoPor: { type: String }, // ID do staff que verificou (se aplicável)
}, {
  timestamps: true
});

// Índice composto para garantir que um usuário só tenha uma verificação por servidor
MembroVerificadoSchema.index({ guildId: 1, userId: 1 }, { unique: true });

module.exports = model('MembroVerificado', MembroVerificadoSchema);