(function(exports){
  exports.clone_state = function(state) {
    return JSON.parse(JSON.stringify(state)); // TODO: something better
  };

  exports.get_permanent = function(state, copy_id) {
    for (var player_id in state.players) {
      if (state.players.hasOwnProperty(player_id)) {
        var permanents = state.players[player_id].permanents;
        for (var i = 0; i < permanents.length; i++) {
          if (permanents[i].copy_id == copy_id) {
            return permanents[i];
          }
        }
      }
    }
    throw 'Permanent ' + copy_id + ' not found.';
  };

  exports.apply_move = function(game, move) {
    var state = exports.clone_state(game.state);
    var player = state.players[move.user_id];
    var other_player = state.players[exports.next_player(game, move.user_id)];

    if (move.type === 'draw') {
      player.hand.push(player.deck.pop());
    }
    else if (move.type === 'yield') {
      state.turn++;
      if (state.attacks.length > 0) {
        state.phase = 'defend';
      }
    }
    else if (move.type === 'defend') {
      for (var i = 0; i < state.attacks.length; i++) {
        var attacker = exports.get_permanent(state, state.attacks[i].attacker);
        var target = exports.get_permanent(state, state.attacks[i].target);

        var resolve = function(atk, def, defender) {
          def.defense -= atk.attack;
          if (def.defense <= 0) {
            defender.permanents.splice(defender.permanents.indexOf(def), 1);
          }
        }

        resolve(attacker, target, player);
        resolve(target, attacker, other_player);
      }
      state.attacks = [];
      state.phase = 'main';
    }
    else if (move.type === 'play') {
      var index = null;
      for (var i = 0; i < player.hand.length; i++) {
        if (player.hand[i].copy_id == move.copy_id) {
          index = i;
          break;
        }
      }
      if (index === null) {
        throw 'Attempt to play ' + move.copy_id + ' not in hand.';
      }

      var card = player.hand[index];

      var remove_from_hand = function() {
        return player.hand.splice(index, 1)[0];
      }

      if (card.type === 'resource') {
        player.scrap += remove_from_hand().worth;
      } else if (card.type === 'generator' || card.type === 'ship') {
        var cost = card.hasOwnProperty('cost') ? card.cost : 0;
        if (card.cost > player.scrap) {
          console.log('Player doesn\'t have enough scrap');
        }
        else {
          player.scrap -= cost;
          player.permanents.push(remove_from_hand());
        }
      } else {
        throw 'Unplayable card type ' + card.type;
      }
    }
    else if (move.type === 'attack') {
      var attacker = exports.get_permanent(state, move.attacker);

      if (attacker.tapped) {
        throw 'Attacker already tapped';
      }

      attacker.tapped = true;

      state.attacks.push({
        attacker: move.attacker,
        target: move.target,
      });
    }
    else {
      throw 'Unrecognized move type ' + move.type;
    }

    game.moves.push(move);
    game.state = state;

    state.turn_player_id = exports.whose_turn(game);
    state.draw_possible = exports.draw_possible(game, state.turn_player_id);
  };

  // Strip out secrets from a state for sending to the given player
  exports.strip_state = function(state, dest_player_id) {
    var state = exports.clone_state(state);

    for (var p_id in state.players) {
      if (!state.players.hasOwnProperty(p_id) || p_id == dest_player_id) {
        continue;
      }

      var other_player = state.players[p_id];

      for (var i = 0; i < other_player.hand.length; i++) {
        other_player.hand[i] = {name: '?'};
      }
    }

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

    var last_move = game.moves[game.moves.length - 1];

    var ret = last_move.turn;

    if (last_move.type === 'yield') {
      ret++;
    }

    return ret;
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
        possible_to_draw -= 1;
      }
    }

    return Math.min(possible_to_draw,
        game.state.players[player_id].deck.length);
  };
})(typeof exports === 'undefined' ? this['state'] = {} : exports);
