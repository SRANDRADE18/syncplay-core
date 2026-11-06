/**
 * Gerenciador de Estado em Memória para Sessões Soft Real-Time
 * roomsState: {
 *   [roomId]: {
 *     hostSocketId,
 *     hostToken,
 *     isPlaying,
 *     lastTimestamp,
 *     lastUpdated,
 *     hostTimeout,
 *     videoUrl,
 *     roomName,
 *     messages: [],
 *     participants: {}
 *   }
 * }
 * socketRoomMap: { [socketId]: roomId }
 */
const roomsState = {};
const socketRoomMap = {};

module.exports = {
  roomsState,
  socketRoomMap,
};

