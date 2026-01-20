package com.hcltech.chess.service;

import com.hcltech.chess.model.GameRoom;
import org.springframework.stereotype.Service;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class GameService {
    private final Map<String, GameRoom> rooms = new ConcurrentHashMap<>();

    public GameRoom createRoom() {
        GameRoom room = new GameRoom();
        rooms.put(room.getId(), room);
        return room;
    }

    public GameRoom getRoom(String roomId) {
        return rooms.get(roomId);
    }

    public synchronized com.hcltech.chess.dto.JoinResponse joinRoom(String roomId) {
        GameRoom room = rooms.get(roomId);
        if (room == null) {
            throw new IllegalArgumentException("Room not found");
        }

        String playerId = java.util.UUID.randomUUID().toString();
        String color = "spectator";

        if (room.getWhitePlayerId() == null) {
            room.setWhitePlayerId(playerId);
            color = "white";
        } else if (room.getBlackPlayerId() == null) {
            room.setBlackPlayerId(playerId);
            color = "black";
        }

        return new com.hcltech.chess.dto.JoinResponse(
                roomId,
                playerId,
                color,
                room.getBoard().getFen(),
                room.getWhiteTimeRemaining() == 0 ? 600 : room.getWhiteTimeRemaining(),
                room.getBlackTimeRemaining() == 0 ? 600 : room.getBlackTimeRemaining());
    }
}
