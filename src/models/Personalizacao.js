const { Schema, model } = require('mongoose');

const PersonalizacaoSchema = new Schema({
  guildId: { type: String, required: true, unique: true },
  // chave = identificador do botão (ver src/registroPersonalizacao.js) -> { emoji }
  botoes: {
    type: Map,
    of: new Schema({ emoji: String }, { _id: false }),
    default: {},
  },
  // chave = identificador da embed (ver src/registroPersonalizacao.js) -> { titulo, cor }
  embeds: {
    type: Map,
    of: new Schema({ titulo: String, cor: String }, { _id: false }),
    default: {},
  },
});

module.exports = model('Personalizacao', PersonalizacaoSchema);
