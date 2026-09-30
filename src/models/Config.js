const { Schema, model } = require('mongoose');

const ConfigSchema = new Schema({
  guildId: { type: String, required: true, unique: true },
  canalLogsId: { type: String },
  canalEntregasId: { type: String },
  cargoStaffId: { type: String },
  chavePix: { type: String },
  nomeRecebedor: { type: String },
  cidadeRecebedor: { type: String },
  cargoVerificacaoId: { type: String }, // Novo campo para cargo de verificação
});

module.exports = model('Config', ConfigSchema);
