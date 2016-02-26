(function(exports){
  exports.apply_move = function(game, state, move) {
    var state = JSON.parse(JSON.stringify(state)); // lolclone
/*
    var player = get_player(game, move.user_id);

    if (move.type === 'draw') {
      for (var c = 0; c < move.cards; c++) {
        player.hand.push(move.cards[c]);
      }
    }
    else if (move.type === 'yield') {

    }
    else {
      throw 'Unrecognized move type ' + move.type;
    }
*/
    return state;
  };

  exports.next_player = function(game, player_id) {
    return game.player_ids[(game.player_ids[0] == player_id) | 0];
  };

  exports.whose_turn = function(game) {
    if (game.moves.length == 0) {
      return game.player_ids[0];
    }

    var last_move = game.moves[game.moves.length - 1];
    if (last_move.type === 'yield') {
      return exports.next_player(game, last_move.user_id);
    } else {
      return last_move.user_id;
    }
  };
})(typeof exports === 'undefined' ? this['state'] = {} : exports);
