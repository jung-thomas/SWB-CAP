//
// Convert the native JSON ODP response into an OData response
//
module.exports.swaggerToOData = function (
  responseBody,
  aGetKeyForFieldName,
  isCountRequested
) {
  var columns = responseBody.columns;
  var rows = responseBody.rows;

  // is the request just for a count
  if (isCountRequested !== undefined && isCountRequested === true) {
    return [
      {
        counted: rows.length,
      },
    ];
  }

  // build a map of fields where we pass the key rather than the title
  var keyMap = new Map();
  if (aGetKeyForFieldName) {
    aGetKeyForFieldName.forEach((row) => {
      keyMap.set(row, row);
    });
  }

  // build a map of the returned columns using the column definition from the start of the response
  var aMap = [];
  var column, oMap;
  // Support ODP API version 3
  if (!Array.isArray(columns)) {
    for (i = 0; i < columns.attributes.length; i++) {
      column = columns.attributes[i];
      oMap = {
        name: column.identifier,
      };
      aMap.push(oMap);
    }
    for (i = 0; i < columns.measures.length; i++) {
      column = columns.measures[i];
      oMap = {
        name: column.identifier,
      };
      aMap.push(oMap);
    }
  } else {
    for (i = 0; i < columns.length; i++) {
      column = columns[i];
      oMap = {
        name: column.identifier,
      };
      aMap.push(oMap);
    }
  }

  var aOData = [];

  // use the map to build the results
  for (var i = 0; i < rows.length; i++) {
    var row = rows[i];
    var odataRow = {};
    odataRow["Sequence"] = i.toString();
    for (var c = 0; c < aMap.length; c++) {
      if (row[aMap[c].name].title !== undefined) {
        //	if (row[aMap[c].name].key !== undefined) {
        odataRow[aMap[c].name] = row[aMap[c].name].title;
      } else if (row[aMap[c].name].value !== undefined) {
        odataRow[aMap[c].name] = row[aMap[c].name].value;
      } else if (row[aMap[c].name].key !== undefined) {
        odataRow[aMap[c].name] = row[aMap[c].name].key;
      }

      // support parameter aGetKeyForFieldName using keyMap
      // if the property name is found in the map then return the key rather than the title
      if (keyMap.has(aMap[c].name)) {
        if (row[aMap[c].name].key !== undefined) {
          odataRow[aMap[c].name] = row[aMap[c].name].key;
        }
      }

      // support OData properties ending _Key
      // always add a property from ODP with the name <ODP Property>_key into the OData result containing the Key value
      // if the attribute is specified in the cds model then it will get populated
      if (row[aMap[c].name].key !== undefined) {
        var keyName = aMap[c].name + "_Key";
        odataRow[keyName] = row[aMap[c].name].key;
      }
    }

    aOData.push(odataRow);
  }

  return aOData;
};
