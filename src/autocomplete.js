const Produto = require('./models/Produto');

async function autocompleteProduto(interaction) {
  const foco = interaction.options.getFocused();
  const produtos = await Produto.find({
    guildId: interaction.guild.id,
    nome: { $regex: foco, $options: 'i' },
  })
    .limit(25)
    .lean();

  await interaction.respond(
    produtos.map((p) => ({ name: `${p.nome} (${p.variacoes.length} variação/ões)`.slice(0, 100), value: String(p._id) }))
  );
}

async function autocompleteVariacao(interaction) {
  const foco = interaction.options.getFocused();
  const produtoId = interaction.options.getString('produto');

  if (!produtoId) {
    return interaction.respond([{ name: 'Escolha um produto primeiro', value: 'nenhum' }]);
  }

  const produto = await Produto.findOne({ _id: produtoId, guildId: interaction.guild.id }).lean();
  if (!produto) {
    return interaction.respond([{ name: 'Produto inválido', value: 'nenhum' }]);
  }

  const variacoes = produto.variacoes.filter((v) => v.nome.toLowerCase().includes(String(foco).toLowerCase())).slice(0, 25);

  await interaction.respond(
    variacoes.map((v) => ({
      name: `${v.nome} — R$ ${v.preco.toFixed(2)} (estoque: ${v.estoque})`.slice(0, 100),
      value: String(v._id),
    }))
  );
}

module.exports = { autocompleteProduto, autocompleteVariacao };
