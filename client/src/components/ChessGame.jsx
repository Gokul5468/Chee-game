import { useState, useRef, useEffect } from "react";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";
import { useSocket } from "../hooks/useSocket";
import Timer from "./Timer";

export default function ChessGame({
    roomId,
    myColor,
    myPlayerId,
    isBotGame,
    initialFen,
    initialWhiteTime,
    initialBlackTime,
    onLeave
}) {
    // Persistent game reference to maintain logic state
    // initialFen might be "start" (from default props) or undefined. 
    // new Chess() takes optional FEN. If "start" is passed, it errors.
    const gameRef = useRef(new Chess((initialFen && initialFen !== "start") ? initialFen : undefined));

    // UI State
    const [fen, setFen] = useState(gameRef.current.fen());
    const [moveHistory, setMoveHistory] = useState([]); // Manual history
    const [moveFrom, setMoveFrom] = useState("");
    const [optionSquares, setOptionSquares] = useState({});
    const [boardOrientation, setBoardOrientation] = useState(myColor === 'black' ? 'black' : 'white');

    // Timer Sync State
    const [whiteTimer, setWhiteTimer] = useState(initialWhiteTime || 600);
    const [blackTimer, setBlackTimer] = useState(initialBlackTime || 600);

    // Opponent Presence State
    // Bot Game -> Always true
    // Black Player -> Always true (since White created it)
    // White Player -> True ONLY if game progressed (timers changed or history exists) or manually set via socket
    const [hasOpponent, setHasOpponent] = useState(isBotGame || myColor === 'black' || (initialWhiteTime < 600 || initialBlackTime < 600));



    // Modal UI State
    const [showMenu, setShowMenu] = useState(false);
    const [showHelp, setShowHelp] = useState(false);

    // Game Over / Status State
    const [showGameOverModal, setShowGameOverModal] = useState(false);
    const [isGameFinished, setIsGameFinished] = useState(false);
    const [gameStatus, setGameStatus] = useState("");

    // Promotion State
    const [showPromotionDialog, setShowPromotionDialog] = useState(false);
    const [pendingPromotionMove, setPendingPromotionMove] = useState(null);

    // Bot Start State
    const [botStarted, setBotStarted] = useState(false);

    // Bot Move Logic
    useEffect(() => {
        if (!isBotGame || isGameFinished || !botStarted) return;

        const game = gameRef.current;
        // If myColor is white, I am 'w'. Bot is 'b'.
        // If it is NOT my turn, it must be Bot's turn.
        const myTurn = myColor === 'white' ? 'w' : 'b';

        if (game.turn() !== myTurn) {
            const timer = setTimeout(() => {
                if (isGameFinished) return;

                try {
                    const moves = game.moves();
                    if (moves.length > 0) {
                        const randomMove = moves[Math.floor(Math.random() * moves.length)];
                        const result = game.move(randomMove);
                        if (result) {
                            updateGameState(result);
                        }
                    }
                } catch (error) {
                    console.error("Bot Move Error:", error);
                }
            }, 500);
            return () => clearTimeout(timer);
        }
    }, [fen, isBotGame, isGameFinished, myColor, botStarted]);

    // --- Helpers ---

    const updateCheckHighlight = (squares = {}) => {
        const game = gameRef.current;
        if (game.inCheck()) {
            const board = game.board();
            for (let i = 0; i < 8; i++) {
                for (let j = 0; j < 8; j++) {
                    const piece = board[i][j];
                    if (piece && piece.type === 'k' && piece.color === game.turn()) {
                        const square = String.fromCharCode(97 + j) + (8 - i);
                        squares[square] = {
                            background: "radial-gradient(circle, rgba(255,0,0,.5) 50%, transparent 50%)",
                            pointerEvents: 'none',
                        };
                    }
                }
            }
        }
        return squares;
    };

    const checkGameStatus = () => {
        const game = gameRef.current;
        if (game.isCheckmate()) {
            setIsGameFinished(true);
            setShowGameOverModal(true);
            // If turn is White, it means White is checkmated -> Black Wins.
            // If turn is Black, it means Black is checkmated -> White Wins.
            const winnerColor = game.turn() === 'w' ? 'black' : 'white';
            const winnerName = winnerColor === 'white' ? 'White' : 'Black';

            if (myColor === winnerColor) {
                setGameStatus(`You Won! (${winnerName})`);
            } else {
                setGameStatus(`You Lost (${winnerName} Wins)`);
            }
        } else if (game.isDraw()) {
            setIsGameFinished(true);
            setShowGameOverModal(true);
            setGameStatus("Draw");
        } else if (game.isGameOver()) {
            setIsGameFinished(true);
            setShowGameOverModal(true);
            setGameStatus("Game Over");
        }
    };

    const updateGameState = (newMove = null) => {
        setFen(gameRef.current.fen());

        if (newMove) {
            setMoveHistory(prev => [...prev, newMove]);
        }

        checkGameStatus();
        setOptionSquares(updateCheckHighlight({}));
    };

    // --- Socket Handler ---

    const onMoveReceived = (moveData) => {
        // Handle "Player Joined" Signal
        if (moveData.fen === "PLAYER_JOINED") {
            setHasOpponent(true);
            return;
        }

        // Handle Game End Signals
        if (moveData.fen === "RESIGN") {
            setIsGameFinished(true);
            setShowGameOverModal(true);
            const winner = moveData.from === 'white' ? 'Black' : 'White';
            // If opponent resigned (moveData.from is opponent's color), YOU win.
            setGameStatus(moveData.from !== myColor ? "You Won! (Opponent Resigned)" : "You Resigned");
            return;
        }

        if (moveData.fen === "DRAW") {
            setIsGameFinished(true);
            setShowGameOverModal(true);
            setGameStatus("Game Ended (Draw)");
            return;
        }

        const game = gameRef.current;

        // Update Timers if provided
        if (moveData.whiteTime) setWhiteTimer(moveData.whiteTime);
        if (moveData.blackTime) setBlackTimer(moveData.blackTime);

        // Echo Check using manual history
        if (moveHistory.length > 0) {
            const lastMove = moveHistory[moveHistory.length - 1];
            if (lastMove.from === moveData.from && lastMove.to === moveData.to) {
                // Just sync timers (already done above)
                return;
            }
        }

        try {
            const result = game.move({
                from: moveData.from,
                to: moveData.to,
                promotion: moveData.promotion || "q",
            });
            if (result) {
                updateGameState(result);
                // Sync Timers Logic to be added via state
            }
        } catch (e) {
            console.warn("Invalid move received (syncing from FEN):", e);
            if (moveData.fen) {
                game.load(moveData.fen);
                setFen(moveData.fen);
                checkGameStatus();
            }
        }
    };

    const { connected, sendMove } = useSocket(isBotGame ? null : roomId, onMoveReceived);

    // --- Game Interaction ---

    function getMoveOptions(square) {
        if (isGameFinished) return false;
        const game = gameRef.current;

        // Validation for Online Game Start
        if (!isBotGame && game.history().length === 0 && myColor === 'white') {
            // Ideally we check if opponent joined. For now, we unfortunately don't know for sure without more backend headers.
            // But the user requested "start a game when someone joins".
            // Since we can't easily know yet, I will skip this block and focus on the Bot fix first.
            // I will implement a visual "Waiting for Opponent" in the render instead.
        }

        const moves = game.moves({
            square,
            verbose: true,
        });

        if (moves.length === 0) {
            setOptionSquares(updateCheckHighlight({}));
            return false;
        }

        const newSquares = {};
        moves.map((move) => {
            newSquares[move.to] = {
                background:
                    game.get(move.to) && game.get(move.to).color !== game.get(square).color
                        ? "radial-gradient(circle, rgba(0,0,0,.1) 85%, transparent 85%)"
                        : "radial-gradient(circle, rgba(0,0,0,.1) 25%, transparent 25%)",
                borderRadius: "50%",
                pointerEvents: 'none',
            };
            return move;
        });

        newSquares[square] = {
            background: "rgba(255, 255, 0, 0.4)",
            pointerEvents: 'none',
        };

        updateCheckHighlight(newSquares);
        setOptionSquares(newSquares);
        return true;
    }

    function makeAMove(move) {
        if (isGameFinished) return null;
        const game = gameRef.current;

        // Promotion Check
        if (!move.promotion) {
            const piece = game.get(move.from);
            if (piece?.type === 'p') {
                if ((piece.color === 'w' && move.to[1] === '8') || (piece.color === 'b' && move.to[1] === '1')) {
                    setPendingPromotionMove(move);
                    setShowPromotionDialog(true);
                    return null;
                }
            }
        }

        try {
            const result = game.move(move);
            if (result) {
                updateGameState(result);
                return result;
            }
            return null;
        } catch (e) {
            console.error("Move error:", e);
            return null;
        }
    }

    function onPromotionSelect(piece) {
        if (pendingPromotionMove) {
            const result = makeAMove({ ...pendingPromotionMove, promotion: piece });
            if (result) {
                sendMove({
                    roomId,
                    from: result.from,
                    to: result.to,
                    promotion: result.promotion,
                    fen: gameRef.current.fen()
                });
            }
            setShowPromotionDialog(false);
            setPendingPromotionMove(null);
            setMoveFrom("");
        }
    }

    function onSquareClick(square) {
        if (isGameFinished) return;
        const game = gameRef.current;

        // Prevent moving opponent pieces
        if (game.turn() !== (myColor && myColor.startsWith('w') ? 'w' : 'b')) return;

        if (moveFrom === square) {
            setMoveFrom("");
            setOptionSquares(updateCheckHighlight({}));
            return;
        }

        if (moveFrom) {
            const move = { from: moveFrom, to: square };
            const result = makeAMove(move);
            if (result) {
                setMoveFrom("");
                sendMove({
                    roomId,
                    from: result.from,
                    to: result.to,
                    promotion: result.promotion,
                    fen: gameRef.current.fen()
                });
                return;
            }
        }

        const piece = game.get(square);
        if (piece && piece.color === game.turn()) {
            setMoveFrom(square);
            getMoveOptions(square);
            return;
        }

        setMoveFrom("");
        setOptionSquares(updateCheckHighlight({}));
    }

    function onDrop(sourceSquare, targetSquare) {
        if (isGameFinished) return false;

        // Prevent moving opponent pieces
        const game = gameRef.current;
        if (game.turn() !== (myColor && myColor.startsWith('w') ? 'w' : 'b')) return false;

        const move = { from: sourceSquare, to: targetSquare };
        const result = makeAMove(move);
        if (result) {
            setMoveFrom("");
            sendMove({
                roomId,
                from: result.from,
                to: result.to,
                promotion: result.promotion,
                fen: gameRef.current.fen()
            });
            return true;
        }
        return false;
    }

    const handleResign = () => {
        setIsGameFinished(true);
        setShowGameOverModal(true);
        setGameStatus("You Resigned");
        // Broadcast Resign
        if (connected) {
            sendMove({
                roomId,
                fen: "RESIGN",
                from: myColor // Send who resigned
            });
        }
    };

    const handleDraw = () => {
        setIsGameFinished(true);
        setShowGameOverModal(true);
        setGameStatus("Game Ended (Draw)");
        // Broadcast Draw
        if (connected) {
            sendMove({
                roomId,
                fen: "DRAW",
                from: myColor // Send who offered draw
            });
        }
    };

    // --- Components ---

    const PromotionDialog = () => {
        if (!showPromotionDialog) return null;
        return (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                <div className="bg-slate-800 p-4 rounded shadow-2xl border border-slate-600">
                    <h3 className="text-center text-white font-bold mb-4">Choose Promotion</h3>
                    <div className="flex gap-4">
                        {['q', 'r', 'b', 'n'].map(p => (
                            <button
                                key={p}
                                onClick={() => onPromotionSelect(p)}
                                className="w-12 h-12 bg-slate-700 hover:bg-slate-600 rounded flex items-center justify-center text-2xl"
                            >
                                <img
                                    src={`https://images.chesscomfiles.com/chess-themes/pieces/neo/150/${gameRef.current.turn()}${p}.png`}
                                    alt={p}
                                    className="w-10 h-10"
                                    onError={(e) => e.target.style.display = 'none'}
                                />
                                <span className={gameRef.current.turn() === 'w' ? "text-white" : "text-black"}>
                                    {p === 'q' ? '♕' : p === 'r' ? '♖' : p === 'b' ? '♗' : '♘'}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        );
    };

    const GameOverDialog = () => {
        if (!showGameOverModal) return null;
        return (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
                <div className="bg-slate-900 border border-slate-500 p-8 rounded-lg shadow-2xl flex flex-col items-center">
                    <h2 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-red-500 mb-4">{gameStatus}</h2>
                    <div className="flex gap-4 mt-4">
                        <button onClick={onLeave} className="bg-blue-600 hover:bg-blue-500 px-6 py-2 rounded font-bold transition-colors">New Game</button>
                        <button onClick={() => setShowGameOverModal(false)} className="bg-slate-700 hover:bg-slate-600 px-6 py-2 rounded text-slate-300">Close View</button>
                    </div>
                </div>
            </div>
        );
    };

    const HelpModal = () => {
        if (!showHelp) return null;
        return (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowHelp(false)}>
                <div className="bg-slate-800 p-6 rounded-lg shadow-2xl border border-slate-600 max-w-md w-full m-4" onClick={e => e.stopPropagation()}>
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-xl font-bold text-white">How to Play</h3>
                        <button onClick={() => setShowHelp(false)} className="text-slate-400 hover:text-white">✕</button>
                    </div>
                    <div className="text-slate-300 space-y-3 text-sm">
                        <p>1. <span className="text-white font-semibold">Move:</span> Click a piece to see valid moves (dots), then click a target square.</p>
                        <p>2. <span className="text-white font-semibold">Victory:</span> Checkmate your opponent's king.</p>
                        <p>3. <span className="text-white font-semibold">Draw:</span> Stalemate, Repetition, or Mutual Agreement.</p>
                        <p>4. <span className="text-white font-semibold">Promotion:</span> Pawns promote to Queen, Rook, Bishop, or Knight upon reaching the end.</p>
                        <div className="bg-slate-700/50 p-3 rounded mt-4">
                            <h4 className="font-semibold text-white mb-2">Controls</h4>
                            <ul className="list-disc pl-4 space-y-1">
                                <li>Click piece to select</li>
                                <li>Click dot to move</li>
                                <li>Click "Flip Board" in Menu to rotate</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    // --- Render ---

    return (
        <div className="flex-1 flex h-full w-full bg-slate-900 overflow-hidden relative" onClick={() => setShowMenu(false)}>
            <PromotionDialog />
            <GameOverDialog />
            <HelpModal />

            {/* Sidebar Inlined */}
            <div className="w-16 md:w-20 bg-slate-900 border-r border-slate-700 flex flex-col items-center py-6 gap-8 hidden md:flex">
                <div
                    className="text-blue-500 font-bold text-2xl mb-4 cursor-pointer hover:scale-110 transition-transform"
                    onClick={onLeave}
                    title="Home"
                >
                    ♔
                </div>
                <div className="flex flex-col gap-6 w-full">
                    <button className="flex flex-col items-center gap-1 text-blue-400 p-2 border-l-2 border-blue-400 bg-slate-800/50 w-full">
                        <span className="text-xl">♟</span>
                        <span className="text-[10px] font-medium">Play</span>
                    </button>
                    <div className="relative w-full flex justify-center">
                        <button
                            className="flex flex-col items-center gap-1 text-slate-400 hover:text-white transition-colors w-full"
                            onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
                        >
                            <span className="text-xl">☰</span>
                            <span className="text-[10px]">Menu</span>
                        </button>
                        {showMenu && (
                            <div className="absolute left-14 top-0 bg-slate-800 border border-slate-600 rounded shadow-xl w-40 py-2 z-50 text-left">
                                <button
                                    className={`w-full text-left px-4 py-2 text-sm ${moveHistory.length > 0 ? 'text-slate-500 cursor-not-allowed' : 'text-slate-300 hover:bg-slate-700 hover:text-white'}`}
                                    onClick={() => {
                                        if (moveHistory.length > 0) {
                                            alert("You cannot flip the board once the game has started.");
                                            return;
                                        }
                                        setBoardOrientation(prev => prev === 'white' ? 'black' : 'white');
                                        setShowMenu(false);
                                    }}
                                >
                                    Flip Board {moveHistory.length > 0 && "(Locked)"}
                                </button>
                                <button
                                    className={`w-full text-left px-4 py-2 text-sm ${isGameFinished ? 'text-slate-500 cursor-not-allowed' : 'text-slate-300 hover:bg-slate-700 hover:text-white'}`}
                                    onClick={() => { if (!isGameFinished) { handleResign(); setShowMenu(false); } }}
                                    disabled={isGameFinished}
                                >
                                    Resign Game
                                </button>
                            </div>
                        )}
                    </div>
                </div>
                <div className="mt-auto">
                    <button
                        className="flex flex-col items-center gap-1 text-slate-400 hover:text-white transition-colors"
                        onClick={() => setShowHelp(true)}
                    >
                        <span className="text-xl">?</span>
                        <span className="text-[10px]">Help</span>
                    </button>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-grow flex flex-col h-full bg-slate-900 relative">
                <div className="absolute top-0 left-0 w-full p-2 pl-4 z-10 flex justify-between items-center hidden md:flex pointer-events-none">
                    <h1 className="text-slate-500 text-xs pointer-events-auto">Guest Mode</h1>
                    {roomId && (
                        <div className="bg-slate-800/80 text-slate-300 px-3 py-1 rounded-full text-xs border border-slate-600 pointer-events-auto flex items-center gap-2 mr-4">
                            <span>Room: <span className="text-white font-mono select-all">{roomId}</span></span>
                            <button
                                onClick={() => navigator.clipboard.writeText(roomId)}
                                className="text-blue-400 hover:text-blue-300"
                                title="Copy Room ID"
                            >
                                📋
                            </button>
                        </div>
                    )}
                </div>

                <div className="flex-grow flex items-center justify-center p-2">
                    <div className="flex flex-col gap-1 w-full max-w-[60vh] h-full justify-center">
                        <div className="flex justify-between items-center bg-slate-800 text-slate-200 px-3 py-2 rounded-t-md shadow-sm">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded bg-slate-600 flex items-center justify-center text-xs">OP</div>
                                <div className="flex flex-col leading-none">
                                    <span className="font-semibold text-sm">Opponent</span>
                                </div>
                            </div>
                            <Timer
                                initialTime={myColor === 'white' ? blackTimer : whiteTimer}
                                active={(isBotGame ? botStarted : hasOpponent) && gameRef.current.turn() === (myColor === 'white' ? 'b' : 'w') && !isGameFinished}
                                onTimeout={() => { /* Handle timeout */ }}
                            />
                        </div>

                        <div className="flex-grow flex items-center justify-center bg-slate-800/50 shadow-2xl overflow-hidden p-1 relative">
                            <div className="h-full w-full max-h-[60vh] aspect-square">
                                <Chessboard
                                    position={fen}
                                    onPieceDrop={(s, t) => {
                                        if (isBotGame && !botStarted) return false;
                                        return onDrop(s, t);
                                    }}
                                    onSquareClick={(s) => {
                                        if (isBotGame && !botStarted) return;
                                        onSquareClick(s);
                                    }}
                                    customSquareStyles={optionSquares}
                                    boardOrientation={boardOrientation}
                                    id="BasicBoard"
                                    animationDuration={200}
                                />
                            </div>

                            {/* Bot Start Overlay */}
                            {isBotGame && !botStarted && !isGameFinished && (
                                <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center text-white z-10 p-4 text-center backdrop-blur-sm">
                                    <div className="text-6xl mb-4">🤖</div>
                                    <h3 className="text-2xl font-bold mb-4">Play vs Bot</h3>
                                    <button
                                        onClick={() => setBotStarted(true)}
                                        className="bg-green-600 hover:bg-green-500 text-white font-bold py-3 px-8 rounded-full text-xl shadow-lg transform hover:scale-105 transition-all"
                                    >
                                        Start Game
                                    </button>
                                </div>
                            )}

                            {/* Waiting for Opponent Overlay */}
                            {!hasOpponent && !isBotGame && (
                                <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center text-white z-10 p-4 text-center backdrop-blur-sm">
                                    <div className="animate-spin text-4xl mb-4">⏳</div>
                                    <h3 className="text-xl font-bold mb-2">Waiting for Opponent</h3>
                                    <p className="text-sm text-slate-300 mb-4">Share the Room ID to start!</p>
                                    <div className="bg-slate-800 px-4 py-2 rounded flex items-center gap-2 border border-slate-600">
                                        <span className="font-mono select-all font-bold text-blue-400">{roomId}</span>
                                        <button
                                            onClick={() => navigator.clipboard.writeText(roomId)}
                                            className="text-slate-400 hover:text-white"
                                            title="Copy"
                                        >
                                            📋
                                        </button>
                                    </div>
                                    <p className="text-xs text-slate-400 mt-4 max-w-xs">
                                        The game will start automatically when they join.
                                    </p>
                                </div>
                            )}
                        </div>

                        <div className="flex justify-between items-center bg-slate-800 text-slate-200 px-3 py-2 rounded-b-md shadow-sm">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded bg-blue-600 flex items-center justify-center text-xs text-white">ME</div>
                                <div className="flex flex-col leading-none">
                                    <span className="font-semibold text-sm">You</span>
                                </div>
                            </div>
                            <Timer
                                initialTime={myColor === 'white' ? whiteTimer : blackTimer}
                                active={hasOpponent && gameRef.current.turn() === (myColor === 'white' ? 'w' : 'b') && !isGameFinished}
                                onTimeout={() => { /* Handle timeout */ }}
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Right Panel Inlined */}
            <div className="w-full md:w-80 bg-slate-800 flex flex-col h-full border-l border-slate-700">
                <div className="flex bg-slate-900 text-sm">
                    <button className="flex-1 py-3 text-white bg-slate-700 font-medium">Moves</button>
                    <button className="flex-1 py-3 text-slate-400 hover:bg-slate-800 hover:text-white" onClick={onLeave}>Quit</button>
                </div>
                {/* Bottom Actions */}
                <div className="p-4 border-t border-slate-700 flex gap-2">
                    <button
                        className={`flex-1 font-bold py-2 rounded shadow-lg text-xs transition-transform active:scale-95 ${isGameFinished ? 'bg-slate-700 text-slate-500 cursor-not-allowed' : 'bg-red-600 hover:bg-red-500 text-white'}`}
                        onClick={handleResign}
                        disabled={isGameFinished}
                    >
                        Resign
                    </button>
                    <button
                        className={`flex-1 font-bold py-2 rounded shadow-lg text-xs transition-transform active:scale-95 ${isGameFinished ? 'bg-slate-700 text-slate-500 cursor-not-allowed' : 'bg-green-600 hover:bg-green-500 text-white'}`}
                        onClick={handleDraw}
                        disabled={isGameFinished}
                    >
                        Draw
                    </button>
                    <button className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 rounded shadow-lg transition-transform active:scale-95 text-xs" onClick={onLeave}>New Game</button>
                </div>
                <div className="flex-grow p-4 bg-slate-800 flex flex-col items-center">
                    <div className="bg-white/10 w-full h-full rounded-lg p-2 flex flex-col">
                        <h3 className="text-slate-300 font-bold mb-2 text-center border-b border-slate-600 pb-1">History</h3>
                        <div className="overflow-y-auto flex-grow text-sm font-mono custom-scrollbar">
                            <table className="w-full text-left">
                                <thead className="text-xs text-slate-500 border-b border-slate-600">
                                    <tr>
                                        <th className="py-2 pl-2 w-8">#</th>
                                        <th className="py-2 pl-2">White</th>
                                        <th className="py-2 pl-2">Black</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(() => {
                                        // Debug rendering
                                        console.log("Rendering History:", moveHistory.length, moveHistory);
                                        const rows = [];
                                        for (let i = 0; i < moveHistory.length; i += 2) {
                                            rows.push(
                                                <tr key={i} className={`border-b border-slate-700/30 ${Math.floor(i / 2) % 2 === 0 ? 'bg-white/5' : ''}`}>
                                                    <td className="py-1 pl-2 text-slate-400 w-8">{(i / 2) + 1}.</td>
                                                    <td className="py-1 text-white font-medium pl-2">{moveHistory[i]?.san || `${moveHistory[i]?.from}-${moveHistory[i]?.to}`}</td>
                                                    {moveHistory[i + 1] ? (
                                                        <td className="py-1 text-slate-300 pl-2">{moveHistory[i + 1]?.san || `${moveHistory[i + 1]?.from}-${moveHistory[i + 1]?.to}`}</td>
                                                    ) : (
                                                        <td className="py-1 text-slate-300 pl-2"></td>
                                                    )}
                                                </tr>
                                            );
                                        }
                                        return rows;
                                    })()}
                                </tbody>
                            </table>
                            {moveHistory.length === 0 && (
                                <div className="text-center text-slate-500 mt-10 italic text-xs">No moves yet</div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {!connected && !isBotGame && (
                <div className="absolute bottom-4 right-4 bg-red-900/80 text-white px-3 py-1 rounded text-xs animate-pulse z-40">
                    ⚠ Disconnected
                </div>
            )}
        </div>
    );
}
