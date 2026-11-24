const express = require('express');
const router = express.Router();
const roomController = require('../controllers/roomController');
const { authenticateToken } = require('../middlewares/auth');

// Todas as rotas de gerenciamento de salas exigem token JWT
router.use(authenticateToken);

router.get('/', roomController.listRooms);
router.post('/', roomController.createRoom);
router.get('/:id', roomController.getRoomById);
router.post('/:id/sync', roomController.syncRoomState);
router.post('/:id/messages', roomController.postRoomMessage);
router.post('/:id/messages/:messageId/react', roomController.toggleMessageReaction);
router.delete('/:id/messages/:messageId', roomController.deleteRoomMessage);
router.post('/:id/leave', roomController.leaveRoom);
router.delete('/:id', roomController.deleteRoom);

module.exports = router;

