

// stats container
function Bucket( res, first, time ) {
  if( res !== +res || res < 250 || res > 3600000 )
    throw new Error( "Bad resolution: " + res );

  this.res = res;
  this.start = time || Date.now();
  this.push( first );
}

Bucket.prototype = {

  res: 0
, start: 0

  // basic stats
, min: Number.POSITIVE_INFINITY
, max: Number.NEGATIVE_INFINITY
, n: 0
, sum: 0
, sum2: 0

  // rolling stats
, rAvg: 0
, rVar: 0

  // simple anova
, getAvg: function() {
    if( this.n > 100 )
      throw new Error( "BIG." );

    return this.sum / this.n;
  }

, getVar: function() {
    var n = this.n
      , avg = this.sum / n;
    if( n < 2 )
      return 0;
    if( n > 100 )
      throw new Error( "BIG." );

    return ( this.sum2 - avg * avg * n ) / ( n - 1 );
  }

  // pushing new observations
, push: function( val ) {
    if( val !== +val )
      throw new Error( "Bad value: " + val );

    if( val < this.min )
      this.min = val;
    if( val > this.max )
      this.max = val;

    var n = ++ this.n
      , dev;

    // maintain rolling stats
    if( n > 100 ) {
      dev = val - this.rAvg;
      this.rAvg = this.rAvg * 0.99 + val * 0.01;
      this.rVar = this.rVar * 0.99 + dev * dev * 0.01;
    }

    // init rolling stats
    else if( n === 100 ) {
      this.sum += val;
      this.sum2 += val * val;
      this.rAvg = this.getAvg();
      this.rVar = this.getVar();
      delete this.sum;
      delete this.sum2;

      // saturated!
      return true;
    }

    // keep collecting variance primitives
    else {
      this.sum += val;
      this.sum2 += val * val;
    }
  }

  // merging buckets
, merge: function( bucket ) {
    if( bucket.res !== this.res )
      throw new Error( "Merging buckets with different resolution." );
    if( bucket.start < this.start )
      throw new Error( "Merging buckets in the wrong order." );

    this.res *= 2;
    var n = this.n += bucket.n;

    // rolling stats
    // try to preserve some state from both buckets
    if( n >= 100 ) {
      this.rAvg = (
        ( this.n >= 100 ? this.rAvg : this.getAvg() )
      + ( bucket.n >= 100 ? bucket.rAvg : bucket.getAvg() )
      ) / 2;

      this.rVar = (
        ( this.n >= 100 ? this.rVar : this.getVar() )
      + ( bucket.n >= 100 ? bucket.rVar : bucket.getVar() )
      ) / 2;

      delete this.sum;
      delete this.sum2;
    }

    // basic stats
    else {
      this.sum = this.sum + bucket.sum;
      this.sum2 = this.sum2 + bucket.sum2;
    }

    this.min = Math.min( this.min, bucket.min );
    this.max = Math.max( this.max, bucket.max );
  }
};


// stats reporting
function getBucketReport( bucket, now ) {
  var n = bucket.n
    , big = n >= 100
    , t0 = bucket.start
    , t1 = t0 + bucket.res;
  if( now > t0 )
    t1 = Math.min( now, t1 );

  return {
    t0: t0
  , t1: t1
  , n: n
  , min: bucket.min
  , max: bucket.max
  , avg: big ? bucket.rAvg : bucket.getAvg()
  , dev: Math.sqrt( big ? bucket.rVar : bucket.getVar() )
  , rate: n / ( t1 - t0 ) * 1000
  };
}


// compact a history array of buckets
// merges two buckets only if a third with the same resolution follows,
// to preserve history granularity for analytical purposes
function compact( hist ) {
  var n = hist.length - 2
    , a, b, c
    , res;

  while( n > 0 ) {
    a = hist[ n + 1 ];
    b = hist[ n ];
    c = hist[ n - 1 ];

    res = a.res;
    if( b.res !== res || c.res !== res )
      break;

    // merge and drop b
    c.merge( b );
    hist.splice( n, 1 );

    // take two steps back
    n -= 2;
  }
}


// a coordinator for stat history accumulation
function Storage( resolution, onReport, onPartialReport ) {
  var self = this
    , history = {}
    , current = {}

    , meta = {}
    , labels = {}
    , keys = {}
    , pushers = {}
    , idc = 0

    , make
    , makeReport;

  // output
  makeReport = function( key, now ) {
    var bucket = current[ key ]
      , hist = history[ key ];

    return {
      label: labels[ key ]
    , meta: meta[ key ]
    , current: getBucketReport( bucket, now )
    , history: hist && hist.map( getBucketReport )
    };
  };

  self.getReport = function() {
    var report = [], key, now = Date.now();
    for( key in current )
      report.push( makeReport( key, now ) );

    return report;
  };

  // input
  make = function( key ) {
    return function( val ) {
      var bucket = current[ key ], saturated;
      if( !bucket ) {
        bucket = current[ key ] = new Bucket( resolution, val );
        return;
      }

      saturated = bucket.push( val );

      // generate a preliminary report when new buckets get saturated
      if( saturated && onPartialReport )
        onPartialReport( makeReport( key, Date.now() ) );
    };
  };

  self.make = function( statLabel, statMeta ) {
    var key = keys[ statLabel ];
    if( !key ) {
      keys[ statLabel ] = key = ++ idc;
      labels[ key ] = statLabel;
      if( statMeta )
        meta[ key ] = statMeta;
    }

    return pushers[ key ] || ( pushers[ key ] = make( key ) );
  };

  // bookkeeping
  setInterval(
    function() {
      var report = onReport && self.getReport()
        , key, bucket, hist;

      // manage history
      for( key in current ) {
        bucket = current[ key ];
        if( bucket.n < 10 ) // throw away insignificant buckets.
          continue;

        hist = history[ key ];
        if( !hist )
          history[ key ] = hist = [];

        hist.push( bucket );
        compact( hist );
      }

      // start a new time window
      current = {};

      // feed complete reports to the listener
      if( report ) onReport( report );
    }
  , resolution
  );
}


// export a factory
module.exports = function( resolution, onReport, onPartialReport ) {
  return new Storage( resolution, onReport, onPartialReport );
};


