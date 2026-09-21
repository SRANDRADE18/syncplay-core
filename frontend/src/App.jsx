import { useEffect, useState } from 'react'
import { socket } from './services/socket'
import './index.css'

function App() {
  const [isConnected, setIsConnected] = useState(socket.connected);

  useEffect(() => {
    function onConnect() {
      setIsConnected(true);
    }

    function onDisconnect() {
      setIsConnected(false);
    }

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
    };
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
      <div className="text-center p-8 bg-gray-800 rounded-xl shadow-lg border border-gray-700">
        <h1 className="text-3xl font-bold mb-4 text-purple-400">SyncPlay Core</h1>
        <p className="text-gray-300 mb-6">A infraestrutura base está inicializada.</p>
        
        <div className="flex items-center justify-center space-x-2">
          <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
          <span className="font-mono text-sm text-gray-400">
            Socket.io: {isConnected ? 'Conectado' : 'Desconectado'}
          </span>
        </div>
      </div>
    </div>
  )
}

export default App
