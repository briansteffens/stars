(function(exports) {
  var cards = require('./cards.js');
  var explore_cards = cards.pool(cards.explore());

  exports.clone_state = function(state) {
    return JSON.parse(JSON.stringify(state)); // TODO: something better
  };

  exports.next_explore = function(game, state) {
    var rand = Math.floor(explore_cards.length * game.explore_rng());
    var card = JSON.parse(JSON.stringify(explore_cards[rand]));
    card.copy_id = state.next_copy_id++;
    card.tapped = false;
    card.powered = false;
    return card;
  };

  exports.get_player_permanent = function(state, player_id, copy_id) {
    var permanents = state.players[player_id].permanents;
    for (var i = 0; i < permanents.length; i++) {
      if (permanents[i].copy_id == copy_id) {
        return permanents[i];
      }
    }
    return null;
  };

  exports.get_permanent = function(state, copy_id) {
    for (var player_id in state.players) {
      if (state.players.hasOwnProperty(player_id)) {
        var temp = exports.get_player_permanent(state, player_id, copy_id);
        if (temp !== null) {
          return temp;
        }
      }
    }
    throw 'Permanent ' + copy_id + ' not found.';
  };

  exports.apply_move = function(game, move) {
    if (typeof game.state.winner !== 'undefined') {
      console.log('game already finished');
      return;
    }

    var state = exports.clone_state(game.state);
    var player = state.players[move.user_id];
    var other_player = state.players[exports.next_player(game, move.user_id)];

    var update_power = function(player, enforce) {
      player.power_used = 0;
      player.power_total = 0;

      for (var i = 0; i < player.permanents.length; i++) {
        var perm = player.permanents[i];

        if (typeof perm.power !== 'undefined') {
          player.power_total += perm.power;
        }

        if (perm.powered && typeof perm.upkeep !== 'undefined') {
          player.power_used += perm.upkeep;
        }
      }

      if (!enforce) {
        return;
      }

      // Depower stuff if upkeep exceeds total power
      for (var i = 0; i < player.permanents.length; i++) {
        var perm = player.permanents[i];

        if (perm.powered && typeof perm.upkeep !== 'undefined') {
          if (player.power_used <= player.power_total) {
            break;
          }

          perm.powered = false;
          player.power_used -= perm.upkeep;
        }
      }
    };

    var phase_main_start = function(player) {
      // untap
      for (var i = 0; i < player.permanents.length; i++) {
        player.permanents[i].tapped = false;
      }

      // reset explore count
      state.can_explore = 1;
      for (var i = 0; i < player.permanents.length; i++) {
        if (player.permanents[i].name === 'exploratory drone' &&
            player.permanents[i].powered) {
          state.can_explore++;
        }
      }
    };

    if (move.type === 'draw') {
      player.hand.push(player.deck.pop());
    }
    else if (move.type === 'scrap') {
      if (player.user_id != state.turn_player_id) {
        throw 'Can only scrap during your turn';
      }

      var card = exports.get_permanent(state, move.card, player.user_id);
      player.permanents.splice(player.permanents.indexOf(card), 1);
      player.scrap += Math.floor(card.cost / 2);
    }
    else if (move.type === 'explore') {
      if (player.user_id != state.turn_player_id) {
        throw 'Can only explore on your turn';
      }

      if (state.phase !== 'main') {
        throw 'Can only explore during main phase';
      }

      if (state.can_explore <= 0) {
        throw 'Player cannot explore anymore this turn';
      }
      player.hand.push(exports.next_explore(game, state));
      state.can_explore--;
    }
    else if (move.type === 'yield') {
      if (state.phase !== 'main') {
        throw 'Can only yield in main phase';
      }

      state.turn++;

      // Reset ability to play cards per turn
      other_player.cant_play = [];

      if (state.attacks.length > 0) {
        state.phase = 'defend';
      }
      else {
        phase_main_start(other_player);
      }
    }
    else if (move.type === 'defend') {
      var targets = [];
      for (var i = 0; i < state.attacks.length; i++) {
        var target = exports.get_permanent(state, state.attacks[i].target);
        if (targets.indexOf(target) < 0) {
          targets.push(target);
        }
      }

      for (var i = 0; i < targets.length; i++) {
        var target = targets[i];
        for (var j = 0; j < state.attacks.length; j++) {
          if (state.attacks[j].target == target.copy_id) {
            target.defense -= exports.get_permanent(state,
                state.attacks[j].attacker).attack;
          }
        }
        if (target.defense <= 0) {
          player.permanents.splice(player.permanents.indexOf(target, 1));
          if (target.name === 'mother ship') {
            state.winner = other_player.user_id;
          }
        }
      }

      state.attacks = [];
      state.phase = 'main';

      phase_main_start(player);
    }
    else if (move.type === 'play') {
      if (player.user_id != state.turn_player_id) {
        throw 'Can only play cards during your turn';
      }

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

      if (player.cant_play.indexOf(card.type) >= 0) {
        console.log(card.type + ' has already been played this turn');
        return;
      }

      if (card.type === 'resource') {
        player.scrap += remove_from_hand().worth;
      } else if (card.type === 'generator' || card.type === 'ship') {
        // Mark a card type as played this turn
        if (card.type === 'generator') {
          player.cant_play.push(card.type);
        }

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

      if (!attacker.powered) {
        throw 'Attacker is powered down';
      }

      if (attacker.tapped) {
        throw 'Attacker already tapped';
      }

      attacker.tapped = true;

      state.attacks.push({
        attacker: move.attacker,
        target: move.target,
      });
    }
    else if (move.type === 'toggle_power') {
      if (state.turn_player_id != player.user_id) {
        throw 'Wrong turn';
      }

      var card = exports.get_player_permanent(state, player.user_id, move.card);

      if (card.tapped) {
        throw 'Cannot toggle power of tapped card';
      }

      card.powered = !card.powered;
      update_power(player, false);

      if (player.power_used > player.power_total) {
        throw 'Not enough available power';
      }
    }
    else {
      throw 'Unrecognized move type ' + move.type;
    }

    update_power(player, true);
    update_power(other_player, true);

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
    if (exports.whose_turn(game) != player_id || game.state.phase !== 'main') {
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
