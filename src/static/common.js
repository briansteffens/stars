Array.prototype.contains = function(val) {
  return this.indexOf(val) >= 0;
};

Array.prototype.intersect = function(other) {
  let ret = [];
  for (let val of this) {
    if (other.contains(val)) {
      ret.push(val);
    }
  }
  return ret;
};
