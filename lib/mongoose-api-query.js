module.exports = exports = function apiQueryPlugin (schema) {
  
  schema.statics.apiQueryMetaCb = function(rawParams, metaCb) {
    return this.apiQuery(rawParams, undefined, metaCb);
  }
  
  schema.statics.apiQuery = function(rawParams, cb, metaCb) {
    
    // First see if there are any logical query operator params.
    // and take them out so tey don't bother the query building.
    var orList, norList;
    var orFields, norFields;
    if (typeof rawParams['ors'] === "string") {
      orFields = rawParams['ors'].split(',');
      delete rawParams['ors'];
    }
    
    if (typeof rawParams['nors'] === "string") {
      norFields = rawParams['nors'].split(',');
      delete rawParams['nors'];
    }
    
    var model = this
      , params = model.apiQueryParams(rawParams);
    
    // Go through and separate the fields into the logical query operators as told.
    var i, len, key, o;
    if (orFields) {
      orList = [];
      for (i = 0, len = orFields.length; i < len; i++) {
        key = orFields[i];
        if (typeof params.searchParams[key] !== "undefined") {
          o = {};
          o[key] = params.searchParams[key];
          orList.push(o);
          delete params.searchParams[key];
        }
      }
    }
    
    // What ever is left goes into the $and list.
    var andList = [];
    for (key in params.searchParams) {
      o = {};
      o[key] = params.searchParams[key];
      andList.push(o);
    }
    
    var searchParams = {};
    
    if (orList && orList.length > 0) {
      searchParams.$or = orList;
    }
    
    if (andList.length > 0) {
      searchParams.$and = andList;
    }
    
    // Create the Mongoose Query object.
    query = model.find(searchParams);
    //console.log('======');
    //var u = require('util');
    //console.log(u.inspect(searchParams, {depth:null}));
    //console.log('======');
    // If there is a paging callback, do an extra query to get some more info.
    if (metaCb) {
      model.find(searchParams).count().exec(function(err, recordCount) {
        
        recordCount = recordCount || 0;
        
        metaCb(err, {
          paging: {
            page: params.page,
            recordCount: recordCount,
            pageCount: Math.ceil(recordCount / params.per_page)
          }
        });
      });
    }
    
    if (params.page > 1) {
      query = query.skip((params.page - 1) * params.per_page);
    }
    
    if (params.sort) query = query.sort(params.sort);
    
    query = query.limit(params.per_page);
    
    if (cb) {
      query.exec(cb);
    } else {
      return query;
    }
  };

  schema.statics.apiQueryParams = function(rawParams) {

    var model = this;

    var convertToBoolean = function (str) {
      if (str.toLowerCase() === "true" ||
          str.toLowerCase() === "t" ||
          str.toLowerCase() === "yes" ||
          str.toLowerCase() === "y" ||
          str === "1"){
        return true;
      } else {
        return false;
      }
    };

    var searchParams = {}
      , query
      , page = 1
      , per_page = 10
      , sort = false;

    var parseSchemaForKey = function (schema, keyPrefix, lcKey, val, operator) {

      var paramType = false;

      var addSearchParam = function (val) {
        var key = keyPrefix + lcKey;

        if (typeof searchParams[key] !== 'undefined') {
          for (i in val) {
            searchParams[key][i] = val[i];
          }
        } else {
          searchParams[key] = val;
        }
      };

      if (matches = lcKey.match(/(.+)\.(.+)/)) {
        // parse subschema
        if (schema.paths[matches[1]].constructor.name === "DocumentArray" ||
            schema.paths[matches[1]].constructor.name === "Mixed") {
          parseSchemaForKey(schema.paths[matches[1]].schema, matches[1] + ".", matches[2], val, operator)
        }

      } else if (typeof schema === "undefined") {
        paramType = "String";

      } else if (typeof schema.paths[lcKey] === "undefined"){
        // nada, not found

      } else if (operator === "near") {
        paramType = "Near";
      } else if (schema.paths[lcKey].constructor.name === "SchemaBoolean") {
        paramType = "Boolean";
      } else if (schema.paths[lcKey].constructor.name === "SchemaString") {
        paramType = "String";
      } else if (schema.paths[lcKey].constructor.name === "SchemaNumber") {
        paramType = "Number";
      }
      
      if (paramType === "Boolean") {
        addSearchParam(convertToBoolean(val));
      } else if (paramType === "Number") {
        if (val.match(/([0-9]+,?)/) && val.match(',')) {
          if (operator === "all") {
            addSearchParam({$all: val.split(',')});
          } else if (operator === "nin") {
            addSearchParam({$nin: val.split(',')});
          } else if (operator === "mod") {
            addSearchParam({$mod: [val.split(',')[0], val.split(',')[1]]});
          } else {
            addSearchParam({$in: val.split(',')});
          }
        } else if (val.match(/([0-9]+)/)) {
          if (operator === "gt" ||
              operator === "gte" ||
              operator === "lt" ||
              operator === "lte" ||
              operator === "ne") {
            var newParam = {};
            newParam["$" + operator] = val;
            addSearchParam(newParam);
          } else {
            addSearchParam(parseInt(val));
          }
        }
      } else if (paramType === "String") {
        if (val.match(',')) {
          
          var options = val.split(',').map(function(str){
            return new RegExp(str, 'i');
          });

          if (operator === "all") {
            addSearchParam({$all: options});
          } else if (operator === "nin") {
            addSearchParam({$nin: options});
          } else {
            addSearchParam({$in: options});
          }
        } else if (operator === "ne" || operator === "not") {
          var neregex = new RegExp(val,"i");
          addSearchParam({'$not': neregex});
        } else if (operator === "exact") {
          addSearchParam(val);
        } else {
          addSearchParam({$regex: val, $options: "-i"});
        }
      } else if (paramType === "Near") {
        // divide by 69 to convert miles to degrees
        var latlng = val.split(',');
        var distObj = {$near: [parseFloat(latlng[0]), parseFloat(latlng[1])]};
        if (typeof latlng[2] !== 'undefined') {
          distObj.$maxDistance = parseFloat(latlng[2]) / 69;
        }
        addSearchParam(distObj);
      }

    };

    var parseParam = function (key, val) {
      var lcKey = key
        , operator = val.match(/\{(.*)\}/)
        , val = val.replace(/\{(.*)\}/, '');

      if (operator) operator = operator[1];

      if (val === "") {
        return;
      } else if (lcKey === "page") {
        page = val;
      } else if (lcKey === "per_page") {
        per_page = val;
      } else if (lcKey === "sort_by") {
        var parts = val.split(',');
        sort = {};
        sort[parts[0]] = parts.length > 1 ? parts[1] : 1;
      } else {
        parseSchemaForKey(model.schema, "", lcKey, val, operator);
      }
    }

    // Construct searchParams
    for (var key in rawParams) {
      var separatedParams = rawParams[key].match(/\{\w+\}(.[^\{\}]*)/g);

      if (separatedParams === null) {
        parseParam(key, rawParams[key]);
      } else {
        for (var i = 0, len = separatedParams.length; i < len; ++i) {
          parseParam(key, separatedParams[i]);
        }
      }
    }    

    return {
      searchParams:searchParams,
      page:page,
      per_page:per_page,
      sort:sort
    }

  };

};