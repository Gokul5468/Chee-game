package com.hcltech.chess.controller;

import com.hcltech.chess.dto.MoveMessage;
import com.hcltech.chess.model.GameRoom;
import com.hcltech.chess.service.GameService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.handler.annotation.SendTo;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.*;

@Controller
@CrossOrigin
public class GameController {

    @Autowired
    private GameService gameService;

    @Autowired
    private SimpMessagingTemplate messagingTemplate;

    @PostMapping("/api/create-room")
    @ResponseBody
    public com.hcltech.chess.dto.JoinResponse createRoom() {
        GameRoom room = gameService.createRoom();
        // Creator automatically joins as White
        return gameService.joinRoom(room.getId());
    }

    @PostMapping("/api/join-room")
    @ResponseBody
    public com.hcltech.chess.dto.JoinResponse joinRoom(@RequestBody com.hcltech.chess.dto.JoinRequest request) {
        com.hcltech.chess.dto.JoinResponse response = gameService.joinRoom(request.getRoomId());

        // Broadcast Player Joined Event to wake up the room
        com.hcltech.chess.dto.MoveMessage joinMsg = new com.hcltech.chess.dto.MoveMessage();
        joinMsg.setRoomId(request.getRoomId());
        joinMsg.setFen("PLAYER_JOINED"); // Hacky signal using existing DTO to save time
        messagingTemplate.convertAndSend("/topic/room/" + request.getRoomId(), joinMsg);

        return response;
    }

    @GetMapping("/")
    @ResponseBody
    public String index() {
        return "Chess Game Server is running! Please open the Frontend application to play.";
    }

    @MessageMapping("/move")
    public void handleMove(@Payload MoveMessage move) {
        GameRoom room = gameService.getRoom(move.getRoomId());
        if (room != null) {
            // Update internal board state
            try {
                // Simple FEN update for now since chesslib move parsing can be complex with SAN
                // Ideally we parse FROM/TO. For this quick fix, we trust the client's FEN but
                // we SHOULD validate.
                // room.getBoard().loadFromFen(move.getFen()); <-- If client sends FEN

                // Better: Parse Move
                com.github.bhlangonijr.chesslib.move.Move libMove = new com.github.bhlangonijr.chesslib.move.Move(
                        com.github.bhlangonijr.chesslib.Square.fromValue(move.getFrom().toUpperCase()),
                        com.github.bhlangonijr.chesslib.Square.fromValue(move.getTo().toUpperCase()));
                // Check promotion
                if (move.getPromotion() != null && !move.getPromotion().isEmpty()) {
                    // libMove = new Move(from, to, promotion_piece)
                    // Keeping it simple for now, just sync timers. State validation is next step.
                }

                room.getBoard().loadFromFen(move.getFen()); // Trust client FEN for sync for now

                // Timer Logic
                long now = System.currentTimeMillis();
                if (room.getLastMoveTime() > 0) {
                    long timeElapsedSeconds = (now - room.getLastMoveTime()) / 1000;
                    // If it WAS White's turn (before this move), subtract from White
                    // But we just applied the move, so now it is Black's turn.
                    // So we need to know whose turn it WAS.
                    // A cleaner way: Updates timers based on who just moved.
                    // Since we trust client FEN, we can assume the turn switched.
                    if (room.getBoard().getSideToMove() == com.github.bhlangonijr.chesslib.Side.BLACK) {
                        // It IS Black's turn now, implies White just moved.
                        room.setWhiteTimeRemaining(Math.max(0, room.getWhiteTimeRemaining() - timeElapsedSeconds));
                    } else {
                        room.setBlackTimeRemaining(Math.max(0, room.getBlackTimeRemaining() - timeElapsedSeconds));
                    }
                } else {
                    // First move, Initialize timers
                    room.setWhiteTimeRemaining(600);
                    room.setBlackTimeRemaining(600);
                }
                room.setLastMoveTime(now);

            } catch (Exception e) {
                e.printStackTrace();
            }

            // Broadcast to all subscribers
            messagingTemplate.convertAndSend("/topic/room/" + move.getRoomId(), move);
        }
    }
}
