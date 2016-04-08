var express = require('express');
var passport = require('passport');
var Strategy = require('passport-local').Strategy;
var crypto = require('crypto');
var seedrandom = require('seedrandom');
var bcrypt = require('bcryptjs');
var redis = require("redis").createClient();
var mongojs = require('mongojs');
var nodemailer = require('nodemailer');
require('./static/common.js');
var cards = require('./cards.js');
var state = require('./state.js');
var config = require('./config.js');

const DEBUG = process.argv.contains('--debug');
const MAX_KEY_ATTEMPTS = 5;
const GAME_TOKEN_TTL = 5 * 60;
const EMAIL_CONFIRM_TTL = 24 * 60;

// Setup mongo database connection
var db = mongojs('stars', ['users']);

db.users.remove();

function make_unique(field, options, cb) {
  db.users.createIndex([field], options, function(err, list) {
    if (err) {
      throw 'Error making '+field+' unique';
    }
    cb();
  });
}

make_unique('email', {unique: true}, function() {
  make_unique('username', {unique: true}, function() {
    make_unique('verification_code', {unique: true,sparse: true}, function() {
      db.users.save({
        username: 'brian',
        email: 'brian@asdf.com',
        password: bcrypt.hashSync('password'),
      });
      db.users.save({
        username: 'jeremy',
        email: 'jeremy@asdf.com',
        password: bcrypt.hashSync('password'),
      });
      db.users.save({
        username: 'levi',
        email: 'levi@asdf.com',
        password: bcrypt.hashSync('password'),
      });
    });
  });
});

// Email config
var transporter = nodemailer.createTransport(config.mail.transport);

var games = [];

var all_cards = cards.all();
var explore_cards = cards.explore();
var random_pool = cards.pool(all_cards);

/* Return a redis callback that logs any found error in a standardized format
 * with [msg] as descriptive text, then calls the optional [cb] callback
 * with signature (err, res).
 */
function redis_err(msg, cb) {
  return function(err, res) {
    if (err) {
      console.log('REDIS ERROR: '+msg+'\n err: ['+err+']\n res: ['+res+']\n');
    }

    if (cb) {
      cb(err, res);
    }
  }
}

/* Store [val] in redis with a generated base64 key of length [key_len] with
 * a prefix of "[prefix]_".
 *
 * [cb] should be a function with the signature (err, key). [err] will be
 * non-null if a unique key could not be generated. [key] will contain the
 * generated key if [err] is null.
 */
function redis_set(prefix, key_len, val, ttl, cb) {
  let tries = MAX_KEY_ATTEMPTS;

  let attempt = function() {
    let key = prefix + '_' + random_base64(key_len);

    redis.set(key, val, 'NX', 'EX', ttl, function(err, res) {
      if (res !== 'OK') {
        tries--;
        if (tries <= 0) {
          cb('Max attempts exceeded trying to generate a unique key', null);
        }
        attempt();
        return;
      }

      cb(null, key);
    });
  };

  attempt();
}

function get_user_by_id(id, cb) {
  db.users.findOne({_id: mongojs.ObjectId(id)}, function(err, doc) {
    if (err) {
      throw 'Unable to find user id: '+id;
    }

    cb(doc);
  });
}

/* Send email from the configured user
 *
 * cb should have a signature of (err, info)
 */
function email(to, subject, text, cb) {
  var options = {
    from: config.mail.from,
    to: to,
    subject: subject,
    text: text,
  };

  transporter.sendMail(options, cb);
}

