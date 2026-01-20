package com.hcltech.chess.model;

import com.github.bhlangonijr.chesslib.Board;
import lombok.Data;
import java.util.UUID;

@Data
public class GameRoom {
    private String id;
    private Board board;
    private String whitePlayerId;
    private String blackPlayerId;
    private long whiteTimeRemaining;
    private long blackTimeRemaining;
    private long lastMoveTime;

    public GameRoom() {
        this.id = UUID.randomUUID().toString();
        this.board = new Board();
    }
}
