package com.hcltech.chess.dto;

import lombok.Data;

@Data
public class MoveMessage {
    private String roomId;
    private String from;
    private String to;
    private String promotion;
    private String fen; // Current board state
    private long whiteTime;
    private long blackTime;
}
