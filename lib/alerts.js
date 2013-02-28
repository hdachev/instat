

function predict( history ) {
  var min = 0, max = 0, avg = 0, dev = 0, rate = 0
    , i, n = history.length, bucket;

  for( i = 0; i < n; i ++ ) {
    bucket = history[ i ];
    min += bucket.min;
    max += bucket.max;
    avg += bucket.avg;
    dev += bucket.dev;
    rate += bucket.rate;
  }

  return {
    min: min / n
  , max: max / n
  , avg: avg / n
  , dev: dev / n
  , rate: rate / n
  };
}


function test( field, direction, first, last, expected, current, err, norm, confidence, output ) {
  var n = current.n
    , dLong = current[ field ] - first[ field ]
    , dShort = current[ field ] - last[ field ]
    , dExpected = current[ field ] - expected[ field ]
    , aLong, aShort, aExpected
    , alpha;

  // don't generate alerts from insignificant data
  if( n < 100 )
    return output;

  // normalize the deviations
  aExpected = dExpected / norm;

  // long-term stats can become dated, and
  // and short-term stats are lower quality data
  aLong = dLong / norm / 2;
  aShort = dShort / norm / 2;

  // increase the confidence threshold when we have signals that
  // the tendency in question is directionally safe,
  // say a standard deviation is decreasing wrt its lifelong values
  if( direction < 0 ) {
    if( aLong > 0 )
      confidence += aLong;
    if( aShort > 0 )
      confidence += aShort;
    if( aExpected > 0 )
      confidence += aExpected;
  }
  else if( direction > 0 ) {
    if( aLong < 0 )
      confidence -= aLong;
    if( aShort < 0 )
      confidence -= aShort;
    if( aExpected < 0 )
      confidence -= aExpected;
  }

  // eliminate the standard error
  confidence += err / Math.sqrt( n );

  // this is our confidence level
  alpha = Math.max( Math.abs( aLong ), Math.abs( aShort ), Math.abs( aExpected ) );
  if( alpha < confidence )
    return output;

  if( !output )
    output = {
      alpha: alpha
    , delta: {}
    };

  else if( output.alpha < alpha )
    output.alpha = alpha;

  if( aLong > confidence || aLong < - confidence )
    output.delta[ field + 'L' ] = dLong;
  if( aShort > confidence || aShort < - confidence )
    output.delta[ field + 'S' ] = dShort;
  if( aExpected > confidence || aExpected < - confidence )
    output.delta[ field + 'X' ] = dExpected;

  return output;
}


module.exports = function( report, confidence ) {
  var i, n = report.length
    , entry, current, history
    , hlen, first, last, expected
    , alerts = [], alert

    , good, bad, dev, avg, rate;

  for( i = 0; i < n; i ++ ) {

    alert = null;
    entry = report[ i ];
    current = entry.current;
    history = entry.history;

    // we don't generate alerts until we have some data,
    // at length 3 we have at least one compacted window
    hlen = history ? history.length : 0;
    if( hlen < 3 )
      continue;

    // good/bad metrics.
    // good means the higher the better,
    // bad means the lower the better.
    // a good metric won't generate alerts
    // when its mean or range increase,
    // or when its rate fluctuates.
    bad = entry.meta && entry.meta.bad ? 2 : 1;
    good = entry.meta && entry.meta.good ? 2 : 1;

    last = history[ hlen - 1 ];
    first = history[ 0 ];
    expected = predict( history );

    dev = current.dev;
    avg = current.avg;
    rate = expected.rate;

    // range alerts are only generated only when the range widens
    alert = test( 'min', -1, first, last, expected, current, dev, avg, bad * confidence, alert );
    alert = test( 'max',  1, first, last, expected, current, dev, avg, good * confidence, alert );

    // rate and deviation alerts are generated only when the values increase
    alert = test( 'dev',  1, first, last, expected, current, dev, dev, good * confidence, alert );
    alert = test( 'rate', 1, first, last, expected, current, rate, rate, good * confidence, alert );

    // mean alerts are relevant in either direction
    alert = test( 'avg',  0, first, last, expected, current, dev, avg, confidence, alert );

    if( alert ) {
      // var key;
      // for( key in alert.delta )
      //   break;
      // if( !key )
      //   throw new Error( "Something is wrong." );

      // alert.confidence = confidence;
      alert.time = Date.now();
      alert.data = entry;
      alerts.push( alert );
    }
  }

  return alerts;
};

