(function(exports){
  exports.fill_in = function(cards) {
    for (var i = 0; i < cards.length; i++) {
      let card = cards[i];

      if (card.actions === undefined) {
        card.actions = [];
      }

      if (card.attack !== undefined) {
        var found = false;
        for (var j = 0; j < card.actions.length; j++) {
          if (card.actions[j].name === 'attack') {
            found = true;
            break;
          }
        }
        if (!found) {
          card.actions.push({
            name: 'attack',
            targeting: ['enemy', 'ship'],
          });
        }
      }

      if (card.shields === undefined) {
        card.shields = 0;
      }

      if (card.defense !== undefined) {
        card.hp = card.defense;
      }

      if (card.image === undefined) {
        card.image = 'black_hole.png';
      }
    }

    return cards;
  };

  exports.all = function() {
    return exports.fill_in([{
      name: 'exploratory drone',
      types: ['ship'],
      cost: 1,
      upkeep: 1,
      defense: 3,
      _draw_chances: 13,
    },{
      name: 'attack drone',
      types: ['ship'],
      cost: 1,
      upkeep: 1,
      attack: 1,
      defense: 0,
      _draw_chances: 23,
    },{
      name: 'fighter',
      types: ['ship'],
      cost: 2,
      upkeep: 2,
      attack: 2,
      defense: 3,
      _draw_chances: 25,
    },{
      name: 'bomber',
      types: ['ship'],
      cost: 4,
      upkeep: 3,
      attack: 4,
      defense: 3,
      _draw_chances: 18,
    },{
      name: 'glass cannon',
      types: ['ship'],
      cost: 5,
      upkeep: 5,
      attack: 5,
      defense: 0,
      _draw_chances: 2,
    },{
      name: 'laser turret',
      types: ['ship'],
      cost: 1,
      upkeep: 3,
      attack: 1,
      defense: 3,
      _draw_chances: 10,
    },{
      name: 'reaper',
      types: ['ship'],
      cost: 13,
      upkeep: 7,
      attack: 9,
      defense: 7,
      _draw_chances: 11,
    },{
      name: 'battlecruiser',
      types: ['ship'],
      cost: 2,
      upkeep: 2,
      attack: 3,
      defense: 2,
      _draw_chances: 20,
    },{
      name: 'dreadnought',
      types: ['ship'],
      cost: 9,
      upkeep: 6,
      attack: 5,
      defense: 8,
      _draw_chances: 14,
    },{
      name: 'frigate',
      types: ['ship'],
      cost: 7,
      upkeep: 5,
      attack: 3,
      defense: 5,
      _draw_chances: 18,
    },{
      name: 'raider',
      types: ['ship'],
      cost: 5,
      upkeep: 4,
      attack: 4,
      defense: 2,
      _draw_chances: 20,
    },{
      name: 'endbringer',
      types: ['ship'],
      cost: 17,
      upkeep: 11,
      attack: 13,
      defense: 7,
      _draw_chances: 7,
    },{
      name: 'crude reactor',
      types: ['generator', 'reactor'],
      power: 1,
      _draw_chances: 25,
    },{
      name: 'reactor',
      types: ['generator', 'reactor'],
      power: 2,
      _draw_chances: 18,
    },{
      name: 'superior reactor',
      types: ['generator', 'reactor'],
      power: 3,
      _draw_chances: 12,
    },{
      name: 'reactor upgrade',
      types: ['instant'],
      cost: 2,
      actions: [
        {
          name: 'reactor_upgrade',
          targeting: ['friendly', 'reactor'],
          amount: 1,
        },
      ],
      _draw_chances: 30,
    },{
      name: 'scrap',
      types: ['resource'],
      worth: 1,
      _draw_chances: 19,
    },{
      name: 'repair crew',
      types: ['instant'],
      actions: [
        {
          name: 'repair',
          targeting: ['friendly', 'ship'],
          amount: 2,
        },
      ],
      _draw_chances: 7,
    },{
      name: 'shield hardware',
      types: ['shields'],
      shields: 1,
      _draw_chances: 20,
    },{
      name: 'implosion bomb',
      types: ['instant'],
      cost: 8,
      actions: [
        {
          name: 'damage',
          targeting: ['enemy', 'ship'],
          amount: 100,
        },
      ],
      _draw_chances: 5,
    },{
      name: 'weapons upgrade',
      types: ['instant'],
      cost: 3,
      actions: [
        {
          name: 'stats_delta',
          targeting: ['friendly', 'ship'],
          attack: 1,
        },
      ],
      _draw_chances: 13,
    },{
      name: 'weapons damager',
      types: ['instant'],
      cost: 4,
      actions: [
        {
          name: 'stats_delta',
          targeting: ['enemy', 'ship'],
          attack: -1,
        },
      ],
      _draw_chances: 11,
    },{
      name: 'hardware upgrade',
      types: ['instant'],
      cost: 4,
      actions: [
        {
          name: 'stats_delta',
          targeting: ['friendly', 'ship'],
          attack: 1,
          defense: 1,
        },
      ],
      _draw_chances: 9,
    },{
      name: 'supreme hardware upgrade',
      types: ['instant'],
      cost: 6,
      actions: [
        {
          name: 'stats_delta',
          targeting: ['friendly', 'ship'],
          attack: 2,
          defense: 2,
        },
      ],
      _draw_chances: 5,
    },{
      name: 'hull breaker',
      types: ['instant'],
      cost: 6,
      actions: [
        {
          name: 'stats_delta',
          targeting: ['enemy', 'ship'],
          defense: -4,
        },
      ],
      _draw_chances: 7,
    },{
      name: 'repair bot',
      types: ['ship'],
      upkeep: 1,
      defense: 2,
      actions: [
        {
          name: 'repair',
          targeting: ['friendly', 'ship'],
          amount: 3,
        },
      ],
      _draw_chances: 5,
    },{
      name: 'piracy crew',
      types: ['instant'],
      cost: 3,
      actions: [
        {
          name: 'piracy',
          targeting: ['enemy', 'ship'],
        },
      ],
      _draw_chances: 15,
    },{
      name: 'conversion kit: defense',
      types: ['instant'],
      cost: 2,
      actions: [
        {
          name: 'stats_delta',
          targeting: ['friendly', 'ship'],
          attack: -1,
          defense: 1,
        },
      ],
      _draw_chances: 11,
    },{
      name: 'conversion kit: attack',
      types: ['instant'],
      cost: 2,
      actions: [
        {
          name: 'stats_delta',
          targeting: ['friendly', 'ship'],
          attack: 1,
          defense: -1,
        },
      ],
      _draw_chances: 11,
    },{
      name: 'overburner',
      types: ['instant'],
      cost: 3,
      actions: [
        {
          name: 'apply_effect',
          targeting: ['friendly', 'enemy', 'generator'],
          effect: {
            name: 'overburner',
            types: ['overburner'],
          },
        },
      ],
      _draw_chances: 20,
    },{
      name: 'time bomb',
      types: ['instant'],
      cost: 2,
      actions: [
        {
          name: 'apply_effect',
          targeting: ['enemy', 'ship'],
          effect: {
            name: 'time bomb',
            types: ['time_bomb'],
            damage: 4,
          },
        },
      ],
      _draw_chances: 18,
    },{
      name: 'massive time bomb',
      types: ['instant'],
      cost: 6,
      actions: [
        {
          name: 'apply_effect',
          targeting: ['enemy', 'ship'],
          effect: {
            name: 'massive time bomb',
            types: ['time_bomb'],
            damage: 12,
          },
        }
      ],
      _draw_chances: 6,
    },{
      name: 'brief weapon jammer',
      types: ['instant'],
      cost: 3,
      actions: [
        {
          name: 'apply_effect',
          targeting: ['enemy', 'ship'],
          effect: {
            name: 'weapon jammer',
            types: ['weapon_jammer'],
            turns: 1,
          },
        },
      ],
      _draw_chances: 15,
    },{
      name: 'weapon jammer',
      types: ['instant'],
      cost: 5,
      actions: [
        {
          name: 'apply_effect',
          targeting: ['enemy', 'ship'],
          effect: {
            name: 'weapon jammer',
            types: ['weapon_jammer'],
            turns: 2,
          },
        },
      ],
      _draw_chances: 10,
    },{
      name: 'long weapon jammer',
      types: ['instant'],
      cost: 7,
      actions: [
        {
          name: 'apply_effect',
          targeting: ['enemy', 'ship'],
          effect: {
            name: 'weapon jammer',
            types: ['weapon_jammer'],
            turns: 3,
          },
        },
      ],
      _draw_chances: 8,
    },{
      name: 'cleanse',
      types: ['instant'],
      cost: 4,
      actions: [
        {
          name: 'cleanse',
          targeting: ['friendly', 'enemy', 'ship'],
        },
      ],
      _draw_chances: 18,
    },{
      name: 'black hole',
      types: ['black_hole'],
      cost: 5,
      mass: 1,
      actions: [
        {
          name: 'consume',
          targeting: ['friendly', 'enemy', 'ship', 'generator', 'black_hole'],
        },
      ],
      image: 'black_hole.png',
      _draw_chances: 5,
    }]);
  };

  exports.explore = function() {
    return exports.fill_in([{
      name: 'asteroid',
      types: ['resource'],
      worth: 2,
      _draw_chances: 140,
    },{
      name: 'rocky planet',
      types: ['generator'],
      worth: 4,
      image: 'rocky_planet.png',
      _draw_chances: 40,
    },{
      name: 'desert planet',
      types: ['generator'],
      worth: 3,
      image: 'desert_planet.png',
      _draw_chances: 45,
    },{
      name: 'ship wreckage',
      types: ['resource'],
      worth: 3,
      _draw_chances: 100,
    },{
      name: 'brown dwarf',
      types: ['generator'],
      power: 3,
      image: 'brown_dwarf.png',
      _draw_chances: 40,
    },{
      name: 'white dwarf',
      types: ['generator'],
      power: 4,
      image: 'white_dwarf.png',
      _draw_chances: 25,
    },{
      name: 'blue supergiant',
      types: ['generator'],
      power: 10,
      image: 'blue_supergiant.png',
      _draw_chances: 1,
    },{
      name: 'red giant',
      types: ['generator'],
      power: 7,
      image: 'red_giant.png',
      _draw_chances: 1,
    },{
      name: 'yellow dwarf',
      types: ['generator'],
      power: 5,
      image: 'yellow_dwarf.png',
      _draw_chances: 15,
    }]);
  };

  exports.mother_ship = function() {
    return exports.fill_in([{
      name: 'mother ship',
      types: ['ship'],
      defense: 20,
    }])[0];
  };

  exports.pool = function(cards) {
    var ret = [];
    for (var i = 0; i < cards.length; i++) {
      var chance = typeof cards[i]._draw_chances === 'undefined' ?
                   1 : cards[i]._draw_chances;

      for (var j = 0; j < chance; j++) {
        ret.push(cards[i]);
      }
    }
    return ret;
  };
})(typeof exports === 'undefined' ? this['state'] = {} : exports);