function random_base64(len) {
  return crypto.randomBytes(Math.ceil(len * 3 / 4))
    .toString('base64')
    .slice(0, len)
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function generate_id(len, collision_check) {
  let id = null;

  do {
    id = random_base64(len);
  } while (collision_check(id));

  return id;
}

passport.use(new Strategy(function(username, password, cb) {
  db.users.findOne({username: username}, function(err, doc) {
    if (err) {
      return cb('Invalid username');
    }

    bcrypt.compare(password, doc.password, function(err, res) {
      if (!res) {
        return cb('Invalid password');
      } else {
        return cb(null, doc);
      }
    });
  });
}));

passport.serializeUser(function(user, cb) {
  cb(null, user._id.toString());
});

passport.deserializeUser(function(user_id, cb) {
  get_user_by_id(user_id, function(user) {
    cb(null, user);
  });
});

var app = express();

app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');

app.use(require('cookie-parser')());
app.use(require('body-parser').urlencoded({ extended: true}));
app.use(require('body-parser').json());
app.use(require('express-session')({secret: 'keyboard cat', resave: false,
  saveUnitialized: false}));

app.use(passport.initialize());
app.use(passport.session());

app.use(express.static('src/static'));

app.get('/', function(req, res) {
  res.redirect('/games');
});

app.get('/register', function(req, res) {
  res.render('register');
});

app.post('/register', function(req, res) {
  let errors = [];

  if (req.body.username.length < 3) {
    errors.push('Username must be at least 3 characters');
  }

  if (req.body.password.length < 6) {
    errors.push('Password must be at least 6 characters');
  }

  if (req.body.password !== req.body.password_confirm) {
    errors.push('Passwords must match');
  }

  // Check username availability
  db.users.findOne({username: req.body.username}, function(err, doc) {
    if (doc) {
      errors.push('Username is already taken');
    }

    let render_errors = function(errors) {
      res.render('register', {
        email: req.body.email,
        username: req.body.username,
        errors: errors,
      });
    }

    // Check email availability
    db.users.findOne({email: req.body.email}, function(err, doc) {
      if (doc) {
        errors.push('Email already registered');
      }

      if (errors.length > 0) {
        return render_errors(errors);
      } else {
        // Process registration
        let verification_code = random_base64(32);

        bcrypt.hash(req.body.password, 8, function(err, hash) {
          db.users.save({
            email: req.body.email,
            username: req.body.username,
            password: hash,
            registered_at: Date.now(),
            verified_at: null,
            verification_code: verification_code,
          }, function(err, list) {
            if (err) {
              console.log('Error inserting user: ' + err);
              return render_errors([
                  'Unknown error creating the account, please try again']);
            }

            let body = 'Thanks for registering! Verify your email address by '+
                       'clicking here: ' + config.external_url + 'register/' +
                       verification_code;

            email(req.body.email, 'stars: verify email address', body,
                function(err, info) {
              if (err) {
                console.log('MAIL ERROR: ' + err);
                return render_errors([
                    'Unknown error sending a verify email, please try again']);
              }

              console.log('MAIL SENT: ' + info.response);
              res.render('registered');
            });
          });
        });
      }
    });
  });
});

app.get('/register/:code', function(req, res) {
  db.users.findOne({verification_code: req.params.code}, function(err, user) {
    if (err || !user || user.verified_at) {
      return res.render('register_fail');
    }

    user.verification_code = null;
    user.verified_at = Date.now();

    db.users.save(user, function(err, doc) {
      if (err) {
        return res.render('register_fail');
      }

      return res.render('register_complete');
    });
  });
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

let games_info = function(user_id, cb) {
  var game_list = [];
  for (var i = 0; i < games.length; i++) {
    for (var j = 0; j < games[i].player_ids.length; j++) {
      if (games[i].player_ids[j] == user_id) {
        var game_temp = {
          id: games[i].id,
          name: games[i].name,
          players: [],
          state: {
            winner: games[i].state.winner,
          },
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

  db.users.find({_id: {$ne: mongojs.ObjectId(user_id)}}, function(err, docs) {
    if (err) {
      throw 'Error getting user list';
    }

    cb({
      games: game_list,
      users: docs,
    });
  });
};

app.get('/games/info', function(req, res) {
  if (req.user === undefined) {
    return res.redirect('/login');
  }

  games_info(req.user._id.toString(), function(r) {
    res.json(r);
  });
});

app.post('/games/new', function(req, res) {
  if (req.user === undefined) {
    return res.redirect('/login');
  }

  let game = {
    id: null,
    name: req.body.name,
    player_ids: [req.user._id.toString(), req.body.against],
    sockets: {},
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
      players: {},
      log: [],
    },
  };

  game.id = generate_id(5, function(id) {
    for (let g of games) {
      if (g.id == id) {
        return true;
      }
    }
    return false;
  });

  game.sockets[req.user._id.toString()] = undefined;
  game.sockets[req.body.against] = undefined;

  let make_player = function(id, cb) {
    get_user_by_id(id, function(user) {
      cb({
        user_id: user._id.toString(),
        user_name: user.username,
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
      });
    });
  }

  make_player(req.user._id, function(user1) {
    game.state.players[req.user._id] = user1;

    make_player(req.body.against, function(user2) {
      game.state.players[req.body.against] = user2;

      let random_card = function() {
        return random_pool[Math.floor(Math.random() * random_pool.length)];
      }

      let find_card = function(name) {
        for (let coll of [all_cards, explore_cards]) {
          for (let card of coll) {
            if (card.name == name) {
              return card;
            }
          }
        }
        throw 'Cannot find card ['+name+']';
      }

      let next_card = function(card) {
        var card = JSON.parse(JSON.stringify(card));
        card.copy_id = game.state.next_copy_id++;
        card.tapped = false;
        card.powered = false;
        return card;
      }

      let next_mother_ship = function() {
        var ret = cards.mother_ship();
        ret.copy_id = game.state.next_copy_id++;
        return ret;
      }

      let player_ids = [req.user._id.toString(), req.body.against];

      for (let player_id of player_ids) {
        for (var i = 0; i < 50; i++) {
          game.state.players[player_id].deck.push(next_card(random_card()));
        }

        game.state.players[player_id].permanents.push(next_mother_ship());
      }

      if (DEBUG) {
        let initial = ['blue supergiant','brown dwarf','desert planet',
          'red giant','rocky planet','white dwarf','yellow dwarf'];

        for (let name of initial) {
          game.state.players[req.user._id].hand.push(
              next_card(find_card(name)));
        }
      }
      else {
        for (let player_id of player_ids) {
          state.apply_move(game, {
            type: 'mull',
            user_id: player_id,
            turn: game.state.turn,
          });
        }
      }

      games.push(game);

      games_info(req.user._id.toString(), function(r) {
        res.json(r);
      });
    });
  });
});

app.get('/game', function(req, res) {
  if (req.user === undefined) {
    return res.redirect('/login');
  }

  let game = null;

  for (let i = 0; i < games.length; i++) {
    if (games[i].player_ids.contains(req.user._id.toString())) {
      game = games[i];
      break;
    }
  }

  if (game === null) {
    return res.status(404).send('Not found');
  }

  let token_data = JSON.stringify({
    game_id: game.id,
    user_id: req.user._id.toString(),
  });

  redis_set('wstoken', 10, token_data, GAME_TOKEN_TTL, function(err, token) {
    if (err) {
      console.log('Error generating token: ' + err);
      return res.status(500).send('Error generating token');
    }

    res.render('game', {
      user: req.user,
      token: token.replace('wstoken_', ''),
    });
  });
});

app.listen(8080);

var wss = new require('ws').Server({port: 8081});
wss.on('connection', function(ws) {
  let token_data = undefined;
  let game = undefined;
  let player_id = undefined;
  let user = undefined;

  // Add implicit properties to a move originating from a client
  var fill_in = function(move) {
    move.user_id = player_id;
    move.turn = state.turn;
    return move;
  };

  var send = function(payload, to_player) {
    if (to_player === undefined) {
      to_player = player_id;
    }
    var socket = game.sockets[to_player];
    if (socket === undefined) {
      return;
    }
    socket.send(JSON.stringify(payload), function ack(error) {
      if (error === undefined) {
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
    if (msg.type === 'connect') {
      redis.get('wstoken_' + msg.token, redis_err('token get failed',
            function(err, res) {
        if (err || res === null) {
          return send({type: 'error', text: 'Invalid or expired token'});
        }

        token_data = JSON.parse(res);
        redis.del(msg.token, redis_err('token delete failed'));

        get_user_by_id(token_data.user_id, function(user_) {
          user = user_;

          if (msg.page === 'game') {
            outer: for (let i = 0; i < games.length; i++) {
              if (games[i].id == token_data.game_id) {
                game = games[i];
                for (let j = 0; j < game.player_ids.length; j++) {
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
            console.log('user_id %s connected to game %s', user._id, game.id);
            send({
              type: 'greetings',
              user_id: user._id,
              username: user.username,
            });
            send({type: 'chats', chats: game.chats});
            send_state(player_id);
          } else {
            send({type: 'error', text: 'Unrecognized page'});
          }
        });
      }));
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
        if (game.sockets[game.player_ids[i]] !== undefined) {
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
