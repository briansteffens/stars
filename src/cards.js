(function(exports){
  exports.all = function() {
    return [{
      name: 'drone',
      type: 'ship',
    },{
      name: 'asteroid',
      type: 'resource',
    },{
      name: 'star',
      type: 'generator',
    }];
  };
})(typeof exports === 'undefined' ? this['state'] = {} : exports);
