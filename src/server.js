var express = require('express');
var passport = require('passport');
var Strategy = require('passport-local').Strategy;
var crypto = require('crypto');

var user_list = {
  3: 'brian',
  7: 'jeremy',
  13: 'levi',
};

passport.use(new Strategy(function(username, password, cb) {
  if (password !== 'password') {
    return cb('Wrong password');
  }

  let user_id = null;

  for (let user_id in user_list) {
    if (user_list.hasOwnProperty(user_id)) {
      if (user_list[user_id] == username) {
        return cb(null, {
          id: user_id,
          username: user_list[user_id],
        });
      }
    }
  }

  return cb('Wrong username');
}));

passport.serializeUser(function(user, cb) {
  cb(null, user.id);
});

passport.deserializeUser(function(user_id, cb) {
  cb(null, {
    id: user_id,
    username: user_list[user_id]
  });
});

var app = express();

app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');

//app.use(require('morgan')('combined'));
app.use(require('cookie-parser')());
app.use(require('body-parser').urlencoded({ extended: true}));
app.use(require('express-session')({secret: 'keyboard cat', resave: false,
  saveUnitialized: false}));

app.use(passport.initialize());
app.use(passport.session());

app.use(express.static('src/static'));

app.get('/', function(req, res) {
  res.redirect('/games');
});

app.get('/login', function(req, res) {
  res.render('login');
});

app.get('/games', function(req, res) {
  if (req.user === undefined) {
    return res.redirect('/login');
  }
  res.render('games', {user: req.user});
});

app.post('/login',
  passport.authenticate('local', { failureRedirect: '/login?fail=1' }),
  function(req, res) {
    res.redirect('/');
  }
);

app.get('/game_list', function(req, res) {
  if (req.user === undefined) {
    return res.redirect('/login');
  }

  var game_list = [];

  for (var i = 0; i < games.length; i++) {
    for (var j = 0; j < games[i].player_ids.length; j++) {
      if (games[i].player_ids[j] == req.user.id) {
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

  for (var x = 0; x < game_list.length; x++) {
    for (var y = 0; y < game_list[x].players.length; y++) {
      console.log(game_list[x].players[y]);
    }
  }

  res.json({'games': game_list});
});

let expire_tokens = function(tokens) {
  let to_delete = [];

  for (let token in tokens) {
    if (tokens.hasOwnProperty(token)) {
      if (Date.now() - tokens[token].created > 5 * 60 * 1000) {
        to_delete.push(token);
      }
    }
  }

  for (let token in to_delete) {
    delete tokens[token];
  }
};

app.get('/game/:game_id', function(req, res) {
  if (req.user === undefined) {
    return res.redirect('/login');
  }

  let game = null;

  for (let i = 0; i < games.length; i++) {
    if (games[i].id == req.params.game_id) {
      game = games[i];
      break;
    }
  }

  if (game === null ||
      game.state.players[req.user.id] === undefined) {
    return res.status(404).send('Not found');
  }

  expire_tokens(tokens);

  let random_base64 = function(len) {
    return crypto.randomBytes(Math.ceil(len * 3 / 4))
      .toString('base64')
      .slice(0, len)
      .replace(/\+/g, '-')
      .replace(/\//g, '_');
  }

  let token = random_base64(10);

  tokens[token] = {
    game_id: game.id,
    user_id: req.user.id,
    created: Date.now(),
  };

  res.render('game', {
    user: req.user,
    token: token
  });
});

app.listen(8080);

var fs = require('fs');
var seedrandom = require('seedrandom');

var cards = require('./cards.js');
var state = require('./state.js');

var tokens = {};

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
  rng: seedrandom(Math.random()),
  state: {
    winner: undefined,
    turn: -1,
    turn_player_id: null,
    phase: 'pre-game',
    draw_possible: 0,
    can_explore: 0,
    attacks: [],
    next_copy_id: 0,
    players: {
      3: {
        user_id: 3,
        hand: [],
        deck: [],
        permanents: [],
        scrap: 0,
        cant_play: [],
        power_used: 0,
        power_total: 0,
        shields_used: 0,
        shields_total: 0,
        ready: false,
        mull_penalty: -1,
      },
      7: {
        user_id: 7,
        hand: [],
        deck: [],
        permanents: [],
        scrap: 0,
        cant_play: [],
        power_used: 0,
        power_total: 0,
        shields_used: 0,
        shields_total: 0,
        ready: false,
        mull_penalty: -1,
      },
    },
  },
}];

var all_cards = cards.all();

var random_pool = cards.pool(all_cards);

function random_card() {
  return random_pool[Math.floor(Math.random() * random_pool.length)];
}

function next_card() {
  var card = JSON.parse(JSON.stringify(random_card()));
  card.copy_id = games[0].state.next_copy_id++;
  card.tapped = false;
  card.powered = false;
  return card;
}

for (var i = 0; i < 50; i++) {
  games[0].state.players[3].deck.push(next_card());
  games[0].state.players[7].deck.push(next_card());
}

function next_mother_ship() {
  var ret = cards.mother_ship();
  ret.copy_id = games[0].state.next_copy_id++;
  return ret;
}
games[0].state.players[3].permanents.push(next_mother_ship());
games[0].state.players[7].permanents.push(next_mother_ship());

var wss = new require('ws').Server({port: 8081});
wss.on('connection', function(ws) {
  var token_data = undefined;
  var game = undefined;
  var player_id = undefined;
  var user = undefined;

  // Add implicit properties to a move originating from a client
  var fill_in = function(move) {
    move.user_id = player_id;
    move.turn = state.turn;
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
    var msg = JSON.parse(message);
    if (msg.type === 'hello') {
      console.log('session %s says hello', msg.token);
      expire_tokens(tokens);
      token_data = tokens[msg.token];
      delete tokens[msg.token];
      if (token_data === undefined) {
        throw 'Invalid token';
      }
      user = {
        id: token_data.user_id,
        username: user_list[token_data.user_id],
      };
      outer: for (var i = 0; i < games.length; i++) {
        if (games[i].id == token_data.game_id) {
          game = games[i];
          for (var j = 0; j < game.player_ids.length; j++) {
            if (game.player_ids[j] == token_data.user_id) {
              player_id = game.player_ids[j];
              break outer;
            }
          }
        }
      }

      if (player_id === undefined) {
        console.log('Game not found.');
        send({type: 'error', text: 'Game not found'});
        return;
      }

      game.sockets[player_id] = ws;
      console.log('user_id %s connected to game %s', user.id, game.id);
      send({
        type: 'greetings',
        user_id: user.id,
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
    else {
      msg = fill_in(msg);
      try {
        state.apply_move(game, msg);
      } catch (ex) {
        console.log("EXCEPTION in apply_move: " + ex);
      }
      send_state(player_id);
      send_state(state.next_player(game, player_id));
    }
  });
});
