/**
 * Check if the input is a generic object, including arrays.
 *
 * @param {*} unknown The input to check.
 * @returns {boolean} True if the input is an object.
 * ref: https://github.com/jashkenas/underscore/blob/1.9.1/underscore.js#L1319-L1323
 */
export function isObject(unknown) {
  const type = typeof unknown;
  return type === 'function' || type === 'object' && !!unknown;
}

/**
 * Check if the input is an array.
 *
 * @param {*} unknown The input to check.
 * @returns {boolean} True if the input is an array.
 * ref: https://github.com/jashkenas/underscore/blob/1.9.1/underscore.js#L1313-L1317
 */
export function isArray(unknown) {
  return Array.isArray(unknown);
}

/**
 * Dump an object to an array.
 *
 * @param {object} obj The input object as: {key0: {}, key1: {}}
 * @returns {Array} The corresponding array:
 *   [{name: key0, {}}, {name: key1, {}}]
 */
export function objectToArray(obj) {
  const array = [];
  const keys = Object.keys(obj);
  for (let i = 0; i < keys.length; ++i) {
    const key = keys[i];
    const row = {name: key};
    const innerKeys = Object.keys(obj[key]);
    for (let j = 0; j < innerKeys.length; ++j) {
      const innerKey = innerKeys[j];
      let value = obj[key][innerKey];
      if (isArray(value)) {
        const arrayValues = [];
        for (let k = 0; k < value.length; ++k) {
          if (isObject(value[k])) {
            arrayValues.push(objectToArray(value[k]));
          } else {
            arrayValues.push(value[k]);
          }
        }
        value = arrayValues;
      } else if (isObject(value)) {
        value = objectToArray(value);
      }
      row[innerKey] = value;
    }
    array.push(row);
  }
  return array;
}

/**
 * Merge two similar objects.
 * Objects need to be in the form of:
 * <code>
 * {
 *   idKey: {valueKey: 0},
 *   key0: {valueKey: "abc"},
 *   key1: {valueKey: 33}
 * }
 * </code>
 * Merged objects will be in the form of:
 * <code>
 * {
 *   idKey: {valueKey: [0,1,2], merged: true},
 *   key0: {valueKey: {
 *     0: {valueKey: "abc"},
 *     1: {valueKey: "def"},
 *     2: {valueKey: "ghi"}
 *   }},
 *   key1: {valueKey: {
 *     0: {valueKey: 33},
 *     1: {valueKey: 44},
 *     2: {valueKey: 55}
 *   }}
 * }
 * </code>
 *
 * @param {object} obj1 The first object, can be the result of a previous merge.
 * @param {object} obj2 The second object.
 * @param {string} idKey The key to use as index for duplicate values.
 * @param {string} valueKey The key to use to access object values.
 * @returns {object} The merged object.
 */
export function mergeObjects(obj1, obj2, idKey, valueKey) {
  const res = {};
  // check id key
  if (!idKey) {
    throw new Error('Cannot merge object with an undefined id key: ' + idKey);
  } else {
    if (!Object.prototype.hasOwnProperty.call(obj1, idKey)) {
      throw new Error('Id key not found in first object while merging: ' +
                idKey + ', obj: ' + obj1);
    }
    if (!Object.prototype.hasOwnProperty.call(obj2, idKey)) {
      throw new Error('Id key not found in second object while merging: ' +
                idKey + ', obj: ' + obj2);
    }
  }
  // check value key
  if (!valueKey) {
    throw new Error('Cannot merge object with an undefined value key: ' +
      valueKey);
  }

  // check if merged object
  let mergedObj1 = false;
  if (Object.prototype.hasOwnProperty.call(obj1[idKey], 'merged') &&
    obj1[idKey].merged) {
    mergedObj1 = true;
  }
  // handle the id part
  if (!Object.prototype.hasOwnProperty.call(obj1[idKey], valueKey)) {
    throw new Error('Id value not found in first object while merging: ' +
            idKey + ', valueKey: ' + valueKey + ', ojb: ' + obj1);
  }
  if (!Object.prototype.hasOwnProperty.call(obj2[idKey], valueKey)) {
    throw new Error('Id value not found in second object while merging: ' +
            idKey + ', valueKey: ' + valueKey + ', ojb: ' + obj2);
  }
  const id1 = obj1[idKey][valueKey];
  const id2 = obj2[idKey][valueKey];
  // for merged object, id1 is an array
  if (mergedObj1) {
    // check if array does not include id2
    for (let k = 0; k < id1.length; ++k) {
      if (id1[k] === id2) {
        throw new Error('The first object already contains id2: ' +
                    id2 + ', id1: ' + id1);
      }
    }
    res[idKey] = obj1[idKey];
    res[idKey][valueKey].push(id2);
  } else {
    if (id1 === id2) {
      throw new Error('Cannot merge object with same ids: ' +
                id1 + ', id2: ' + id2);
    }
    // create merge object
    res[idKey] = {value: [id1, id2], merged: true};
  }

  // get keys
  const keys1 = Object.keys(obj1);
  // keys2 without duplicates of keys1
  const keys2 = Object.keys(obj2).filter(function (item) {
    return keys1.indexOf(item) < 0;
  });
  const keys = keys1.concat(keys2);

  // loop through keys
  for (let i = 0, leni = keys.length; i < leni; ++i) {
    const key = keys[i];
    if (key !== idKey) {
      // first
      let value1 = null;
      let subValue1 = null;
      if (Object.prototype.hasOwnProperty.call(obj1, key)) {
        value1 = obj1[key];
        if (Object.prototype.hasOwnProperty.call(value1, valueKey)) {
          subValue1 = value1[valueKey];
        }
      }
      // second
      let value2 = null;
      let subValue2 = null;
      if (Object.prototype.hasOwnProperty.call(obj2, key)) {
        value2 = obj2[key];
        if (Object.prototype.hasOwnProperty.call(value2, valueKey)) {
          subValue2 = value2[valueKey];
        }
      }
      // result value
      let value;
      // create merge object if different values
      if (subValue2 !== subValue1) {
        value = {};
        // add to merged object or create new
        if (mergedObj1) {
          if (isObject(subValue1)) {
            value[valueKey] = subValue1;
          } else {
            // merged object with repeated value
            // copy it with the index list
            value[valueKey] = {};
            for (let j = 0; j < id1.length; j++) {
              value[valueKey][id1[j]] = value1;
            }
          }
          // add obj2 value
          value[valueKey][id2] = value2;
        } else {
          // create merge object
          const newValue = {};
          newValue[id1] = value1;
          newValue[id2] = value2;
          value[valueKey] = newValue;
        }
      } else {
        value = value1;
      }
      // store value in result object
      res[key] = value;
    }
  }
  return res;
}
