require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error('ERRO FATAL: JWT_SECRET não definido no .env');
  process.exit(1);
}

const PORT = process.env.PORT || 3000;
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173';
const ENFORCE_IP_LIMIT = process.env.ENFORCE_IP_LIMIT === 'true';

// Paleta moderna estilo Discord / SyncPlay para avatares gerados proceduralmente
const DISCORD_AVATAR_GRADIENTS = [
  'bg-gradient-to-tr from-[#5865F2] to-[#7983F5]', // Blurple Discord
  'bg-gradient-to-tr from-[#6366f1] to-[#a855f7]', // Roxo / Índigo
  'bg-gradient-to-tr from-[#06b6d4] to-[#3b82f6]', // Ciano / Azul
  'bg-gradient-to-tr from-[#ec4899] to-[#f43f5e]', // Rosa / Cereja
  'bg-gradient-to-tr from-[#10b981] to-[#14b8a6]', // Esmeralda / Teal
  'bg-gradient-to-tr from-[#f59e0b] to-[#ea580c]', // Âmbar / Laranja
  'bg-gradient-to-tr from-[#8b5cf6] to-[#ec4899]', // Violeta / Magenta
  'bg-gradient-to-tr from-[#3b82f6] to-[#1d4ed8]', // Azul Royal
];

module.exports = {
  PORT,
  JWT_SECRET,
  CORS_ORIGIN,
  ENFORCE_IP_LIMIT,
  DISCORD_AVATAR_GRADIENTS,
};

