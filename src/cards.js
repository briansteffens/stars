(function(exports){
  exports.all = function() {
    return [{
      name: 'drone',
      type: 'ship',
    },{
      name: 'fighter',
      type: 'ship',
      cost: 1,
      upkeep: 1,
      attack: 2,
      defense: 1,
      _draw_chances: 20,
    },{
      name: 'asteroid',
      type: 'resource',
      worth: 1,
      _draw_chances: 10,
    },{
      name: 'brown dwarf',
      type: 'generator',
      power: 1,
      _draw_chances: 10,
    },{
      name: 'white dwarf',
      type: 'generator',
      power: 2,
      _draw_chances: 5,
    },{
      name: 'blue supergiant',
      type: 'generator',
      power: 10,
    },{
      name: 'yellow dwarf',
      type: 'generator',
      power: 3,
    }];
  };
  exports.mother_ship = function() {
    return {
      name: 'mother ship',
      type: 'ship',
      defense: 20,
    };
  };
})(typeof exports === 'undefined' ? this['state'] = {} : exports);
