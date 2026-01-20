package com.hcltech.chess.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class JoinResponse {
    private String roomId;
    private String playerId;
    private String color; // "white" or "black" or "spectator"
    private String fen;
    private long whiteTime;
    private long blackTime;
}
