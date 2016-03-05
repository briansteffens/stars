var fs = require('fs');
var seedrandom = require('seedrandom');

var cards = require('./cards.js');
var state = require('./state.js');

var sessions = {
  'a': {
    user_id: 3,
  },
  'b': {
    user_id: 7,
  },
};

var users = {
  3: {
    username: 'brian',
  },
  7: {
    username: 'evilbrian',
  },
};

var games = [{
  id: 0,
  name: 'The first game ever!',
  player_ids: [3, 7],
  sockets: {
    3: undefined,
    7: undefined,
  },
  chats: [],
  moves: [],
  explore_rng: seedrandom('greetings'),
  state: {
    winner: undefined,
    turn: 0,
    turn_player_id: 3,
    phase: 'main',
    draw_possible: 7,
    can_explore: 1,
    attacks: [],
    players: {
      3: {
        user_id: 3,
        hand: [],
        deck: [],
        permanents: [],
        scrap: 1,
        cant_play: [],
        power_used: 0,
        power_total: 0,
      },
      7: {
        user_id: 7,
        hand: [],
        deck: [],
        permanents: [],
        scrap: 1,
        cant_play: [],
        power_used: 0,
        power_total: 0,
      },
    },
  },
}];

var all_cards = cards.all();

var random_pool = [];
for (var i = 0; i < all_cards.length; i++) {
  var chance = typeof all_cards[i]._draw_chances === 'undefined' ?
               1 : all_cards[i]._draw_chances;

  for (var j = 0; j < chance; j++) {
    random_pool.push(all_cards[i]);
  }
}

function random_card() {
  return random_pool[Math.floor(Math.random() * random_pool.length)];
}

function next_card() {
  var card = JSON.parse(JSON.stringify(random_card()));
  card.copy_id = next_card.next_id++;
  card.tapped = false;
  card.powered = false;
  return card;
}
next_card.next_id = 0;

for (var i = 0; i < 50; i++) {
  games[0].state.players[3].deck.push(next_card());
  games[0].state.players[7].deck.push(next_card());
}

function next_mother_ship() {
  var ret = cards.mother_ship();
  ret.copy_id = next_card.next_id++;
  return ret;
}
games[0].state.players[3].permanents.push(next_mother_ship());
games[0].state.players[7].permanents.push(next_mother_ship());

console.log(games[0].state.players[3]);
console.log(games[0].state.players[7]);

require('http').createServer(function(req, res) {
  var url = require('url').parse(req.url, true);
  console.log("request: " + req.method + " " + req.url);

  var serveStatic = function(fn, headers, content_type) {
    if (typeof headers === 'undefined') {
      headers = {};
    }
    if (typeof content_type === 'undefined') {
      headers['Content-Type'] = 'text/html';
    } else {
      headers['Content-Type'] = content_type;
    }
    headers['Content-Length'] = fs.statSync(fn).size;
    res.writeHead(200, headers);
    return fs.createReadStream(fn).pipe(res);
  };

  if (url.pathname === '/') {
    if (!(url.query.session in sessions)) {
      console.log('Bad session');
      res.writeHead(500);
      res.end();
    }
    return serveStatic('src/index.html', {
      'Set-Cookie': 'session_id=' + url.query.session,
    });
  }

  var cookies = require('cookie').parse(req.headers.cookie);
  var session = sessions[cookies.session_id];

  if (url.pathname === '/games') {
    var game_list = [];

    for (var i = 0; i < games.length; i++) {
      for (var j = 0; j < games[i].player_ids.length; j++) {
        if (games[i].player_ids[j] == session.user_id) {
          var game_temp = {
            id: games[i].id,
            name: games[i].name,
            players: [],
          };
          for (var k = 0; k < games[i].player_ids.length; k++) {
            game_temp.players.push({
              user_id: games[i].player_ids[k],
            });
          }
          game_list.push(game_temp);
          continue;
        }
      }
    }
    console.log(game_list);
    for (var x = 0; x < game_list.length; x++) {
      for (var y = 0; y < game_list[x].players.length; y++) {
        console.log(game_list[x].players[y]);
      }
    }
    var json = JSON.stringify({'games': game_list});

    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Content-Length': json.length,
    });

    res.end(json);
  }
  else if (url.pathname.startsWith('/game/socket.js')) {
    return serveStatic('src/socket.js');
  }
  else if (url.pathname.startsWith('/game/style.css')) {
    return serveStatic('src/style.css', {}, 'text/css');
  }
  else if (url.pathname.startsWith('/game/view.js')) {
    return serveStatic('src/view.js');
  }
  else if (url.pathname.startsWith('/game/')) {
    var game_id = url.pathname.replace('/game/', '');
    var game = undefined;
    for (var i = 0; i < games.length; i++) {
      if (games[i].id == game_id) {
        game = games[i];
        break;
      }
    }
    if (typeof game === 'undefined') {
      res.writeHead(404);
      res.end();
    }
    return serveStatic('src/game.html');
  }
  else if (url.pathname.startsWith('/state.js')) {
    return serveStatic('src/state.js');
  }
  else {
    res.writeHead(404);
    res.end();
  }
}).listen(80);

