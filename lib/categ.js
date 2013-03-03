
var make = function( make, name, cat, subcat ) {
  var grand = make( name )
    , i, n, j, m;

  if( cat && !Array.isArray( cat ) )
    cat = [ cat ];
  if( subcat && !Array.isArray( subcat ) )
    subcat = [ subcat ];

  n = cat ? cat.length : 0;
  m = subcat ? subcat.length : 0;
  if( !n && !m )
    return grand;

  return function( value ) {
    var cat, subcat;

    // grand totals
    grand( value );
    for( i = 0; i < n; i ++ ) {
      cat = name + '\t' + arguments[ i + 1 ];

      // category totals
      make( cat )( value );
      for( j = 0; j < m; j ++ ) {
        subcat = cat + '\t' + arguments[ j + n + 1 ];

        // subcategory totals
        make( subcat )( value );
      }
    }
  };
};

module.exports = function( store ) {
  store.make = make.bind( null, store.make.bind( store ) );
};
