import assert from "node:assert/strict";
import {
  applyAction,
  createBoard,
  createDefaultSettings,
  getCurrentBatter,
  getCurrentPitcher
} from "../src/shared/scoringRules.mjs";

const settings = createDefaultSettings();

function run(board, type, payload = {}) {
  const result = applyAction(board, { type, payload }, settings);
  if (result.error) throw new Error(result.error);
  return result.board;
}

{
  let board = createBoard("test");
  board = run(board, "pitch:ball");
  board = run(board, "pitch:ball");
  board = run(board, "count:balls", { delta: 10 });
  assert.equal(board.gameState.balls, 4);
  assert.equal(getCurrentPitcher(board).pitchCount, 2);
}

{
  let board = createBoard("test");
  board = run(board, "runner:toggle", { base: "first" });
  board = run(board, "runner:toggle", { base: "third" });
  board = run(board, "plate:result", { result: "homeRun" });
  assert.equal(board.gameState.score.away, 3);
  assert.equal(board.gameState.runners.first, false);
  assert.equal(board.gameState.runners.third, false);
  assert.equal(board.gameState.overlay.message, "HOME RUN");
}

{
  let board = createBoard("test");
  board = run(board, "outs:adjust", { delta: 3 });
  board = run(board, "inning:change");
  assert.equal(board.gameState.inningHalf, "bottom");
  assert.equal(board.gameState.outs, 0);
}

{
  let board = createBoard("test");
  board = run(board, "abs:adjust", { side: "away", delta: -5 });
  assert.equal(board.gameState.abs.away, 0);
  const afterAbs = board;
  board = run(board, "history:undo");
  assert.equal(board.gameState.abs.away, 2);
  board = run(board, "history:redo");
  assert.equal(board.gameState.abs.away, afterAbs.gameState.abs.away);
}

{
  let board = createBoard("test");
  board = run(board, "score:adjust", { side: "home", delta: 1 });
  board = run(board, "score:adjust", { side: "home", delta: -10 });
  assert.equal(board.gameState.score.home, 0);
}

{
  let board = createBoard("test");
  board = run(board, "board:patchConfig", {
    teams: {
      away: { abbreviationWidth: 10 },
      home: { abbreviationWidth: 999 }
    }
  });
  assert.equal(board.teamSettings.away.abbreviationWidth, 30);
  assert.equal(board.teamSettings.home.abbreviationWidth, 120);
}

{
  let board = createBoard("test");
  board = run(board, "pitch:strike");
  board = run(board, "pitch:foul");
  board = run(board, "pitch:foul");
  assert.equal(board.gameState.strikes, 2);
  assert.equal(getCurrentPitcher(board).pitchCount, 3);
  board = run(board, "count:reset");
  assert.equal(board.gameState.balls, 0);
  assert.equal(board.gameState.strikes, 0);
}

{
  let board = createBoard("test");
  board = run(board, "runner:toggle", { base: "first" });
  board = run(board, "runner:toggle", { base: "second" });
  board = run(board, "runner:toggle", { base: "third" });
  board = run(board, "plate:result", { result: "walk" });
  assert.equal(board.gameState.score.away, 1);
  assert.equal(board.gameState.runners.first, true);
  assert.equal(board.gameState.runners.second, true);
  assert.equal(board.gameState.runners.third, true);
  assert.equal(board.playerSettings.currentBattingOrderIndex.away, 1);
}

{
  let board = createBoard("test");
  board = run(board, "plate:result", { result: "hit" });
  assert.equal(board.playerSettings.away.battingOrder[0].hits, 1);
  board = run(board, "players:patch", {
    battingOrderUpdates: {
      away: {
        0: { playerName: "New Batter" }
      }
    }
  });
  assert.equal(board.playerSettings.away.battingOrder[0].playerName, "New Batter");
  assert.equal(board.playerSettings.away.battingOrder[0].hits, 0);
  assert.equal(getCurrentBatter(board).playerName, "A.Batter2");
}

{
  let board = createBoard("test");
  board = run(board, "plate:result", { result: "strikeoutSwinging" });
  board = run(board, "plate:result", { result: "strikeoutLooking" });
  assert.equal(getCurrentPitcher(board).strikeouts, 2);
  board = run(board, "history:undo");
  assert.equal(getCurrentPitcher(board).strikeouts, 1);
  board = run(board, "game:reset");
  assert.equal(getCurrentPitcher(board).strikeouts, 0);
}

{
  let board = createBoard("test");
  assert.equal(board.playerSettings.away.pitchers.length, 1);
  board = run(board, "players:patch", {
    addedPitchers: {
      away: [{ pitcherName: "A.Pitcher2" }, { pitcherName: "A.Pitcher3" }]
    }
  });
  assert.equal(board.playerSettings.away.pitchers.length, 3);

  board = run(board, "players:patch", { removedPitchers: { away: 1 } });
  assert.equal(board.playerSettings.away.pitchers.length, 2);
  assert.equal(board.playerSettings.away.pitchers[1].pitcherName, "A.Pitcher2");

  // 1人しかいない場合は削除しても最後の1人は残す。
  board = run(board, "players:patch", { removedPitchers: { away: 10 } });
  assert.equal(board.playerSettings.away.pitchers.length, 1);
}

{
  let board = createBoard("test");
  assert.equal(board.playerSettings.away.battingOrder[0].position, undefined);
}

{
  let board = createBoard("test");
  board = run(board, "plate:result", { result: "strikeoutSwinging" });
  assert.equal(board.gameState.overlay.kind, "strikeout");
  assert.equal(board.gameState.overlay.batterName, "A.Batter1");
  assert.equal(board.gameState.overlay.pitcherStrikeouts, 1);
  const seqAfterFirst = board.gameState.plateAppearanceSeq;
  assert.equal(seqAfterFirst, 1);

  board = run(board, "plate:result", { result: "homeRun" });
  assert.equal(board.gameState.overlay.kind, "homeRun");
  assert.equal(board.gameState.overlay.batterName, "A.Batter2");
  assert.equal(board.gameState.plateAppearanceSeq, 2);

  // count:reset (カウントRS) must NOT bump the plate-appearance sequence,
  // since only plate-result-triggered count resets should snap instantly on the client.
  board = run(board, "count:reset");
  assert.equal(board.gameState.plateAppearanceSeq, 2);

  // game:reset (スコアリセット) must preserve the sequence value across the reset too.
  board = run(board, "game:reset");
  assert.equal(board.gameState.plateAppearanceSeq, 2);
}

console.log("scoringRules tests passed");
