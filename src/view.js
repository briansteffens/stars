var View = React.createClass({
  getInitialState: function() {
    return {
      game: null,
      source: null,
      action: null,
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
    ctx.lineWidth = 2;

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
      source: JSON.parse(JSON.stringify(this.state.source)),
      action: JSON.parse(JSON.stringify(this.state.action)),
    });
  },
  yield: function(e) {
    socket.send(JSON.stringify({type: 'yield'}));
  },
  draw: function(e) {
    socket.send(JSON.stringify({type: 'draw'}));
  },
  explore: function(e) {
    socket.send(JSON.stringify({type: 'explore'}));
  },
  play: function(card, e) {
    if (card.type === 'instant') {
      this.target_start(card, card.actions[0], e);
    } else {
      socket.send(JSON.stringify({type: 'play',copy_id: card.copy_id}));
    }
  },
  target_start: function(source, action, e) {
    this.setState({
      game: clone(this.state.game),
      action: action,
      source: source,
    });
  },
  target_finish: function(target, e) {
    socket.send(JSON.stringify({
      type: 'action',
      source: this.state.source.copy_id,
      action: this.state.action.name,
      target: target.copy_id,
    }));
    this.setState({
      game: clone(this.state.game),
      action: null,
      source: null,
    });
  },
  toggle_power: function(card, e) {
    socket.send(JSON.stringify({
      type: 'toggle_power',
      card: card.copy_id,
    }));
  },
  scrap: function(card, e) {
    socket.send(JSON.stringify({
      type: 'scrap',
      card: card.copy_id,
    }));
  },
  shields: function(card, delta, e) {
    socket.send(JSON.stringify({
      type: 'shields',
      card: card.copy_id,
      delta: delta,
    }));
  },
  defend: function(e) {
    socket.send(JSON.stringify({type: 'defend'}));
  },
  ready: function(e) {
    socket.send(JSON.stringify({type: 'ready'}));
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

    var my_turn = game.turn_player_id == game_info.user_id;
    var draw_possible = my_turn ? game.draw_possible : 0;

    let render_card = function(card, is_mine, is_perm) {
      let is_targeting = false;
      if (is_perm && my_turn && that.state.action !== null) {
        let targets = that.state.action.targeting;
        if (targets.indexOf('friendly') >= 0) {
          is_targeting = is_targeting ||
            is_mine && targets.indexOf(card.type) >= 0;
        }
        if (targets.indexOf('enemy') >= 0) {
          is_targeting = is_targeting ||
            !is_mine && targets.indexOf(card.type) >= 0;
        }
      }

      let or_zero = function(v) { return typeof v !== 'undefined' ? v : 0 };

      let stats = '';
      if (card.type === 'ship') {
        stats = or_zero(card.attack) + '/' + or_zero(card.hp);
      }

      let classes = 'permanent';
      if (card.type === 'generator') {
        classes += ' generator';
      }

      let generates = '';
      if (card.power !== undefined) {
        generates = (<div>generates {card.power}</div>);
      }

      let scrap = '';
      if (is_mine && card.type !== 'generator' &&
          card.name !== 'mother ship' && card.type !== 'resource') {
        scrap = (<input type="button" value="scrap" disabled={!my_turn}
            onClick={that.scrap.bind(null, card)} />);
      }

      let actions = [];
      let target = '';
      let power = '';
      let play = '';
      let shields = '';
      let effects = '';

      if (is_perm) {
        // Target button
        if (is_targeting) {
          target = (<input type="button" value="target"
              onClick={that.target_finish.bind(null, card)} />);
        }

        // Action buttons
        if (is_mine) {
          for (let i = 0; i < card.actions.length; i++) {
            let action = card.actions[i];
            let can_attack = is_perm && my_turn && that.state.action === null &&
                card.powered && !card.tapped;
            actions.push(
              <input type="button" value={action.name} key={action.name}
                onClick={that.target_start.bind(null, card, action)}
                disabled={!can_attack} />
            );
          }
        }

        // Power button
        if (is_mine && card.upkeep !== undefined) {
          let can_power = card.powered ||
                          me.power_used + card.upkeep <= me.power_total;

          power = (
            <input type="button"
              value={card.powered ? "power off" : "power on"}
              disabled={card.tapped || !can_power}
              onClick={that.toggle_power.bind(null, card)} />
          );
        }

        // Shields
        if (card.shields !== undefined && card.type !== 'generator') {
          shields = (<span>shields: {card.shields}</span>);

          if (is_mine) {
            shields = (
              <div className="shields">
                <input type="button" value="-"
                    onClick={that.shields.bind(null, card, -1)}
                    disabled={!my_turn || card.shields <= 0} />
                {shields}
                <input type="button" value="+"
                    onClick={that.shields.bind(null, card, 1)}
                    disabled={!my_turn ||
                              me.shields_total - me.shields_used <= 0 ||
                              me.power_total - me.power_used <= 0} />
              </div>
            );
          }
        }

        // Effects
        if (card.effects !== undefined) {
          let eles = [];

          for (let effect of card.effects) {
            eles.push(
              <div key={effect.name} className="effect">
                {effect.name}
              </div>
            );
          }

          effects = (<div>{eles}</div>);
        }
      }
      else {
        // Play button
        play = (<input type="button" onClick={that.play.bind(that, card)}
            value="play" />);
      }

      let upkeep = '';
      if (card.upkeep !== undefined) {
        upkeep = (<div>upkeep: {card.upkeep}</div>);
      }

      let cost = '';
      if (card.cost !== undefined) {
        cost = (<div>cost: {card.cost}</div>);
      }

      let worth = '';
      if (card.worth !== undefined) {
        worth = (<div>worth: {card.worth}</div>);
      }

      return (
        <div key={card.copy_id} id={'perm_' + card.copy_id} className={classes}>
          {target}
          <div className="title">{card.name+" "}</div>
          {effects}
          {generates}
          <div>{stats}</div>
          {cost}
          {upkeep}
          {worth}
          {power}
          {scrap}
          {play}
          {shields}
          {actions}
        </div>
      );
    };

    let render_permanents = function(perms, are_mine) {
      let ret = [];

      for (let i = 0; i < perms.length; i++) {
        ret.push(render_card(perms[i], are_mine, true));
      }

      return ret;
    };

    let permanents = render_permanents(me.permanents, true);
    let enemy_permanents = render_permanents(enemy.permanents);

    var hand = [];
    for (let i = 0; i < me.hand.length; i++) {
      hand.push(render_card(me.hand[i], true, false));
    }

    let gameover = '';
    if (typeof game.winner !== 'undefined') {
      let outcome = game.winner == game_info.user_id ? 'won' : 'lost';
      gameover = (<h3>Game over! You {outcome}!</h3>);
    }

    let render_power = function(player) {
      return (<span className="power">{player.power_used}/{player.power_total}
          </span>);
    };

    let render_shields = function(player) {
      return (<span className="shields">
          {player.shields_used}/{player.shields_total}</span>);
    }

    let explore_possible = my_turn ? game.can_explore : 0;

    let pregame = '';
    if (game.phase === 'pre-game') {
      pregame = (
        <input type="button" onClick={this.ready} value="ready"
          disabled={me.ready} />
      );
    }

    return (
      <div>
        {pregame}
        <div>
          {gameover}
          It is <strong>{my_turn ? '' : 'not '}your turn</strong>.
          Phase: <strong>{game.phase}</strong>
          <input type="button" onClick={this.defend} value="defend"
            disabled={!my_turn || game.phase !== 'defend'} />
          <input type="button" onClick={this.yield} value="yield"
            disabled={!my_turn || game.phase !== 'main'} />
        </div>
        <div>Scrap: {me.scrap}</div>
        <div>Power: {render_power(me)}</div>
        <div>Shields: {render_shields(me)}</div>
        <div>
          You can draw {draw_possible} cards.
          <input type="button" onClick={this.draw} value="draw"
            disabled={!draw_possible} />
        </div>
        <div>
          You can explore {explore_possible} times.
          <input type="button" onClick={this.explore} value="explore"
            disabled={!explore_possible} />
        </div>
        <div>Your hand:</div>
        <div>{hand}</div>
        <div className="hand_separator"></div>
        <div>{permanents}</div>
        <div className="player_separator"></div>
        <div>{enemy_permanents}</div>
        <div>Enemy scrap: {enemy.scrap}</div>
        <div>Enemy power: {render_power(enemy)}</div>
        <div>Enemy shields: {render_shields(enemy)}</div>
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

var body_el = document.getElementsByTagName('body').item(0);
body_el.onresize = view.render_canvas;
