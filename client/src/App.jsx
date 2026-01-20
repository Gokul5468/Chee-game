import React, { useState } from 'react'
import ChessGame from './components/ChessGame'
import Lobby from './components/Lobby'
import Login from './components/Login'

function App() {
    const [user, setUser] = useState(null)
    const [gameData, setGameData] = useState(null) // { roomId, color, playerId }

    if (!user) {
        return <Login onLogin={setUser} />
    }

    return (
        <div className="h-full w-full bg-slate-900 text-white">
            {gameData ? (
                <ChessGame
                    roomId={gameData.roomId}
                    myColor={gameData.color}
                    myPlayerId={gameData.playerId}
                    isBotGame={gameData.isBotGame}
                    onLeave={() => setGameData(null)}
                />
            ) : (
                <div className="flex flex-col items-center justify-center min-h-screen">
                    <div className="absolute top-4 right-4 flex items-center gap-2">
                        {user.photoURL && <img src={user.photoURL} className="w-8 h-8 rounded-full" />}
                        <span>{user.displayName}</span>
                        <button onClick={() => setUser(null)} className="text-xs text-red-400 underline ml-2">Sign Out</button>
                    </div>
                    <h1 className="text-4xl font-bold mb-8 text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500">
                        Multiplayer Chess
                    </h1>
                    <Lobby onJoinGame={setGameData} />
                </div>
            )}
        </div>
    )
}

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error("Uncaught error:", error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="flex flex-col items-center justify-center min-h-screen text-red-500 bg-slate-900 p-4">
                    <h1 className="text-2xl font-bold mb-4">Something went wrong</h1>
                    <pre className="bg-black p-4 rounded border border-red-500/50 max-w-full overflow-auto text-left">
                        {this.state.error && this.state.error.toString()}
                    </pre>
                    <button
                        onClick={() => window.location.reload()}
                        className="mt-6 bg-slate-700 text-white px-4 py-2 rounded hover:bg-slate-600"
                    >
                        Reload Page
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}

// Wrap export
export default function WrappedApp() {
    return (
        <ErrorBoundary>
            <App />
        </ErrorBoundary>
    )
}
