const mongoose = require('mongoose');

const conectarDB = async () => {
    try {
        await mongoose.connect('mongodb://localhost:27017/juegoBalanza', {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        console.log('✅ Conectado a MongoDB');
    } catch (error) {
        console.error('❌ Error al conectar MongoDB:', error);
    }
};

module.exports = conectarDB;