var wss = new require('ws').Server({port: 8080});
wss.on('connection', function(ws) {
  var session = undefined;
  var game = undefined;
  var player_id = undefined;
  var user = undefined;

  // Add implicit properties to a move originating from a client
  var fill_in = function(move) {
    move.user_id = player_id;
    move.turn = state.current_turn(game);
    return move;
  };

  var send = function(payload, to_player) {
    if (typeof to_player === 'undefined') {
      to_player = player_id;
    }
    var socket = game.sockets[to_player];
    if (typeof socket === 'undefined') {
      return;
    }
    console.log(payload);
    socket.send(JSON.stringify(payload), function ack(error) {
      if (typeof error === 'undefined') {
        return;
      }
      if (error.message === 'not opened') {
        game.sockets[to_player] = undefined;
        console.log('player %s disconnected', to_player);
        return;
      }
      throw error;
    });
  };

  var send_state = function(to_player) {
    send({
      type: 'state',
      state: state.strip_state(game.state, to_player),
    }, to_player);
  };

  ws.on('message', function(message) {
    console.log('session %s: %s', session, message);
    var msg = JSON.parse(message);
    if (msg.type === 'hello') {
      console.log('session %s says hello', msg.session_id);
      session = sessions[msg.session_id];
      user = users[session.user_id];
      outer: for (var i = 0; i < games.length; i++) {
        for (var j = 0; j < games[i].player_ids.length; j++) {
          if (games[i].player_ids[j] == session.user_id) {
            game = games[i];
            player_id = game.player_ids[j];
            break outer;
          }
        }
      }
      if (typeof game === 'undefined') {
        console.log('Game not found.');
        send({type: 'error', text: 'Game not found'});
        return;
      }
      game.sockets[player_id] = ws;
      console.log('user_id %s connected to game %s', session.user_id, game.id);
      send({
        type: 'greetings',
        user_id: session.user_id,
        username: user.username,
      });
      send({type: 'chats', chats: game.chats});
      send_state(player_id);
    }
    else if (msg.type === 'chat') {
      var newMessage = {
        type: 'chat',
        chat: {
          username: user.username,
          timestamp: Date.now(),
          text: msg.text,
        }
      };
      game.chats.splice(0, 0, newMessage.chat);
      for (var i = 0; i < game.player_ids.length; i++) {
        if (typeof game.sockets[game.player_ids[i]] !== 'undefined') {
          send(newMessage, game.player_ids[i]);
        }
      }
    }
    else if (msg.type === 'yield' || msg.type === 'draw' ||
        msg.type === 'play' || msg.type === 'attack' ||
        msg.type === 'defend' || msg.type === 'toggle_power' ||
        msg.type === 'explore') {
      msg = fill_in(msg);
      try {
        state.apply_move(game, msg);
      } catch (ex) {
        console.log("EXCEPTION in apply_move: " + ex);
      }
      send_state(player_id);
      send_state(state.next_player(game, player_id));
    }
    else {
      console.log('unrecognized message type: %s', message);
    }
  });
});
