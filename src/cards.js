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
    },{
      name: 'asteroid',
      type: 'resource',
      worth: 1,
      _draw_chances: 2,
    },{
      name: 'star',
      type: 'generator',
      power: 2,
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
