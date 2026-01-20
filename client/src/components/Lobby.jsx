import { useState } from 'react';

export default function Lobby({ onJoinGame }) {
    const [roomId, setRoomId] = useState('');

    const createRoom = async () => {
        try {
            const response = await fetch('/api/create-room', { method: 'POST' });
            const data = await response.json();
            onJoinGame({
                roomId: data.roomId,
                color: data.color,
                playerId: data.playerId,
                fen: data.fen,
                whiteTime: data.whiteTime,
                blackTime: data.blackTime
            });
        } catch (e) {
            console.error(e);
            alert("Failed to create room. Is backend running?");
            // Fallback for dev without backend
            onJoinGame({ roomId: "demo-room", color: "white", playerId: "demo-p1" });
        }
    };

    const handleJoin = async () => {
        try {
            const response = await fetch('/api/join-room', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ roomId })
            });
            if (!response.ok) throw new Error("Room not found");
            const data = await response.json();
            onJoinGame({
                roomId: data.roomId,
                color: data.color,
                playerId: data.playerId,
                fen: data.fen,
                whiteTime: data.whiteTime,
                blackTime: data.blackTime
            });
        } catch (e) {
            console.error(e);
            alert("Failed to join room. Check ID.");
        }
    };

    const playBot = () => {
        onJoinGame({
            roomId: "local-bot",
            color: "white",
            playerId: "local-player",
            isBotGame: true
        });
    };

    return (
        <div className="bg-slate-800 p-8 rounded-xl shadow-2xl flex flex-col gap-4 text-center">
            <h2 className="text-2xl font-bold mb-4">Play Chess</h2>
            <div className="flex flex-col gap-3">
                <button
                    onClick={createRoom}
                    className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-6 rounded-lg transition-all"
                >
                    Create Online Room
                </button>
                <button
                    onClick={playBot}
                    className="bg-purple-600 hover:bg-purple-500 text-white font-bold py-3 px-6 rounded-lg transition-all"
                >
                    Play vs Bot
                </button>
            </div>
            <div className="flex gap-2 items-center justify-center mt-4">
                <input
                    type="text"
                    placeholder="Enter Room ID"
                    className="bg-slate-700 p-2 rounded text-white"
                    value={roomId}
                    onChange={(e) => setRoomId(e.target.value)}
                />
                <button
                    onClick={handleJoin}
                    className="bg-green-600 hover:bg-green-500 p-2 rounded px-4"
                >
                    Join
                </button>
            </div>
        </div>
    );
}
