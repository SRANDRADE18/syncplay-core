const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

describe('Sync Engine - Lógica de Sincronização Soft Real-Time', () => {
  const DRIFT_TOLERANCE_SECONDS = 1.5;

  function shouldSeek(localTime, incomingTime) {
    const drift = Math.abs(localTime - incomingTime);
    return drift > DRIFT_TOLERANCE_SECONDS;
  }

  function calculateLateJoinerTime(state, now) {
    let currentEstimated = state.lastTimestamp;
    if (state.isPlaying) {
      const elapsedSeconds = (now - state.lastUpdated) / 1000;
      currentEstimated += elapsedSeconds;
    }
    return currentEstimated;
  }

  test('não deve aplicar seek se o desvio (drift) for menor ou igual à tolerância (<= 1.5s)', () => {
    assert.equal(shouldSeek(10.0, 10.8), false, 'Drift de 0.8s não deve disparar seek');
    assert.equal(shouldSeek(10.0, 11.5), false, 'Drift de 1.5s não deve disparar seek');
    assert.equal(shouldSeek(10.0, 8.7), false, 'Drift de 1.3s não deve disparar seek');
  });

  test('deve aplicar seek se o desvio (drift) for maior que 1.5 segundos', () => {
    assert.equal(shouldSeek(10.0, 11.6), true, 'Drift de 1.6s deve disparar seek');
    assert.equal(shouldSeek(10.0, 25.0), true, 'Drift de 15.0s deve disparar seek');
    assert.equal(shouldSeek(30.0, 5.0), true, 'Retrocesso de 25s deve disparar seek');
  });

  test('deve estimar o tempo correto para Late Joiner com reprodução ativa', () => {
    const lastUpdated = 1000000;
    const now = 1005000; // 5 segundos depois
    const state = {
      isPlaying: true,
      lastTimestamp: 42,
      lastUpdated,
    };

    const estimated = calculateLateJoinerTime(state, now);
    assert.equal(estimated, 47, 'Deve avançar exatamente 5 segundos');
  });

  test('deve manter o timestamp estático para Late Joiner quando o vídeo estiver pausado', () => {
    const lastUpdated = 1000000;
    const now = 1020000; // 20 segundos depois
    const state = {
      isPlaying: false,
      lastTimestamp: 50,
      lastUpdated,
    };

    const estimated = calculateLateJoinerTime(state, now);
    assert.equal(estimated, 50, 'Vídeo pausado não deve ter avanço de tempo');
  });
});

