(function(exports) {
  var cards = require('./cards.js');
  var exploreCards = cards.pool(cards.explore());

  exports.cloneState = function(state) {
    return JSON.parse(JSON.stringify(state)); // TODO: something better
  };

  exports.nextExplore = function(game, state) {
    var rand = Math.floor(exploreCards.length * game.rng());
    var card = JSON.parse(JSON.stringify(exploreCards[rand]));
    card.copyId = state.nextCopyId++;
    card.tapped = false;
    card.powered = false;
    return card;
  };

  exports.getPlayerPermanent = function(state, playerId, copyId) {
    var permanents = state.players[playerId].permanents;
    for (var i = 0; i < permanents.length; i++) {
      if (permanents[i].copyId == copyId) {
        return permanents[i];
      }
    }
    return null;
  };

  exports.getPermanent = function(state, copyId) {
    for (var playerId in state.players) {
      if (!state.players.hasOwnProperty(playerId)) {
        continue;
      }
      var temp = exports.getPlayerPermanent(state, playerId, copyId);
      if (temp !== null) {
        return temp;
      }
    }
    throw 'Permanent ' + copyId + ' not found.';
  };

  // Gets info about which player has a card and which array it's in
  exports.getCardInfo = function(state, copyId) {
    for (var playerId in state.players) {
      if (!state.players.hasOwnProperty(playerId)) {
        continue;
      }

      var hand = state.players[playerId].hand;
      for (var i = 0; i < hand.length; i++) {
        if (hand[i].copyId == copyId) {
          return {
            playerId: playerId,
            collection: hand,
            collectionName: 'hand',
            card: hand[i],
          };
        }
      }

      var ret = exports.getPlayerPermanent(state, playerId, copyId);
      if (ret !== null) {
        return {
          playerId: playerId,
          collection: state.players[playerId].permanents,
          collectionName: 'permanents',
          card: ret,
        };
      }
    }

    throw 'Permanent ' + copyId + ' not found.';
  };

  exports.getCard = function(state, copyId) {
    return exports.getCardInfo(state, copyId).card;
  }

  exports.applyMove = function(game, move) {
    if (game.state.winner !== undefined) {
      console.log('game already finished');
      return;
    }

    var state = exports.cloneState(game.state);
    var player = state.players[move.userId];
    var otherPlayer = state.players[exports.nextPlayer(game, move.userId)];

    let getUser = function(id) {
      for (let user of game.users) {
        if (user._id == id) {
          return user;
        }
      }
      throw 'User not found';
    }

    let log = function(message) {
      message = message.replace('{me}', player.userName);
      message = message.replace('{enemy}', otherPlayer.userName);
      state.log.push({
        message: message,
        turn: move.turn,
        playerId: player.id,
      });
    }

    let consume = function(source, targetId) {
      let info = exports.getCardInfo(state, targetId);
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

    let permanentHandlers = {
      blackHole: {
        onTurnEnd: function(ctx) {
          if (!ctx.permanent.tapped) {
            let consumable = function(player) {
              let ret = [];
              for (let perm of player.permanents) {
                if (perm.name !== 'mother ship' &&
                    perm.copyId !== ctx.permanent.copyId) {
                  ret.push(perm);
                }
              }
              return ret;
            }

            let options = consumable(player).concat(consumable(otherPlayer));
            if (options.length == 0) {
              console.log('Nothing left to consume');
            } else {
              let index = Math.floor(game.rng() * options.length);
              consume(ctx.permanent, options[index].copyId);
            }
          }
        },
      },
    };

    let handlePermanentEvent = function(handlerName, ctx) {
      for (let type of ctx.permanent.types) {
        if (!permanentHandlers.hasOwnProperty(type)) {
          return;
        }
        let handler = permanentHandlers[type];
        if (!handler.hasOwnProperty(handlerName)) {
          return;
        }
        handler[handlerName](ctx);
      }
    };

    let effectHandlers = {
      overburner: {
        onAttach: function(ctx) {
          ctx.effect.turnCounter = 2;
          ctx.effect.oldPower = ctx.target.power;
          ctx.target.power = ctx.effect.oldPower * ctx.effect.turnCounter;
        },
        onTurnStart: function(ctx) {
          ctx.effect.turnCounter--;
          if (ctx.effect.turnCounter <= 0) {
            ctx.player.permanents.splice(
                ctx.player.permanents.indexOf(ctx.target), 1);
            log('{me}\'s '+ctx.target.name+' destroyed by overburner');
            return;
          }
          ctx.target.power = ctx.effect.oldPower * ctx.effect.turnCounter;
        },
        onDetach: function(ctx) {
          ctx.target.power = ctx.effect.oldPower;
        },
      },
      timeBomb: {
        onAttach: function(ctx) {
          ctx.effect.turnCounter = 2;
        },
        onTurnStart: function(ctx) {
          ctx.effect.turnCounter--;
          if (ctx.effect.turnCounter <= 0) {
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
        onDetach: function(ctx) {},
      },
      weaponJammer: {
        onAttach: function(ctx) {
          ctx.effect.turnCounter = ctx.effect.turns;
          ctx.effect.oldAttack = ctx.target.attack;
          ctx.target.attack = 0;
        },
        onTurnStart: function(ctx) {
          ctx.effect.turnCounter--;
          if (ctx.effect.turnCounter < 0) {
            ctx.target.attack = ctx.effect.oldAttack;
            ctx.target.effects.splice(
                ctx.target.effects.indexOf(ctx.effect), 1);
            log('weapon jammer wore off of {me}\'s '+ctx.target.name);
          }
        },
        onDetach: function(ctx) {
          ctx.target.attack = ctx.effect.oldAttack;
        },
      },
    };

    var updatePower = function(player, enforce) {
      player.powerUsed = 0;
      player.powerTotal = 0;
      player.shieldsUsed = 0;

      // Permanent power
      for (var i = 0; i < player.permanents.length; i++) {
        var perm = player.permanents[i];

        if (perm.power !== undefined) {
          player.powerTotal += perm.power;
        }

        if (perm.powered && perm.upkeep !== undefined) {
          player.powerUsed += perm.upkeep;
        }

        if (perm.shields !== undefined) {
          player.shieldsUsed += perm.shields;
          player.powerUsed += perm.shields;
        }
      }

      if (!enforce) {
        return;
      }

      // Depower permanents if upkeep exceeds total power
      for (var i = 0; i < player.permanents.length; i++) {
        var perm = player.permanents[i];

        if (player.powerUsed > player.powerTotal &&
            perm.powered && perm.upkeep !== undefined) {
          perm.powered = false;
          player.powerUsed -= perm.upkeep;
        }

        if (player.shieldsUsed > player.shieldsTotal ||
            player.powerUsed > player.powerTotal) {
          player.shieldsUsed -= perm.shields;
          perm.shields = 0;
        }
      }
    };

    let handleEffectEvent = function(handlerName, ctx) {
      for (let type of ctx.effect.types) {
        if (!effectHandlers.hasOwnProperty(type)) {
          return;
        }
        let handler = effectHandlers[type];
        if (!handler.hasOwnProperty(handlerName)) {
          return;
        }
        handler[handlerName](ctx);
      }
    };

    let onTurnEnd = function() {
      for (let permanent of player.permanents) {
        handlePermanentEvent('onTurnEnd', {
          permanent: permanent,
          player: player,
          otherPlayer: otherPlayer,
        });
      }
    };

    var phaseMainStart = function(player, otherPlayer) {
      state.attacks = [];
      state.phase = 'main';

      // untap
      for (var i = 0; i < player.permanents.length; i++) {
        player.permanents[i].tapped = false;
      }

      // reset draw count
      state.drawPossible = 1;

      // reset explore count
      state.canExplore = 1;
      let chance = 1.0;
      for (var i = 0; i < player.permanents.length; i++) {
        if (player.permanents[i].name === 'exploratory drone' &&
            player.permanents[i].powered) {
          chance /= 2;
          if (game.rng() < chance) {
            state.canExplore++;
          }
        }
      }

      // effect events
      for (let perm of player.permanents) {
        if (perm.effects === undefined) {
          continue;
        }
        for (let effect of perm.effects) {
          handleEffectEvent('onTurnStart', {
            target: perm,
            effect: effect,
            player: player,
            otherPlayer: otherPlayer,
          });
        }
      }
    };

    var mull = function(player) {
      if (player.mullPenalty >= 7) {
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

      let cards = 7 - Math.max(0, player.mullPenalty);
      player.hand = player.deck.splice(0, cards);
      player.mullPenalty++;

      log('{me} drew ' + cards + ' cards');
    };

    if (move.type === 'forfeit') {
      if (state.winner !== undefined) {
        throw 'Cannot forfeit a finished game';
      }
      state.winner = otherPlayer.userId;
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

        if (otherPlayer.ready) {
          // Start game
          state.turn = 0;
          state.turnPlayerId = player.userId;

          let playerIDs = [];
          for (let playerId in state.players) {
            if (state.players.hasOwnProperty(playerId)) {
              playerIDs.push(playerId);
            }
          }

          state.turnPlayerId = playerIDs[Math.floor(game.rng() * 2)];

          phaseMainStart(state.players[state.turnPlayerId],
            state.players[exports.nextPlayer(game, state.turnPlayerId)]);

          log('the game has started');
        }
      } else {
        throw 'Invalid move type during pre-game phase';
      }
    } else {
      if (move.type === 'draw') {
        if (state.drawPossible <= 0) {
          throw 'Cannot draw anymore cards this turn';
        }
        state.drawPossible--;
        player.hand.push(player.deck.pop());
        log('{me} drew a card');
      }
      else if (move.type === 'scrap') {
        if (player.userId != state.turnPlayerId) {
          throw 'Can only scrap during your turn';
        }

        let info = exports.getCardInfo(state, move.card);
        if (info.playerId != player.userId) {
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
        if (player.userId != state.turnPlayerId) {
          throw 'Can only explore on your turn';
        }

        if (state.phase !== 'main') {
          throw 'Can only explore during main phase';
        }

        if (state.canExplore <= 0) {
          throw 'Player cannot explore anymore this turn';
        }
        player.hand.push(exports.nextExplore(game, state));
        state.canExplore--;
        log('{me} explored');
      }
      else if (move.type === 'yield') {
        if (state.phase !== 'main') {
          throw 'Can only yield in main phase';
        }

        onTurnEnd();

        state.turn++;

        // Change player's turn
        state.turnPlayerId = otherPlayer.userId;

        // Reset ability to play cards per turn
        otherPlayer.cantPlay = [];

        if (state.attacks.length > 0) {
          state.phase = 'defend';
        }
        else {
          phaseMainStart(otherPlayer, player);
        }
      }
      else if (move.type === 'defend') {
        var targets = [];
        for (var i = 0; i < state.attacks.length; i++) {
          var target = exports.getPermanent(state, state.attacks[i].target);
          if (targets.indexOf(target) < 0) {
            targets.push(target);
          }
        }

        for (var i = 0; i < targets.length; i++) {
          var target = targets[i];
          var shields = target.shields;
          for (var j = 0; j < state.attacks.length; j++) {
            if (state.attacks[j].target == target.copyId) {
              shields -= exports.getPermanent(state,
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
              state.winner = otherPlayer.userId;
              log('{enemy} wins the game');
            }
          }
        }

        phaseMainStart(player, otherPlayer);
      }
      else if (move.type === 'play') {
        if (player.userId != state.turnPlayerId) {
          throw 'Can only play cards during your turn';
        }

        var index = null;
        for (var i = 0; i < player.hand.length; i++) {
          if (player.hand[i].copyId == move.copyId) {
            index = i;
            break;
          }
        }
        if (index === null) {
          throw 'Attempt to play ' + move.copyId + ' not in hand.';
        }

        var card = player.hand[index];

        var removeFromHand = function() {
          return player.hand.splice(index, 1)[0];
        }

        if (player.cantPlay.intersect(card.types).length > 0) {
          throw 'Card has already been played this turn';
        }

        let isGeneratorShipOrBlackHole =
          card.types.intersect(['generator','ship','black_hole']).length > 0;

        if (card.types.contains('resource')) {
          player.scrap += removeFromHand().worth;
          log('{me} played a ' + card.name);
        } else if (isGeneratorShipOrBlackHole) {
          // Mark a card type as played this turn
          if (card.types.contains('generator')) {
            player.cantPlay = player.cantPlay.concat(card.types);
          }

          var cost = card.hasOwnProperty('cost') ? card.cost : 0;
          if (card.cost > player.scrap) {
            console.log('Player doesn\'t have enough scrap');
          }
          else {
            player.scrap -= cost;
            player.permanents.push(removeFromHand());
            log('{me} played a ' + card.name);
          }
        } else if (card.types.contains('shields')) {
          player.shieldsTotal = Math.min(player.shieldsTotal+card.shields,
              10);
          removeFromHand();
          log('{me} played a ' + card.name);
        } else {
          throw 'Unplayable card type ' + card.types;
        }
      }
      else if (move.type === 'action') {
        var source = exports.getCard(state, move.source);
        var target = exports.getCard(state, move.target);

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
              attacker: source.copyId,
              target: target.copyId,
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
              otherPlayer.permanents.splice(
                  otherPlayer.permanents.indexOf(target), 1);
              msg += ', killing it';
            }
            log(msg);
            break;
          case 'statsDelta':
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
            otherPlayer.permanents.splice(
                otherPlayer.permanents.indexOf(target), 1);
            target.powered = false;
            target.shields = 0;
            player.permanents.push(target);
            log('{me} stole a '+target.name);
            break;
          case 'applyEffect':
            if (target.name === 'mother ship') {
              throw 'Cannot use this on the mother ship';
            }
            if (target.effects === undefined) {
              target.effects = [];
            }
            target.effects.push(action.effect);
            handleEffectEvent('onAttach', {
              target: target,
              effect: action.effect,
              player: player,
              otherPlayer: otherPlayer,
            });
            log('{me} played a '+source.name+' on a '+target.name);
            break;
          case 'cleanse':
            if (target.name === 'mother ship') {
              throw 'Cannot use this on the mother ship';
            }
            if (target.effects !== undefined) {
              for (let effect of target.effects) {
                handleEffectEvent('onDetach', {
                  target: target,
                  effect: effect,
                  player: player,
                  otherPlayer: otherPlayer,
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
            if (source.copyId === target.copyId) {
              throw 'Cannot consume itself';
            }
            consume(source, target.copyId);
            break;
          case 'reactorUpgrade':
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
      else if (move.type === 'togglePower') {
        if (state.turnPlayerId != player.userId) {
          throw 'Wrong turn';
        }

        var card = exports.getPlayerPermanent(state, player.userId,
            move.card);

        if (card.tapped) {
          throw 'Cannot toggle power of tapped card';
        }

        card.powered = !card.powered;
        updatePower(player, false);

        if (player.powerUsed > player.powerTotal) {
          throw 'Not enough available power';
        }

        log('{me} powered '+(card.powered ? 'on' : 'off')+' a '+card.name);
      } else if (move.type === 'shields') {
        if (state.turnPlayerId != player.userId) {
          throw 'Wrong turn';
        }

        var card = exports.getPlayerPermanent(state, player.userId,
            move.card);

        if (card.types.contains('black_hole')) {
          throw 'Cannot shield a black hole';
        }

        card.shields = Math.max(card.shields + move.delta, 0);

        updatePower(player, false);

        if (player.powerUsed > player.powerTotal ||
            player.shieldsUsed > player.shieldsTotal) {
          throw 'Not enough available power or shields';
        }

        log('{me} '+(move.delta > 0 ? 'added' : 'removed')+' shields from a '+
            card.name);
      }
      else {
        throw 'Unrecognized move type ' + move.type;
      }
    }

    updatePower(player, true);
    updatePower(otherPlayer, true);

    // Accept move and replace old state with new one
    game.moves.push(move);
    game.state = state;
  };

  // Strip out secrets from a state for sending to the given player
  exports.stripState = function(state, destPlayerId) {
    var state = exports.cloneState(state);

    for (var pId in state.players) {
      if (!state.players.hasOwnProperty(pId) || pId == destPlayerId) {
        continue;
      }

      var otherPlayer = state.players[pId];

      for (var i = 0; i < otherPlayer.hand.length; i++) {
        otherPlayer.hand[i] = {name: '?'};
      }
    }

    return state;
  };

  exports.nextPlayer = function(game, playerId) {
    return game.playerIDs[(game.playerIDs[0] == playerId) | 0];
  };
})(exports === undefined ? this['state'] = {} : exports);
