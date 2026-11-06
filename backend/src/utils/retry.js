const fs = require('fs');
const path = require('path');

const logFilePath = path.join(__dirname, '..', '..', 'dead_letter.log');

/**
 * Utilitário de Retry com logging de Dead Letter
 * @param {Function} fn - Função assíncrona a ser executada
 * @param {number} retries - Número máximo de tentativas
 * @param {number} delayMs - Intervalo entre tentativas em milissegundos
 */
async function withRetry(fn, retries = 3, delayMs = 1000) {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === retries - 1) {
        console.error(`[withRetry] Falha final após ${retries} tentativas:`, error);
        try {
          fs.appendFileSync(logFilePath, `${new Date().toISOString()} - ${error.message}\n`);
        } catch (logErr) {
          console.error('[withRetry] Erro ao gravar dead_letter.log:', logErr);
        }
        return; // Retorna sem throw para não derrubar o Node silenciosamente
      }
      console.warn(`[withRetry] Tentativa ${i + 1} falhou. Tentando em ${delayMs}ms...`);
      await new Promise((res) => setTimeout(res, delayMs));
    }
  }
}

module.exports = { withRetry };

