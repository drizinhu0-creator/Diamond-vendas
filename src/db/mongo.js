const mongoose = require('mongoose');

async function conectarMongo() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI não definida no .env — configure a string de conexão do MongoDB.');
  }

  mongoose.set('strictQuery', true);
  await mongoose.connect(uri);
  console.log('🗄️  MongoDB conectado.');
}

module.exports = { conectarMongo };
