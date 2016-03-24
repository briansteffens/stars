(function(exports) {
  var cards = require('./cards.js');
  var explore_cards = cards.pool(cards.explore());

  exports.clone_state = function(state) {
    return JSON.parse(JSON.stringify(state)); // TODO: something better
  };

  exports.next_explore = function(game, state) {
    var rand = Math.floor(explore_cards.length * game.rng());
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
      if (!state.players.hasOwnProperty(player_id)) {
        continue;
      }
      var temp = exports.get_player_permanent(state, player_id, copy_id);
      if (temp !== null) {
        return temp;
      }
    }
    throw 'Permanent ' + copy_id + ' not found.';
  };

  // Gets info about which player has a card and which array it's in
  exports.get_card_info = function(state, copy_id) {
    for (var player_id in state.players) {
      if (!state.players.hasOwnProperty(player_id)) {
        continue;
      }

      var hand = state.players[player_id].hand;
      for (var i = 0; i < hand.length; i++) {
        if (hand[i].copy_id == copy_id) {
          return {
            player_id: player_id,
            collection: hand,
            collection_name: 'hand',
            card: hand[i],
          };
        }
      }

      var ret = exports.get_player_permanent(state, player_id, copy_id);
      if (ret !== null) {
        return {
          player_id: player_id,
          collection: state.players[player_id].permanents,
          collection_name: 'permanents',
          card: ret,
        };
      }
    }

    throw 'Permanent ' + copy_id + ' not found.';
  };

  exports.get_card = function(state, copy_id) {
    return exports.get_card_info(state, copy_id).card;
  }

  exports.apply_move = function(game, move) {
    if (game.state.winner !== undefined) {
      console.log('game already finished');
      return;
    }

    var state = exports.clone_state(game.state);
    var player = state.players[move.user_id];
    var other_player = state.players[exports.next_player(game, move.user_id)];

    let get_user = function(id) {
      console.log(game);
      console.log(game.users);
      for (let user of game.users) {
        if (user.id == id) {
          return user;
        }
      }
      throw 'User not found';
    }

    let log = function(message) {
      message = message.replace('{me}', player.user_name);
      message = message.replace('{enemy}', other_player.user_name);
      state.log.push({
        message: message,
        turn: move.turn,
        player_id: player.id,
      });
    }

    let consume = function(source, target_id) {
      let info = exports.get_card_info(state, target_id);
      info.collection.splice(info.collection.indexOf(info.card), 1);
      if (info.card.mass !== undefined) {
        source.mass += info.card.mass;
      } else if (info.card.power !== undefined) {
        source.mass += info.card.power;
      } else {
        source.mass++;
      }
      source.tapped = true;
      log('{me}\'s '+source.name+' consumes a '+info.card.name);
    }

    let permanent_handlers = {
      black_hole: {
        on_turn_end: function(ctx) {
          if (!ctx.permanent.tapped) {
            let consumable = function(player) {
              let ret = [];
              for (let perm of player.permanents) {
                if (perm.name !== 'mother ship' &&
                    perm.copy_id !== ctx.permanent.copy_id) {
                  ret.push(perm);
                }
              }
              return ret;
            }

            let options = consumable(player).concat(consumable(other_player));
            if (options.length == 0) {
              console.log('Nothing left to consume');
            } else {
              let index = Math.floor(game.rng() * options.length);
              consume(ctx.permanent, options[index].copy_id);
            }
          }
        },
      },
    };

    let handle_permanent_event = function(handler_name, ctx) {
      for (let type of ctx.permanent.types) {
        if (!permanent_handlers.hasOwnProperty(type)) {
          return;
        }
        let handler = permanent_handlers[type];
        if (!handler.hasOwnProperty(handler_name)) {
          return;
        }
        handler[handler_name](ctx);
      }
    };

    let effect_handlers = {
      overburner: {
        on_attach: function(ctx) {
          ctx.effect.turn_counter = 2;
          ctx.effect.old_power = ctx.target.power;
          ctx.target.power = ctx.effect.old_power * ctx.effect.turn_counter;
        },
        on_turn_start: function(ctx) {
          ctx.effect.turn_counter--;
          if (ctx.effect.turn_counter <= 0) {
            ctx.player.permanents.splice(
                ctx.player.permanents.indexOf(ctx.target), 1);
            log('{me}\'s '+ctx.target.name+' destroyed by overburner');
            return;
          }
          ctx.target.power = ctx.effect.old_power * ctx.effect.turn_counter;
        },
        on_detach: function(ctx) {
          ctx.target.power = ctx.effect.old_power;
        },
      },
      time_bomb: {
        on_attach: function(ctx) {
          ctx.effect.turn_counter = 2;
        },
        on_turn_start: function(ctx) {
          ctx.effect.turn_counter--;
          if (ctx.effect.turn_counter <= 0) {
            ctx.target.hp -= ctx.effect.damage;
            if (ctx.target.hp <= 0) {
              ctx.player.permanents.splice(
                  ctx.player.permanents.indexOf(ctx.target), 1);
              log('{me}\'s '+ctx.target.name+' destroyed by time bomb');
            }
            ctx.target.effects.splice(
                ctx.target.effects.indexOf(ctx.effect), 1);
          }
        },
        on_detach: function(ctx) {},
      },
      weapon_jammer: {
        on_attach: function(ctx) {
          ctx.effect.turn_counter = ctx.effect.turns;
          ctx.effect.old_attack = ctx.target.attack;
          ctx.target.attack = 0;
        },
        on_turn_start: function(ctx) {
          ctx.effect.turn_counter--;
          if (ctx.effect.turn_counter < 0) {
            ctx.target.attack = ctx.effect.old_attack;
            ctx.target.effects.splice(
                ctx.target.effects.indexOf(ctx.effect), 1);
            log('weapon jammer wore off of {me}\'s '+ctx.target.name);
          }
        },
        on_detach: function(ctx) {
          ctx.target.attack = ctx.effect.old_attack;
        },
      },
    };

    var update_power = function(player, enforce) {
      player.power_used = 0;
      player.power_total = 0;
      player.shields_used = 0;

      // Permanent power
      for (var i = 0; i < player.permanents.length; i++) {
        var perm = player.permanents[i];

        if (perm.power !== undefined) {
          player.power_total += perm.power;
        }

        if (perm.powered && perm.upkeep !== undefined) {
          player.power_used += perm.upkeep;
        }

        if (perm.shields !== undefined) {
          player.shields_used += perm.shields;
          player.power_used += perm.shields;
        }
      }

      if (!enforce) {
        return;
      }

      // Depower permanents if upkeep exceeds total power
      for (var i = 0; i < player.permanents.length; i++) {
        var perm = player.permanents[i];

        if (player.power_used > player.power_total &&
            perm.powered && perm.upkeep !== undefined) {
          perm.powered = false;
          player.power_used -= perm.upkeep;
        }

        if (player.shields_used > player.shields_total ||
            player.power_used > player.power_total) {
          player.shields_used -= perm.shields;
          perm.shields = 0;
        }
      }
    };

    let handle_effect_event = function(handler_name, ctx) {
      for (let type of ctx.effect.types) {
        if (!effect_handlers.hasOwnProperty(type)) {
          return;
        }
        let handler = effect_handlers[type];
        if (!handler.hasOwnProperty(handler_name)) {
          return;
        }
        handler[handler_name](ctx);
      }
    };

    let on_turn_end = function() {
      for (let permanent of player.permanents) {
        handle_permanent_event('on_turn_end', {
          permanent: permanent,
          player: player,
          other_player: other_player,
        });
      }
    };

    var phase_main_start = function(player, other_player) {
      state.attacks = [];
      state.phase = 'main';

      // untap
      for (var i = 0; i < player.permanents.length; i++) {
        player.permanents[i].tapped = false;
      }

      // reset draw count
      state.draw_possible = 1;

      // reset explore count
      state.can_explore = 1;
      let chance = 1.0;
      for (var i = 0; i < player.permanents.length; i++) {
        if (player.permanents[i].name === 'exploratory drone' &&
            player.permanents[i].powered) {
          chance /= 2;
          if (game.rng() < chance) {
            state.can_explore++;
          }
        }
      }

      // effect events
      for (let perm of player.permanents) {
        if (perm.effects === undefined) {
          continue;
        }
        for (let effect of perm.effects) {
          handle_effect_event('on_turn_start', {
            target: perm,
            effect: effect,
            player: player,
            other_player: other_player,
          });
        }
      }
    };

    var mull = function(player) {
      if (player.mull_penalty >= 7) {
        throw 'Cannot mull anymore';
      }

      // Add cards from hand back into deck
      player.deck = player.deck.concat(player.hand);

      // Shuffle deck
      for (let i = player.deck.length - 1; i > 0; i -= 1) {
        let j = Math.floor(Math.random() * (i + 1));
        let temp = player.deck[i];
        player.deck[i] = player.deck[j];
        player.deck[j] = temp;
      }

      let cards = 7 - Math.max(0, player.mull_penalty);
      player.hand = player.deck.splice(0, cards);
      player.mull_penalty++;

      log('{me} drew ' + cards + ' cards');
    };

    if (move.type === 'forfeit') {
      if (state.winner !== undefined) {
        throw 'Cannot forfeit a finished game';
      }
      state.winner = other_player.user_id;
      log('{me} forfeit the game');
    } else if (state.phase === 'pre-game') {
      if (move.type === 'mull') {
        if (player.ready) {
          throw 'Cannot mull when ready';
        }

        mull(player);
      } else if (move.type === 'ready') {
        player.ready = true;

        log('{me} is ready');

        if (other_player.ready) {
          // Start game
          state.turn = 0;
          state.turn_player_id = player.user_id;

          let player_ids = [];
          for (let player_id in state.players) {
            if (state.players.hasOwnProperty(player_id)) {
              player_ids.push(player_id);
            }
          }

          state.turn_player_id = player_ids[Math.floor(game.rng() * 2)];

          phase_main_start(state.players[state.turn_player_id],
            state.players[exports.next_player(game, state.turn_player_id)]);

          log('the game has started');
        }
      } else {
        throw 'Invalid move type during pre-game phase';
      }
    } else {
      if (move.type === 'draw') {
        if (state.draw_possible <= 0) {
          throw 'Cannot draw anymore cards this turn';
        }
        state.draw_possible--;
        player.hand.push(player.deck.pop());
        log('{me} drew a card');
      }
      else if (move.type === 'scrap') {
        if (player.user_id != state.turn_player_id) {
          throw 'Can only scrap during your turn';
        }

        let info = exports.get_card_info(state, move.card);
        if (info.player_id != player.user_id) {
          throw "Cannot scrap other player's card";
        }

        if (info.card.types.intersect(['ship','instant']).length == 0 ||
            info.card.name === 'mother ship') {
          throw 'Cannot scrap this card type';
        }

        info.collection.splice(info.collection.indexOf(info.card), 1);
        let cost = info.card.cost !== undefined ? info.card.cost : 0;
        player.scrap += Math.floor(cost / 2);
        log('{me} scrapped a ' + info.card.name);
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
        log('{me} explored');
      }
      else if (move.type === 'yield') {
        if (state.phase !== 'main') {
          throw 'Can only yield in main phase';
        }

        on_turn_end();

        state.turn++;

        // Change player's turn
        state.turn_player_id = other_player.user_id;

        // Reset ability to play cards per turn
        other_player.cant_play = [];

        if (state.attacks.length > 0) {
          state.phase = 'defend';
        }
        else {
          phase_main_start(other_player, player);
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
          var shields = target.shields;
          for (var j = 0; j < state.attacks.length; j++) {
            if (state.attacks[j].target == target.copy_id) {
              shields -= exports.get_permanent(state,
                  state.attacks[j].attacker).attack;
            }
          }
          // Apply damage if shields were pierced
          if (shields < 0) {
            target.hp += shields;
          }
          if (target.hp <= 0) {
            player.permanents.splice(player.permanents.indexOf(target), 1);
            log(target.name + ' destroyed by {enemy}');
            if (target.name === 'mother ship') {
              state.winner = other_player.user_id;
              log('{enemy} wins the game');
            }
          }
        }

        phase_main_start(player, other_player);
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

        if (player.cant_play.intersect(card.types).length > 0) {
          throw 'Card has already been played this turn';
        }

        let is_generator_ship_or_black_hole =
          card.types.intersect(['generator','ship','black_hole']).length > 0;

        log('{me} played a ' + card.name);

        if (card.types.contains('resource')) {
          player.scrap += remove_from_hand().worth;
        } else if (is_generator_ship_or_black_hole) {
          // Mark a card type as played this turn
          if (card.types.contains('generator')) {
            player.cant_play = player.cant_play.concat(card.types);
          }

          var cost = card.hasOwnProperty('cost') ? card.cost : 0;
          if (card.cost > player.scrap) {
            console.log('Player doesn\'t have enough scrap');
          }
          else {
            player.scrap -= cost;
            player.permanents.push(remove_from_hand());
          }
        } else if (card.types.contains('shields')) {
          player.shields_total = Math.min(player.shields_total+card.shields,
              10);
          remove_from_hand();
        } else {
          throw 'Unplayable card type ' + card.types;
        }
      }
      else if (move.type === 'action') {
        var source = exports.get_card(state, move.source);
        var target = exports.get_card(state, move.target);

        var action = null;

        for (var i = 0; i < source.actions.length; i++) {
          if (source.actions[i].name === move.action) {
            action = source.actions[i];
            break;
          }
        }

        if (action === null) {
          throw 'Action '+move.action+' not found';
        }

        if (source.types.intersect(['black_hole','instant']).length == 0 &&
            !source.powered) {
          throw 'Actor is powered down';
        }

        if (source.tapped) {
          throw 'Actor already tapped';
        }

        if (source.types.contains('instant') && source.cost !== undefined) {
          player.scrap -= source.cost;
          if (player.scrap < 0) {
            throw 'Not enough scrap';
          }
        }

        source.tapped = true;

        switch (action.name) {
          case 'attack':
            state.attacks.push({
              attacker: source.copy_id,
              target: target.copy_id,
            });
            log('{me} attacked a '+target.name+' with a '+source.name);
            break;
          case 'repair':
            target.hp = Math.min(target.hp + action.amount, target.defense);
            log('{me} repaired a '+target.name);
            break;
          case 'damage':
            if (target.name === 'mother ship') {
              throw 'Cannot use this on the mother ship';
            }
            let shields = target.shields - action.amount;
            let msg = '{me} did '+action.amount+' damage to a '+target.name;
            if (shields < 0) {
              target.hp += shields;
              msg += ' ('+shields+' blocked by shields)';
            }
            if (target.hp <= 0) {
              other_player.permanents.splice(
                  other_player.permanents.indexOf(target), 1);
              msg += ', killing it';
            }
            log(msg);
            break;
          case 'stats_delta':
            if (target.name === 'mother ship') {
              throw 'Cannot use this on the mother ship';
            }
            if (action.attack !== undefined && target.attack !== undefined) {
              target.attack = Math.max(target.attack + action.attack, 0);
            }
            if (action.defense !== undefined && target.defense !== undefined) {
              target.defense = Math.max(target.defense + action.defense, 0);
              target.hp = target.defense;
            }
            log('{me} played a '+source.name+' on a '+target.name);
            break;
          case 'piracy':
            if (target.name === 'mother ship') {
              throw 'Cannot use this on the mother ship';
            }
            other_player.permanents.splice(
                other_player.permanents.indexOf(target), 1);
            target.powered = false;
            target.shields = 0;
            player.permanents.push(target);
            log('{me} stole a '+target.name);
            break;
          case 'apply_effect':
            if (target.name === 'mother ship') {
              throw 'Cannot use this on the mother ship';
            }
            if (target.effects === undefined) {
              target.effects = [];
            }
            target.effects.push(action.effect);
            handle_effect_event('on_attach', {
              target: target,
              effect: action.effect,
              player: player,
              other_player: other_player,
            });
            log('{me} played a '+source.name+' on a '+target.name);
            break;
          case 'cleanse':
            if (target.name === 'mother ship') {
              throw 'Cannot use this on the mother ship';
            }
            if (target.effects !== undefined) {
              for (let effect of target.effects) {
                handle_effect_event('on_detach', {
                  target: target,
                  effect: effect,
                  player: player,
                  other_player: other_player,
                });
              }
              target.effects = [];
            }
            log('{me} cleansed a '+target.name);
            break;
          case 'consume':
            if (target.name === 'mother ship') {
              throw 'Cannot use this on the mother ship';
            }
            if (source.copy_id === target.copy_id) {
              throw 'Cannot consume itself';
            }
            consume(source, target.copy_id);
            break;
          case 'reactor_upgrade':
            target.power += action.amount;
            log('{me} upgraded a '+target.name+' to '+target.power+' power');
            break;
          default:
            throw 'Action '+action.name+' unknown';
        }

        if (source.types.contains('instant')) {
          player.hand.splice(player.hand.indexOf(source), 1);
        }
      }
      else if (move.type === 'toggle_power') {
        if (state.turn_player_id != player.user_id) {
          throw 'Wrong turn';
        }

        var card = exports.get_player_permanent(state, player.user_id,
            move.card);

        if (card.tapped) {
          throw 'Cannot toggle power of tapped card';
        }

        card.powered = !card.powered;
        update_power(player, false);

        if (player.power_used > player.power_total) {
          throw 'Not enough available power';
        }

        log('{me} powered '+(card.powered ? 'on' : 'off')+' a '+card.name);
      } else if (move.type === 'shields') {
        if (state.turn_player_id != player.user_id) {
          throw 'Wrong turn';
        }

        var card = exports.get_player_permanent(state, player.user_id,
            move.card);

        if (card.types.contains('black_hole')) {
          throw 'Cannot shield a black hole';
        }

        card.shields = Math.max(card.shields + move.delta, 0);

        update_power(player, false);

        if (player.power_used > player.power_total ||
            player.shields_used > player.shields_total) {
          throw 'Not enough available power or shields';
        }

        log('{me} '+(move.delta > 0 ? 'added' : 'removed')+' shields from a '+
            card.name);
      }
      else {
        throw 'Unrecognized move type ' + move.type;
      }
    }

    update_power(player, true);
    update_power(other_player, true);

    // Accept move and replace old state with new one
    game.moves.push(move);
    game.state = state;
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
})(exports === undefined ? this['state'] = {} : exports);
