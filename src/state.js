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

  exports.current_turn = function(game) {
    if (game.moves.length == 0) {
      return 0;
    }

    return game.moves[game.moves.length - 1].turn;
  };

  exports.is_first_turn = function(game) {
    return exports.current_turn(game) < 2;
  };

  exports.moves_in_turn = function(game, turn_index) {
    var ret = [];

    for (var i = 0; i < game.moves.length; i++) {
      if (game.moves[i].turn < turn_index) {
        continue;
      }

      if (game.moves[i].turn > turn_index) {
        break;
      }

      ret.push(game.moves[i]);
    }

    return ret;
  };

  exports.draw_possible = function(game, player_id) {
    if (exports.whose_turn(game) != player_id) {
      return 0;
    }

    var moves = exports.moves_in_turn(game, exports.current_turn(game));

    var possible_to_draw = exports.is_first_turn(game) ? 7 : 1;

    for (var i = 0; i < moves.length; i++) {
      if (moves[i].type === 'draw') {
        possible_to_draw -= moves[i].count;
      }
    }

    return possible_to_draw;
  };
})(typeof exports === 'undefined' ? this['state'] = {} : exports);
