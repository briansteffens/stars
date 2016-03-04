var View = React.createClass({
  getInitialState: function() {
    return {
      game: null,
      attacker: null,
    };
  },
  get_permanent: function(copy_id) {
    for (let player_id of Object.keys(this.state.game.players)) {
      for (let perm of this.state.game.players[player_id].permanents) {
        if (perm.copy_id == copy_id) {
          return perm;
        }
      }
    }
    throw 'Permanent ' + copy_id + ' not found';
  },
  render_canvas: function() {
    var canvas = document.getElementById('canvas');
    var ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    if (this.state.game === null) {
      return;
    }

    let game = this.state.game;

    ctx.strokeStyle = 'rgb(200, 0, 0)';

    var draw_attack_line = function(top_el, bottom_el) {
      ctx.beginPath();
      ctx.moveTo(top_el.offsetLeft + top_el.offsetWidth / 2,
                 top_el.offsetTop + top_el.offsetHeight);
      ctx.lineTo(bottom_el.offsetLeft + bottom_el.offsetWidth / 2,
                 bottom_el.offsetTop);
      ctx.stroke();
    };

    var my_turn = game.turn_player_id == game_info.user_id;

    for (let attack of game.attacks) {
      let attacker_el = document.getElementById('perm_'+attack.attacker);
      let target_el = document.getElementById('perm_'+attack.target);

      if (my_turn && game.phase === 'main' ||
          !my_turn && game.phase === 'defend') {
        draw_attack_line(attacker_el, target_el);
      } else {
        draw_attack_line(target_el, attacker_el);
      }
    }
  },
  componentDidUpdate: function() {
    setTimeout(this.render_canvas());
  },
  set_state: function(game_state) {
    this.setState({
      game: game_state,
      attacker: this.state.attacker,
    });
  },
  yield: function(e) {
    socket.send(JSON.stringify({type: 'yield'}));
  },
  draw: function(e) {
    socket.send(JSON.stringify({type: 'draw'}));
  },
  play: function(card, e) {
    socket.send(JSON.stringify({type: 'play',copy_id: card.copy_id}));
  },
  attack_start: function(card, e) {
    this.setState({
      game: clone(this.state.game),
      attacker: card,
    });
  },
  attack_finish: function(target, e) {
    socket.send(JSON.stringify({
      type: 'attack',
      attacker: this.state.attacker.copy_id,
      target: target.copy_id,
    }));
    this.setState({
      game: clone(this.state.game),
      attacker: null,
    });
  },
  toggle_power: function(card, e) {
    socket.send(JSON.stringify({
      type: 'toggle_power',
      card: card.copy_id,
    }));
  },
  defend: function(e) {
    socket.send(JSON.stringify({type: 'defend'}));
  },
  render: function() {
    console.log(this.state);

    var game = this.state.game;

    if (typeof game_info === 'undefined' || game === null) {
      return (<i>Connecting..</i>);
    }

    var that = this;

    var me = game.players[game_info.user_id];

    var enemy = null;
    for (let key in game.players) {
      if (game.players.hasOwnProperty(key) &&
          key != game_info.user_id) {
        enemy = game.players[key];
        break;
      }
    }
    if (enemy === null) {
      throw 'enemy not found';
    }

    var hand = [];
    for (let i = 0; i < me.hand.length; i++) {
      hand.push(
        <strong key={i}>
          {me.hand[i].name+" "}
          <input type="button" onClick={that.play.bind(this, me.hand[i])}
            value="play" />
        </strong>
      );
    }

    var my_turn = game.turn_player_id == game_info.user_id;
    var draw_possible = my_turn ? game.draw_possible : 0;

    let render_permanents = function(perms, are_mine) {
      let ret = [];

      let can_attack = my_turn && that.state.attacker === null;
      let is_attacking = my_turn && that.state.attacker !== null;

      for (let i = 0; i < perms.length; i++) {
        var attack_with = '';
        if (are_mine && typeof perms[i].attack !== 'undefined') {
          attack_with = (
            <input type="button" value="fire"
              disabled={!can_attack || perms[i].tapped || !perms[i].powered ||
                        game.phase !== 'main'}
              onClick={that.attack_start.bind(null, perms[i])} />
          );
        }

        var attack = '';
        if (is_attacking && !are_mine &&
            typeof perms[i].defense !== 'undefined') {
          attack = (
            <input type="button" value="attack"
              onClick={that.attack_finish.bind(null, perms[i])} />
          );
        }

        let or_zero = function(v) { return typeof v !== 'undefined' ? v : 0 };
        let stats = or_zero(perms[i].attack) + '/' + or_zero(perms[i].defense);

        let classes = 'permanent';
        if (perms[i].type === 'generator') {
          classes += ' generator';
        }

        let power = '';
        if (perms[i].upkeep !== undefined) {
          power = (
            <input type="button"
              value={perms[i].powered ? "power off" : "power on"}
              onClick={that.toggle_power.bind(null, perms[i])} />
          );
        }

        ret.push(
          <div key={i} id={'perm_' + perms[i].copy_id} className={classes}>
            {attack}
            <div className="title">{perms[i].name+" "}</div>
            <div>{stats}</div>
            {power}
            {attack_with}
          </div>
        );
      }
      return ret;
    };

    let permanents = render_permanents(me.permanents, true);
    let enemy_permanents = render_permanents(enemy.permanents);

    let gameover = '';
    if (typeof game.winner !== 'undefined') {
      console.log(game.winner);
      let outcome = game.winner == game_info.user_id ? 'won' : 'lost';
      gameover = (
        <h3>Game over! You {outcome}!</h3>
      );
    }

    let render_power = function(player) {
      return (
        <span className="power">{player.power_used}/{player.power_total}</span>
      );
    };

    return (
      <div>
        <div>
          {gameover}
          It is <strong>{my_turn ? '' : 'not '}your turn</strong>.
          Phase: <strong>{game.phase}</strong>
          <input type="button" onClick={this.defend} value="defend"
            disabled={!my_turn || game.phase !== 'defend'} />
          <input type="button" onClick={this.yield} value="yield"
            disabled={!my_turn} />
        </div>
        <div>Scrap: {me.scrap}</div>
        <div>Power: {render_power(me)}</div>
        <div>
          You can draw {draw_possible} cards.
          <input type="button" onClick={this.draw} value="draw"
            disabled={!draw_possible} />
        </div>
        <div>Your hand: {hand}</div>
        <div>{permanents}</div>
        <div className="player_separator"></div>
        <div>{enemy_permanents}</div>
        <div>Enemy scrap: {enemy.scrap}</div>
        <div>Enemy power: {render_power(enemy)}</div>
        <div>Enemy hand: {enemy.hand.length} cards</div>
      </div>
    );
  },
});

var Chat = React.createClass({
  getInitialState: function() {
    return {chats: []};
  },
  add: function(msg) {
    this.setState({chats: [msg, ...this.state.chats]});
  },
  send: function(e) {
    e.preventDefault();
    socket.send(JSON.stringify({
      type: 'chat',
      text: this.refs.message.value,
    }));
    this.refs.message.value = '';
  },
  render: function() {
    var chats = [];
    for (var i = this.state.chats.length - 1; i >= 0; i--) {
      var chat = this.state.chats[i];
      chats.push(
        <div key={i}>
          [{chat.timestamp}]
          <strong>{chat.username}</strong>:
          {chat.text}
        </div>
      );
    }
    return (
      <form onSubmit={this.send}>
        {chats}
        <input type="text" placeholder="enter a message" ref="message" />
        <input type="submit" value="send" />
      </form>
    );
  },
});

chat = ReactDOM.render(<Chat />, document.getElementById('chat'));
view = ReactDOM.render(<View />, document.getElementById('view'));
