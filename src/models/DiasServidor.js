const { Schema, model } = require('mongoose');

const DiasServidorSchema = new Schema({
  guildId: { type: String, required: true, unique: true, index: true },
  dias: { type: Number, required: true, min: 1 },
  inicioEm: { type: Date, required: true, default: Date.now },
  sairEm: { type: Date, required: true },
});

module.exports = model('DiasServidor', DiasServidorSchema);
