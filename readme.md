## Overview
If you use Mongoose to help serve results for API calls, you might be used to handling calls like:

    /monsters?color=purple&eats_humans=true

mongoose-api-query handles some of that busywork for you. Pass in a vanilla object (e.g. req.query) and query conditions will be cast to their appropriate types according to your Mongoose schema. For example, if you have a boolean defined in your schema, we'll convert the `eats_humans=true` to a boolean for searching.

It also adds a ton of additional search operators, like `less than`, `greater than`, `not equal`, `near` (for geosearch), `in`, and `all`. You can find a full list below.

When searching strings, by default it does a partial, case-insensitive match. (Which is not the default in MongoDB.)

## Usage

Apply the plugin to any schema in the usual Mongoose fashion:

```
monsterSchema.plugin(mongooseApiQuery);
```

Then call it like you would using `Model.find`. This returns a Mongoose.Query:

```
Monster.apiQuery(req.query).exec(...
```

Or pass a callback in and it will run `.exec` for you:

```
Monster.apiQuery(req.query, function(err, monsters){...
```

Or pass a callback in to apiQueryMetaCb and it will return the query and the callback will get any meta data passed to it.
Currently the metadata consists of extra information about paging such as the recordCount and pageCount.

```
Monster.apiQueryMetaCb(req.query, function(err, metaData){...
```


## Examples

`t`, `y`, and `1` are all aliases for `true`:

```
/monsters?eats_humans=y&scary=1
```

Match on a nested property:

```
/monsters?foods.name=kale
```

Use exact matching:

```
/monsters?foods.name={exact}KALE
```

Matches either `kale` or `beets`:

```
/monsters?foods.name=kale,beets
```

Matches only where `kale` and `beets` are both present:

```
/monsters?foods.name={all}kale,beets
```

Numeric operators:

```
/monsters?monster_id={gte}30&age={lt}50
```

Combine operators:

```
/monsters?monster_id={gte}30{lt}50
```

geo near, with (optional) radius in miles:

```
/monsters?latlon={near}38.8977,-77.0366
/monsters?latlon={near}38.8977,-77.0366,10
```

##### Pagination

```
/monsters?page=2
/monsters?page=4&per_page=25 		// per_page defaults to 10
```

##### Sorting results

```
/monsters?sort_by=name
/monsters?sort_by=name,desc
```

##### Schemaless search

Do you have a property defined in your schema like `data: {}`, that can have anything inside it? You can search that, too, and it will be treated as a string.

## Search Operators

This is a list of the optional search operators you can use for each SchemaType.

#### Number

- `number={all}123,456` - Both 123 and 456 must be present
- `number={nin}123,456` - Neither 123 nor 456
- `number={in}123,456` - Either 123 or 456
- `number={gt}123` - > 123
- `number={gte}123` - >= 123
- `number={lt}123` - < 123
- `number={lte}123` - <=123
- `number={ne}123` - Not 123
- `number={mod}10,2` - Where (number / 10) has remainder 2

#### String

- `string={all}match,batch` - Both match *and* batch must be present
- `string={nin}match,batch` - Neither match nor batch
- `string={in}match,batch` - Either match or batch
- `string={not}coffee` - Not coffee
- `string={exact}CoFeEe` - Case-sensitive exact match of "CoFeEe"

#### Latlon

- `latlon={near}37,-122,5` Near 37,-122, with a 5 mile max radius
- `latlon={near}37,-122` Near 37,-122, no radius limit. Automatically sorts by distance

#### Special logical query operator query params

Specify the fields in a comma separated list that are to be used with an operator.
All remaining fields are given to $and.

- `ors=match,batch` - The fields match and batch will be given to $or: []
- `nors=match,batch` - The fields match and batch will be given to $nor: []

## To run tests

```shell
node load_fixtures.js
node app.js
mocha
```

## License

MIT http://mit-license.org/
