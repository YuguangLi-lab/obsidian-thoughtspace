// tools/board-tool/index.ts
import path3 from "node:path";

// node_modules/js-yaml/dist/js-yaml.mjs
function getDefaultExportFromCjs(x) {
  return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, "default") ? x["default"] : x;
}
var jsYaml = {};
var loader = {};
var common = {};
var hasRequiredCommon;
function requireCommon() {
  if (hasRequiredCommon) return common;
  hasRequiredCommon = 1;
  function isNothing(subject) {
    return typeof subject === "undefined" || subject === null;
  }
  function isObject(subject) {
    return typeof subject === "object" && subject !== null;
  }
  function toArray(sequence) {
    if (Array.isArray(sequence)) return sequence;
    else if (isNothing(sequence)) return [];
    return [sequence];
  }
  function extend(target, source) {
    if (source) {
      const sourceKeys = Object.keys(source);
      for (let index = 0, length = sourceKeys.length; index < length; index += 1) {
        const key = sourceKeys[index];
        target[key] = source[key];
      }
    }
    return target;
  }
  function repeat(string, count) {
    let result = "";
    for (let cycle = 0; cycle < count; cycle += 1) {
      result += string;
    }
    return result;
  }
  function isNegativeZero(number) {
    return number === 0 && Number.NEGATIVE_INFINITY === 1 / number;
  }
  common.isNothing = isNothing;
  common.isObject = isObject;
  common.toArray = toArray;
  common.repeat = repeat;
  common.isNegativeZero = isNegativeZero;
  common.extend = extend;
  return common;
}
var exception;
var hasRequiredException;
function requireException() {
  if (hasRequiredException) return exception;
  hasRequiredException = 1;
  function formatError(exception2, compact) {
    let where = "";
    const message = exception2.reason || "(unknown reason)";
    if (!exception2.mark) return message;
    if (exception2.mark.name) {
      where += 'in "' + exception2.mark.name + '" ';
    }
    where += "(" + (exception2.mark.line + 1) + ":" + (exception2.mark.column + 1) + ")";
    if (!compact && exception2.mark.snippet) {
      where += "\n\n" + exception2.mark.snippet;
    }
    return message + " " + where;
  }
  function YAMLException2(reason, mark) {
    Error.call(this);
    this.name = "YAMLException";
    this.reason = reason;
    this.mark = mark;
    this.message = formatError(this, false);
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    } else {
      this.stack = new Error().stack || "";
    }
  }
  YAMLException2.prototype = Object.create(Error.prototype);
  YAMLException2.prototype.constructor = YAMLException2;
  YAMLException2.prototype.toString = function toString(compact) {
    return this.name + ": " + formatError(this, compact);
  };
  exception = YAMLException2;
  return exception;
}
var snippet;
var hasRequiredSnippet;
function requireSnippet() {
  if (hasRequiredSnippet) return snippet;
  hasRequiredSnippet = 1;
  const common2 = requireCommon();
  function getLine(buffer, lineStart, lineEnd, position, maxLineLength) {
    let head = "";
    let tail = "";
    const maxHalfLength = Math.floor(maxLineLength / 2) - 1;
    if (position - lineStart > maxHalfLength) {
      head = " ... ";
      lineStart = position - maxHalfLength + head.length;
    }
    if (lineEnd - position > maxHalfLength) {
      tail = " ...";
      lineEnd = position + maxHalfLength - tail.length;
    }
    return {
      str: head + buffer.slice(lineStart, lineEnd).replace(/\t/g, "\u2192") + tail,
      pos: position - lineStart + head.length
      // relative position
    };
  }
  function padStart(string, max) {
    return common2.repeat(" ", max - string.length) + string;
  }
  function makeSnippet(mark, options) {
    options = Object.create(options || null);
    if (!mark.buffer) return null;
    if (!options.maxLength) options.maxLength = 79;
    if (typeof options.indent !== "number") options.indent = 1;
    if (typeof options.linesBefore !== "number") options.linesBefore = 3;
    if (typeof options.linesAfter !== "number") options.linesAfter = 2;
    const re = /\r?\n|\r|\0/g;
    const lineStarts = [0];
    const lineEnds = [];
    let match;
    let foundLineNo = -1;
    while (match = re.exec(mark.buffer)) {
      lineEnds.push(match.index);
      lineStarts.push(match.index + match[0].length);
      if (mark.position <= match.index && foundLineNo < 0) {
        foundLineNo = lineStarts.length - 2;
      }
    }
    if (foundLineNo < 0) foundLineNo = lineStarts.length - 1;
    let result = "";
    const lineNoLength = Math.min(mark.line + options.linesAfter, lineEnds.length).toString().length;
    const maxLineLength = options.maxLength - (options.indent + lineNoLength + 3);
    for (let i = 1; i <= options.linesBefore; i++) {
      if (foundLineNo - i < 0) break;
      const line2 = getLine(
        mark.buffer,
        lineStarts[foundLineNo - i],
        lineEnds[foundLineNo - i],
        mark.position - (lineStarts[foundLineNo] - lineStarts[foundLineNo - i]),
        maxLineLength
      );
      result = common2.repeat(" ", options.indent) + padStart((mark.line - i + 1).toString(), lineNoLength) + " | " + line2.str + "\n" + result;
    }
    const line = getLine(mark.buffer, lineStarts[foundLineNo], lineEnds[foundLineNo], mark.position, maxLineLength);
    result += common2.repeat(" ", options.indent) + padStart((mark.line + 1).toString(), lineNoLength) + " | " + line.str + "\n";
    result += common2.repeat("-", options.indent + lineNoLength + 3 + line.pos) + "^\n";
    for (let i = 1; i <= options.linesAfter; i++) {
      if (foundLineNo + i >= lineEnds.length) break;
      const line2 = getLine(
        mark.buffer,
        lineStarts[foundLineNo + i],
        lineEnds[foundLineNo + i],
        mark.position - (lineStarts[foundLineNo] - lineStarts[foundLineNo + i]),
        maxLineLength
      );
      result += common2.repeat(" ", options.indent) + padStart((mark.line + i + 1).toString(), lineNoLength) + " | " + line2.str + "\n";
    }
    return result.replace(/\n$/, "");
  }
  snippet = makeSnippet;
  return snippet;
}
var type;
var hasRequiredType;
function requireType() {
  if (hasRequiredType) return type;
  hasRequiredType = 1;
  const YAMLException2 = requireException();
  const TYPE_CONSTRUCTOR_OPTIONS = [
    "kind",
    "multi",
    "resolve",
    "construct",
    "instanceOf",
    "predicate",
    "represent",
    "representName",
    "defaultStyle",
    "styleAliases"
  ];
  const YAML_NODE_KINDS = [
    "scalar",
    "sequence",
    "mapping"
  ];
  function compileStyleAliases(map2) {
    const result = {};
    if (map2 !== null) {
      Object.keys(map2).forEach(function(style) {
        map2[style].forEach(function(alias) {
          result[String(alias)] = style;
        });
      });
    }
    return result;
  }
  function Type2(tag, options) {
    options = options || {};
    Object.keys(options).forEach(function(name) {
      if (TYPE_CONSTRUCTOR_OPTIONS.indexOf(name) === -1) {
        throw new YAMLException2('Unknown option "' + name + '" is met in definition of "' + tag + '" YAML type.');
      }
    });
    this.options = options;
    this.tag = tag;
    this.kind = options["kind"] || null;
    this.resolve = options["resolve"] || function() {
      return true;
    };
    this.construct = options["construct"] || function(data) {
      return data;
    };
    this.instanceOf = options["instanceOf"] || null;
    this.predicate = options["predicate"] || null;
    this.represent = options["represent"] || null;
    this.representName = options["representName"] || null;
    this.defaultStyle = options["defaultStyle"] || null;
    this.multi = options["multi"] || false;
    this.styleAliases = compileStyleAliases(options["styleAliases"] || null);
    if (YAML_NODE_KINDS.indexOf(this.kind) === -1) {
      throw new YAMLException2('Unknown kind "' + this.kind + '" is specified for "' + tag + '" YAML type.');
    }
  }
  type = Type2;
  return type;
}
var schema;
var hasRequiredSchema;
function requireSchema() {
  if (hasRequiredSchema) return schema;
  hasRequiredSchema = 1;
  const YAMLException2 = requireException();
  const Type2 = requireType();
  function compileList(schema2, name) {
    const result = [];
    schema2[name].forEach(function(currentType) {
      let newIndex = result.length;
      result.forEach(function(previousType, previousIndex) {
        if (previousType.tag === currentType.tag && previousType.kind === currentType.kind && previousType.multi === currentType.multi) {
          newIndex = previousIndex;
        }
      });
      result[newIndex] = currentType;
    });
    return result;
  }
  function compileMap() {
    const result = {
      scalar: {},
      sequence: {},
      mapping: {},
      fallback: {},
      multi: {
        scalar: [],
        sequence: [],
        mapping: [],
        fallback: []
      }
    };
    function collectType(type2) {
      if (type2.multi) {
        result.multi[type2.kind].push(type2);
        result.multi["fallback"].push(type2);
      } else {
        result[type2.kind][type2.tag] = result["fallback"][type2.tag] = type2;
      }
    }
    for (let index = 0, length = arguments.length; index < length; index += 1) {
      arguments[index].forEach(collectType);
    }
    return result;
  }
  function Schema2(definition) {
    return this.extend(definition);
  }
  Schema2.prototype.extend = function extend(definition) {
    let implicit = [];
    let explicit = [];
    if (definition instanceof Type2) {
      explicit.push(definition);
    } else if (Array.isArray(definition)) {
      explicit = explicit.concat(definition);
    } else if (definition && (Array.isArray(definition.implicit) || Array.isArray(definition.explicit))) {
      if (definition.implicit) implicit = implicit.concat(definition.implicit);
      if (definition.explicit) explicit = explicit.concat(definition.explicit);
    } else {
      throw new YAMLException2("Schema.extend argument should be a Type, [ Type ], or a schema definition ({ implicit: [...], explicit: [...] })");
    }
    implicit.forEach(function(type2) {
      if (!(type2 instanceof Type2)) {
        throw new YAMLException2("Specified list of YAML types (or a single Type object) contains a non-Type object.");
      }
      if (type2.loadKind && type2.loadKind !== "scalar") {
        throw new YAMLException2("There is a non-scalar type in the implicit list of a schema. Implicit resolving of such types is not supported.");
      }
      if (type2.multi) {
        throw new YAMLException2("There is a multi type in the implicit list of a schema. Multi tags can only be listed as explicit.");
      }
    });
    explicit.forEach(function(type2) {
      if (!(type2 instanceof Type2)) {
        throw new YAMLException2("Specified list of YAML types (or a single Type object) contains a non-Type object.");
      }
    });
    const result = Object.create(Schema2.prototype);
    result.implicit = (this.implicit || []).concat(implicit);
    result.explicit = (this.explicit || []).concat(explicit);
    result.compiledImplicit = compileList(result, "implicit");
    result.compiledExplicit = compileList(result, "explicit");
    result.compiledTypeMap = compileMap(result.compiledImplicit, result.compiledExplicit);
    return result;
  };
  schema = Schema2;
  return schema;
}
var str;
var hasRequiredStr;
function requireStr() {
  if (hasRequiredStr) return str;
  hasRequiredStr = 1;
  const Type2 = requireType();
  str = new Type2("tag:yaml.org,2002:str", {
    kind: "scalar",
    construct: function(data) {
      return data !== null ? data : "";
    }
  });
  return str;
}
var seq;
var hasRequiredSeq;
function requireSeq() {
  if (hasRequiredSeq) return seq;
  hasRequiredSeq = 1;
  const Type2 = requireType();
  seq = new Type2("tag:yaml.org,2002:seq", {
    kind: "sequence",
    construct: function(data) {
      return data !== null ? data : [];
    }
  });
  return seq;
}
var map;
var hasRequiredMap;
function requireMap() {
  if (hasRequiredMap) return map;
  hasRequiredMap = 1;
  const Type2 = requireType();
  map = new Type2("tag:yaml.org,2002:map", {
    kind: "mapping",
    construct: function(data) {
      return data !== null ? data : {};
    }
  });
  return map;
}
var failsafe;
var hasRequiredFailsafe;
function requireFailsafe() {
  if (hasRequiredFailsafe) return failsafe;
  hasRequiredFailsafe = 1;
  const Schema2 = requireSchema();
  failsafe = new Schema2({
    explicit: [
      requireStr(),
      requireSeq(),
      requireMap()
    ]
  });
  return failsafe;
}
var _null;
var hasRequired_null;
function require_null() {
  if (hasRequired_null) return _null;
  hasRequired_null = 1;
  const Type2 = requireType();
  function resolveYamlNull(data) {
    if (data === null) return true;
    const max = data.length;
    return max === 1 && data === "~" || max === 4 && (data === "null" || data === "Null" || data === "NULL");
  }
  function constructYamlNull() {
    return null;
  }
  function isNull(object) {
    return object === null;
  }
  _null = new Type2("tag:yaml.org,2002:null", {
    kind: "scalar",
    resolve: resolveYamlNull,
    construct: constructYamlNull,
    predicate: isNull,
    represent: {
      canonical: function() {
        return "~";
      },
      lowercase: function() {
        return "null";
      },
      uppercase: function() {
        return "NULL";
      },
      camelcase: function() {
        return "Null";
      },
      empty: function() {
        return "";
      }
    },
    defaultStyle: "lowercase"
  });
  return _null;
}
var bool;
var hasRequiredBool;
function requireBool() {
  if (hasRequiredBool) return bool;
  hasRequiredBool = 1;
  const Type2 = requireType();
  function resolveYamlBoolean(data) {
    if (data === null) return false;
    const max = data.length;
    return max === 4 && (data === "true" || data === "True" || data === "TRUE") || max === 5 && (data === "false" || data === "False" || data === "FALSE");
  }
  function constructYamlBoolean(data) {
    return data === "true" || data === "True" || data === "TRUE";
  }
  function isBoolean(object) {
    return Object.prototype.toString.call(object) === "[object Boolean]";
  }
  bool = new Type2("tag:yaml.org,2002:bool", {
    kind: "scalar",
    resolve: resolveYamlBoolean,
    construct: constructYamlBoolean,
    predicate: isBoolean,
    represent: {
      lowercase: function(object) {
        return object ? "true" : "false";
      },
      uppercase: function(object) {
        return object ? "TRUE" : "FALSE";
      },
      camelcase: function(object) {
        return object ? "True" : "False";
      }
    },
    defaultStyle: "lowercase"
  });
  return bool;
}
var int;
var hasRequiredInt;
function requireInt() {
  if (hasRequiredInt) return int;
  hasRequiredInt = 1;
  const common2 = requireCommon();
  const Type2 = requireType();
  function isHexCode(c) {
    return c >= 48 && c <= 57 || c >= 65 && c <= 70 || c >= 97 && c <= 102;
  }
  function isOctCode(c) {
    return c >= 48 && c <= 55;
  }
  function isDecCode(c) {
    return c >= 48 && c <= 57;
  }
  function resolveYamlInteger(data) {
    if (data === null) return false;
    const max = data.length;
    let index = 0;
    let hasDigits = false;
    if (!max) return false;
    let ch = data[index];
    if (ch === "-" || ch === "+") {
      ch = data[++index];
    }
    if (ch === "0") {
      if (index + 1 === max) return true;
      ch = data[++index];
      if (ch === "b") {
        index++;
        for (; index < max; index++) {
          ch = data[index];
          if (ch !== "0" && ch !== "1") return false;
          hasDigits = true;
        }
        return hasDigits && isFinite(parseYamlInteger(data));
      }
      if (ch === "x") {
        index++;
        for (; index < max; index++) {
          if (!isHexCode(data.charCodeAt(index))) return false;
          hasDigits = true;
        }
        return hasDigits && isFinite(parseYamlInteger(data));
      }
      if (ch === "o") {
        index++;
        for (; index < max; index++) {
          if (!isOctCode(data.charCodeAt(index))) return false;
          hasDigits = true;
        }
        return hasDigits && isFinite(parseYamlInteger(data));
      }
    }
    for (; index < max; index++) {
      if (!isDecCode(data.charCodeAt(index))) {
        return false;
      }
      hasDigits = true;
    }
    if (!hasDigits) return false;
    return isFinite(parseYamlInteger(data));
  }
  function parseYamlInteger(data) {
    let value = data;
    let sign = 1;
    let ch = value[0];
    if (ch === "-" || ch === "+") {
      if (ch === "-") sign = -1;
      value = value.slice(1);
      ch = value[0];
    }
    if (value === "0") return 0;
    if (ch === "0") {
      if (value[1] === "b") return sign * parseInt(value.slice(2), 2);
      if (value[1] === "x") return sign * parseInt(value.slice(2), 16);
      if (value[1] === "o") return sign * parseInt(value.slice(2), 8);
    }
    return sign * parseInt(value, 10);
  }
  function constructYamlInteger(data) {
    return parseYamlInteger(data);
  }
  function isInteger(object) {
    return Object.prototype.toString.call(object) === "[object Number]" && (object % 1 === 0 && !common2.isNegativeZero(object));
  }
  int = new Type2("tag:yaml.org,2002:int", {
    kind: "scalar",
    resolve: resolveYamlInteger,
    construct: constructYamlInteger,
    predicate: isInteger,
    represent: {
      binary: function(obj) {
        return obj >= 0 ? "0b" + obj.toString(2) : "-0b" + obj.toString(2).slice(1);
      },
      octal: function(obj) {
        return obj >= 0 ? "0o" + obj.toString(8) : "-0o" + obj.toString(8).slice(1);
      },
      decimal: function(obj) {
        return obj.toString(10);
      },
      hexadecimal: function(obj) {
        return obj >= 0 ? "0x" + obj.toString(16).toUpperCase() : "-0x" + obj.toString(16).toUpperCase().slice(1);
      }
    },
    defaultStyle: "decimal",
    styleAliases: {
      binary: [2, "bin"],
      octal: [8, "oct"],
      decimal: [10, "dec"],
      hexadecimal: [16, "hex"]
    }
  });
  return int;
}
var float;
var hasRequiredFloat;
function requireFloat() {
  if (hasRequiredFloat) return float;
  hasRequiredFloat = 1;
  const common2 = requireCommon();
  const Type2 = requireType();
  const YAML_FLOAT_PATTERN = new RegExp(
    // 2.5e4, 2.5 and integers
    "^(?:[-+]?(?:[0-9]+)(?:\\.[0-9]*)?(?:[eE][-+]?[0-9]+)?|\\.[0-9]+(?:[eE][-+]?[0-9]+)?|[-+]?\\.(?:inf|Inf|INF)|\\.(?:nan|NaN|NAN))$"
  );
  const YAML_FLOAT_SPECIAL_PATTERN = new RegExp(
    "^(?:[-+]?\\.(?:inf|Inf|INF)|\\.(?:nan|NaN|NAN))$"
  );
  function resolveYamlFloat(data) {
    if (data === null) return false;
    if (!YAML_FLOAT_PATTERN.test(data)) {
      return false;
    }
    if (isFinite(parseFloat(data, 10))) {
      return true;
    }
    return YAML_FLOAT_SPECIAL_PATTERN.test(data);
  }
  function constructYamlFloat(data) {
    let value = data.toLowerCase();
    const sign = value[0] === "-" ? -1 : 1;
    if ("+-".indexOf(value[0]) >= 0) {
      value = value.slice(1);
    }
    if (value === ".inf") {
      return sign === 1 ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY;
    } else if (value === ".nan") {
      return NaN;
    }
    return sign * parseFloat(value, 10);
  }
  const SCIENTIFIC_WITHOUT_DOT = /^[-+]?[0-9]+e/;
  function representYamlFloat(object, style) {
    if (isNaN(object)) {
      switch (style) {
        case "lowercase":
          return ".nan";
        case "uppercase":
          return ".NAN";
        case "camelcase":
          return ".NaN";
      }
    } else if (Number.POSITIVE_INFINITY === object) {
      switch (style) {
        case "lowercase":
          return ".inf";
        case "uppercase":
          return ".INF";
        case "camelcase":
          return ".Inf";
      }
    } else if (Number.NEGATIVE_INFINITY === object) {
      switch (style) {
        case "lowercase":
          return "-.inf";
        case "uppercase":
          return "-.INF";
        case "camelcase":
          return "-.Inf";
      }
    } else if (common2.isNegativeZero(object)) {
      return "-0.0";
    }
    const res = object.toString(10);
    return SCIENTIFIC_WITHOUT_DOT.test(res) ? res.replace("e", ".e") : res;
  }
  function isFloat(object) {
    return Object.prototype.toString.call(object) === "[object Number]" && (object % 1 !== 0 || common2.isNegativeZero(object));
  }
  float = new Type2("tag:yaml.org,2002:float", {
    kind: "scalar",
    resolve: resolveYamlFloat,
    construct: constructYamlFloat,
    predicate: isFloat,
    represent: representYamlFloat,
    defaultStyle: "lowercase"
  });
  return float;
}
var json;
var hasRequiredJson;
function requireJson() {
  if (hasRequiredJson) return json;
  hasRequiredJson = 1;
  json = requireFailsafe().extend({
    implicit: [
      require_null(),
      requireBool(),
      requireInt(),
      requireFloat()
    ]
  });
  return json;
}
var core;
var hasRequiredCore;
function requireCore() {
  if (hasRequiredCore) return core;
  hasRequiredCore = 1;
  core = requireJson();
  return core;
}
var timestamp;
var hasRequiredTimestamp;
function requireTimestamp() {
  if (hasRequiredTimestamp) return timestamp;
  hasRequiredTimestamp = 1;
  const Type2 = requireType();
  const YAML_DATE_REGEXP = new RegExp(
    "^([0-9][0-9][0-9][0-9])-([0-9][0-9])-([0-9][0-9])$"
  );
  const YAML_TIMESTAMP_REGEXP = new RegExp(
    "^([0-9][0-9][0-9][0-9])-([0-9][0-9]?)-([0-9][0-9]?)(?:[Tt]|[ \\t]+)([0-9][0-9]?):([0-9][0-9]):([0-9][0-9])(?:\\.([0-9]*))?(?:[ \\t]*(Z|([-+])([0-9][0-9]?)(?::([0-9][0-9]))?))?$"
  );
  function resolveYamlTimestamp(data) {
    if (data === null) return false;
    if (YAML_DATE_REGEXP.exec(data) !== null) return true;
    if (YAML_TIMESTAMP_REGEXP.exec(data) !== null) return true;
    return false;
  }
  function constructYamlTimestamp(data) {
    let fraction = 0;
    let delta = null;
    let match = YAML_DATE_REGEXP.exec(data);
    if (match === null) match = YAML_TIMESTAMP_REGEXP.exec(data);
    if (match === null) throw new Error("Date resolve error");
    const year = +match[1];
    const month = +match[2] - 1;
    const day = +match[3];
    if (!match[4]) {
      return new Date(Date.UTC(year, month, day));
    }
    const hour = +match[4];
    const minute = +match[5];
    const second = +match[6];
    if (match[7]) {
      fraction = match[7].slice(0, 3);
      while (fraction.length < 3) {
        fraction += "0";
      }
      fraction = +fraction;
    }
    if (match[9]) {
      const tzHour = +match[10];
      const tzMinute = +(match[11] || 0);
      delta = (tzHour * 60 + tzMinute) * 6e4;
      if (match[9] === "-") delta = -delta;
    }
    const date = new Date(Date.UTC(year, month, day, hour, minute, second, fraction));
    if (delta) date.setTime(date.getTime() - delta);
    return date;
  }
  function representYamlTimestamp(object) {
    return object.toISOString();
  }
  timestamp = new Type2("tag:yaml.org,2002:timestamp", {
    kind: "scalar",
    resolve: resolveYamlTimestamp,
    construct: constructYamlTimestamp,
    instanceOf: Date,
    represent: representYamlTimestamp
  });
  return timestamp;
}
var merge;
var hasRequiredMerge;
function requireMerge() {
  if (hasRequiredMerge) return merge;
  hasRequiredMerge = 1;
  const Type2 = requireType();
  function resolveYamlMerge(data) {
    return data === "<<" || data === null;
  }
  merge = new Type2("tag:yaml.org,2002:merge", {
    kind: "scalar",
    resolve: resolveYamlMerge
  });
  return merge;
}
var binary;
var hasRequiredBinary;
function requireBinary() {
  if (hasRequiredBinary) return binary;
  hasRequiredBinary = 1;
  const Type2 = requireType();
  const BASE64_MAP = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=\n\r";
  function resolveYamlBinary(data) {
    if (data === null) return false;
    let bitlen = 0;
    const max = data.length;
    const map2 = BASE64_MAP;
    for (let idx = 0; idx < max; idx++) {
      const code = map2.indexOf(data.charAt(idx));
      if (code > 64) continue;
      if (code < 0) return false;
      bitlen += 6;
    }
    return bitlen % 8 === 0;
  }
  function constructYamlBinary(data) {
    const input = data.replace(/[\r\n=]/g, "");
    const max = input.length;
    const map2 = BASE64_MAP;
    let bits = 0;
    const result = [];
    for (let idx = 0; idx < max; idx++) {
      if (idx % 4 === 0 && idx) {
        result.push(bits >> 16 & 255);
        result.push(bits >> 8 & 255);
        result.push(bits & 255);
      }
      bits = bits << 6 | map2.indexOf(input.charAt(idx));
    }
    const tailbits = max % 4 * 6;
    if (tailbits === 0) {
      result.push(bits >> 16 & 255);
      result.push(bits >> 8 & 255);
      result.push(bits & 255);
    } else if (tailbits === 18) {
      result.push(bits >> 10 & 255);
      result.push(bits >> 2 & 255);
    } else if (tailbits === 12) {
      result.push(bits >> 4 & 255);
    }
    return new Uint8Array(result);
  }
  function representYamlBinary(object) {
    let result = "";
    let bits = 0;
    const max = object.length;
    const map2 = BASE64_MAP;
    for (let idx = 0; idx < max; idx++) {
      if (idx % 3 === 0 && idx) {
        result += map2[bits >> 18 & 63];
        result += map2[bits >> 12 & 63];
        result += map2[bits >> 6 & 63];
        result += map2[bits & 63];
      }
      bits = (bits << 8) + object[idx];
    }
    const tail = max % 3;
    if (tail === 0) {
      result += map2[bits >> 18 & 63];
      result += map2[bits >> 12 & 63];
      result += map2[bits >> 6 & 63];
      result += map2[bits & 63];
    } else if (tail === 2) {
      result += map2[bits >> 10 & 63];
      result += map2[bits >> 4 & 63];
      result += map2[bits << 2 & 63];
      result += map2[64];
    } else if (tail === 1) {
      result += map2[bits >> 2 & 63];
      result += map2[bits << 4 & 63];
      result += map2[64];
      result += map2[64];
    }
    return result;
  }
  function isBinary(obj) {
    return Object.prototype.toString.call(obj) === "[object Uint8Array]";
  }
  binary = new Type2("tag:yaml.org,2002:binary", {
    kind: "scalar",
    resolve: resolveYamlBinary,
    construct: constructYamlBinary,
    predicate: isBinary,
    represent: representYamlBinary
  });
  return binary;
}
var omap;
var hasRequiredOmap;
function requireOmap() {
  if (hasRequiredOmap) return omap;
  hasRequiredOmap = 1;
  const Type2 = requireType();
  const _hasOwnProperty = Object.prototype.hasOwnProperty;
  const _toString = Object.prototype.toString;
  function resolveYamlOmap(data) {
    if (data === null) return true;
    const objectKeys = {};
    const object = data;
    for (let index = 0, length = object.length; index < length; index += 1) {
      const pair = object[index];
      let pairHasKey = false;
      if (_toString.call(pair) !== "[object Object]") return false;
      let pairKey;
      for (pairKey in pair) {
        if (_hasOwnProperty.call(pair, pairKey)) {
          if (!pairHasKey) pairHasKey = true;
          else return false;
        }
      }
      if (!pairHasKey) return false;
      if (_hasOwnProperty.call(objectKeys, pairKey)) return false;
      Object.defineProperty(objectKeys, pairKey, { value: true });
    }
    return true;
  }
  function constructYamlOmap(data) {
    return data !== null ? data : [];
  }
  omap = new Type2("tag:yaml.org,2002:omap", {
    kind: "sequence",
    resolve: resolveYamlOmap,
    construct: constructYamlOmap
  });
  return omap;
}
var pairs;
var hasRequiredPairs;
function requirePairs() {
  if (hasRequiredPairs) return pairs;
  hasRequiredPairs = 1;
  const Type2 = requireType();
  const _toString = Object.prototype.toString;
  function resolveYamlPairs(data) {
    if (data === null) return true;
    const object = data;
    const result = new Array(object.length);
    for (let index = 0, length = object.length; index < length; index += 1) {
      const pair = object[index];
      if (_toString.call(pair) !== "[object Object]") return false;
      const keys2 = Object.keys(pair);
      if (keys2.length !== 1) return false;
      result[index] = [keys2[0], pair[keys2[0]]];
    }
    return true;
  }
  function constructYamlPairs(data) {
    if (data === null) return [];
    const object = data;
    const result = new Array(object.length);
    for (let index = 0, length = object.length; index < length; index += 1) {
      const pair = object[index];
      const keys2 = Object.keys(pair);
      result[index] = [keys2[0], pair[keys2[0]]];
    }
    return result;
  }
  pairs = new Type2("tag:yaml.org,2002:pairs", {
    kind: "sequence",
    resolve: resolveYamlPairs,
    construct: constructYamlPairs
  });
  return pairs;
}
var set;
var hasRequiredSet;
function requireSet() {
  if (hasRequiredSet) return set;
  hasRequiredSet = 1;
  const Type2 = requireType();
  const _hasOwnProperty = Object.prototype.hasOwnProperty;
  function resolveYamlSet(data) {
    if (data === null) return true;
    const object = data;
    for (const key in object) {
      if (_hasOwnProperty.call(object, key)) {
        if (object[key] !== null) return false;
      }
    }
    return true;
  }
  function constructYamlSet(data) {
    return data !== null ? data : {};
  }
  set = new Type2("tag:yaml.org,2002:set", {
    kind: "mapping",
    resolve: resolveYamlSet,
    construct: constructYamlSet
  });
  return set;
}
var _default;
var hasRequired_default;
function require_default() {
  if (hasRequired_default) return _default;
  hasRequired_default = 1;
  _default = requireCore().extend({
    implicit: [
      requireTimestamp(),
      requireMerge()
    ],
    explicit: [
      requireBinary(),
      requireOmap(),
      requirePairs(),
      requireSet()
    ]
  });
  return _default;
}
var hasRequiredLoader;
function requireLoader() {
  if (hasRequiredLoader) return loader;
  hasRequiredLoader = 1;
  const common2 = requireCommon();
  const YAMLException2 = requireException();
  const makeSnippet = requireSnippet();
  const DEFAULT_SCHEMA2 = require_default();
  const _hasOwnProperty = Object.prototype.hasOwnProperty;
  const CONTEXT_FLOW_IN = 1;
  const CONTEXT_FLOW_OUT = 2;
  const CONTEXT_BLOCK_IN = 3;
  const CONTEXT_BLOCK_OUT = 4;
  const CHOMPING_CLIP = 1;
  const CHOMPING_STRIP = 2;
  const CHOMPING_KEEP = 3;
  const PATTERN_NON_PRINTABLE = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x84\x86-\x9F\uFFFE\uFFFF]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?:[^\uD800-\uDBFF]|^)[\uDC00-\uDFFF]/;
  const PATTERN_NON_ASCII_LINE_BREAKS = /[\x85\u2028\u2029]/;
  const PATTERN_FLOW_INDICATORS = /[,\[\]{}]/;
  const PATTERN_TAG_HANDLE = /^(?:!|!!|![0-9A-Za-z-]+!)$/;
  const PATTERN_TAG_URI = /^(?:!|[^,\[\]{}])(?:%[0-9a-f]{2}|[0-9a-z\-#;/?:@&=+$,_.!~*'()\[\]])*$/i;
  function _class(obj) {
    return Object.prototype.toString.call(obj);
  }
  function isEol(c) {
    return c === 10 || c === 13;
  }
  function isWhiteSpace(c) {
    return c === 9 || c === 32;
  }
  function isWsOrEol(c) {
    return c === 9 || c === 32 || c === 10 || c === 13;
  }
  function isFlowIndicator(c) {
    return c === 44 || c === 91 || c === 93 || c === 123 || c === 125;
  }
  function fromHexCode(c) {
    if (c >= 48 && c <= 57) {
      return c - 48;
    }
    const lc = c | 32;
    if (lc >= 97 && lc <= 102) {
      return lc - 97 + 10;
    }
    return -1;
  }
  function escapedHexLen(c) {
    if (c === 120) {
      return 2;
    }
    if (c === 117) {
      return 4;
    }
    if (c === 85) {
      return 8;
    }
    return 0;
  }
  function fromDecimalCode(c) {
    if (c >= 48 && c <= 57) {
      return c - 48;
    }
    return -1;
  }
  function simpleEscapeSequence(c) {
    switch (c) {
      case 48:
        return "\0";
      case 97:
        return "\x07";
      case 98:
        return "\b";
      case 116:
        return "	";
      case 9:
        return "	";
      case 110:
        return "\n";
      case 118:
        return "\v";
      case 102:
        return "\f";
      case 114:
        return "\r";
      case 101:
        return "\x1B";
      case 32:
        return " ";
      case 34:
        return '"';
      case 47:
        return "/";
      case 92:
        return "\\";
      case 78:
        return "\x85";
      case 95:
        return "\xA0";
      case 76:
        return "\u2028";
      case 80:
        return "\u2029";
      default:
        return "";
    }
  }
  function charFromCodepoint(c) {
    if (c <= 65535) {
      return String.fromCharCode(c);
    }
    return String.fromCharCode(
      (c - 65536 >> 10) + 55296,
      (c - 65536 & 1023) + 56320
    );
  }
  function setProperty(object, key, value) {
    if (key === "__proto__") {
      Object.defineProperty(object, key, {
        configurable: true,
        enumerable: true,
        writable: true,
        value
      });
    } else {
      object[key] = value;
    }
  }
  const simpleEscapeCheck = new Array(256);
  const simpleEscapeMap = new Array(256);
  for (let i = 0; i < 256; i++) {
    simpleEscapeCheck[i] = simpleEscapeSequence(i) ? 1 : 0;
    simpleEscapeMap[i] = simpleEscapeSequence(i);
  }
  function State(input, options) {
    this.input = input;
    this.filename = options["filename"] || null;
    this.schema = options["schema"] || DEFAULT_SCHEMA2;
    this.onWarning = options["onWarning"] || null;
    this.legacy = options["legacy"] || false;
    this.json = options["json"] || false;
    this.listener = options["listener"] || null;
    this.maxDepth = typeof options["maxDepth"] === "number" ? options["maxDepth"] : 100;
    this.maxTotalMergeKeys = typeof options["maxTotalMergeKeys"] === "number" ? options["maxTotalMergeKeys"] : 1e4;
    this.implicitTypes = this.schema.compiledImplicit;
    this.typeMap = this.schema.compiledTypeMap;
    this.length = input.length;
    this.position = 0;
    this.line = 0;
    this.lineStart = 0;
    this.lineIndent = 0;
    this.depth = 0;
    this.totalMergeKeys = 0;
    this.firstTabInLine = -1;
    this.documents = [];
    this.anchorMapTransactions = [];
  }
  function generateError(state, message) {
    const mark = {
      name: state.filename,
      buffer: state.input.slice(0, -1),
      // omit trailing \0
      position: state.position,
      line: state.line,
      column: state.position - state.lineStart
    };
    mark.snippet = makeSnippet(mark);
    return new YAMLException2(message, mark);
  }
  function throwError(state, message) {
    throw generateError(state, message);
  }
  function throwWarning(state, message) {
    if (state.onWarning) {
      state.onWarning.call(null, generateError(state, message));
    }
  }
  function storeAnchor(state, name, value) {
    const transactions = state.anchorMapTransactions;
    if (transactions.length !== 0) {
      const transaction = transactions[transactions.length - 1];
      if (!_hasOwnProperty.call(transaction, name)) {
        transaction[name] = {
          existed: _hasOwnProperty.call(state.anchorMap, name),
          value: state.anchorMap[name]
        };
      }
    }
    state.anchorMap[name] = value;
  }
  function beginAnchorTransaction(state) {
    state.anchorMapTransactions.push(/* @__PURE__ */ Object.create(null));
  }
  function commitAnchorTransaction(state) {
    const transaction = state.anchorMapTransactions.pop();
    const transactions = state.anchorMapTransactions;
    if (transactions.length === 0) return;
    const parent = transactions[transactions.length - 1];
    const names = Object.keys(transaction);
    for (let index = 0, length = names.length; index < length; index += 1) {
      const name = names[index];
      if (!_hasOwnProperty.call(parent, name)) {
        parent[name] = transaction[name];
      }
    }
  }
  function rollbackAnchorTransaction(state) {
    const transaction = state.anchorMapTransactions.pop();
    const names = Object.keys(transaction);
    for (let index = names.length - 1; index >= 0; index -= 1) {
      const entry = transaction[names[index]];
      if (entry.existed) {
        state.anchorMap[names[index]] = entry.value;
      } else {
        delete state.anchorMap[names[index]];
      }
    }
  }
  function snapshotState(state) {
    return {
      position: state.position,
      line: state.line,
      lineStart: state.lineStart,
      lineIndent: state.lineIndent,
      firstTabInLine: state.firstTabInLine,
      tag: state.tag,
      anchor: state.anchor,
      kind: state.kind,
      result: state.result
    };
  }
  function restoreState(state, snapshot) {
    state.position = snapshot.position;
    state.line = snapshot.line;
    state.lineStart = snapshot.lineStart;
    state.lineIndent = snapshot.lineIndent;
    state.firstTabInLine = snapshot.firstTabInLine;
    state.tag = snapshot.tag;
    state.anchor = snapshot.anchor;
    state.kind = snapshot.kind;
    state.result = snapshot.result;
  }
  const directiveHandlers = {
    YAML: function handleYamlDirective(state, name, args) {
      if (state.version !== null) {
        throwError(state, "duplication of %YAML directive");
      }
      if (args.length !== 1) {
        throwError(state, "YAML directive accepts exactly one argument");
      }
      const match = /^([0-9]+)\.([0-9]+)$/.exec(args[0]);
      if (match === null) {
        throwError(state, "ill-formed argument of the YAML directive");
      }
      const major = parseInt(match[1], 10);
      const minor = parseInt(match[2], 10);
      if (major !== 1) {
        throwError(state, "unacceptable YAML version of the document");
      }
      state.version = args[0];
      state.checkLineBreaks = minor < 2;
      if (minor !== 1 && minor !== 2) {
        throwWarning(state, "unsupported YAML version of the document");
      }
    },
    TAG: function handleTagDirective(state, name, args) {
      let prefix;
      if (args.length !== 2) {
        throwError(state, "TAG directive accepts exactly two arguments");
      }
      const handle = args[0];
      prefix = args[1];
      if (!PATTERN_TAG_HANDLE.test(handle)) {
        throwError(state, "ill-formed tag handle (first argument) of the TAG directive");
      }
      if (_hasOwnProperty.call(state.tagMap, handle)) {
        throwError(state, 'there is a previously declared suffix for "' + handle + '" tag handle');
      }
      if (!PATTERN_TAG_URI.test(prefix)) {
        throwError(state, "ill-formed tag prefix (second argument) of the TAG directive");
      }
      try {
        prefix = decodeURIComponent(prefix);
      } catch (err) {
        throwError(state, "tag prefix is malformed: " + prefix);
      }
      state.tagMap[handle] = prefix;
    }
  };
  function captureSegment(state, start, end, checkJson) {
    if (start < end) {
      const _result = state.input.slice(start, end);
      if (checkJson) {
        for (let _position = 0, _length = _result.length; _position < _length; _position += 1) {
          const _character = _result.charCodeAt(_position);
          if (!(_character === 9 || _character >= 32 && _character <= 1114111)) {
            throwError(state, "expected valid JSON character");
          }
        }
      } else if (PATTERN_NON_PRINTABLE.test(_result)) {
        throwError(state, "the stream contains non-printable characters");
      }
      state.result += _result;
    }
  }
  function chargeMergeWork(state) {
    state.totalMergeKeys++;
    if (state.maxTotalMergeKeys !== -1 && state.totalMergeKeys > state.maxTotalMergeKeys) {
      throwError(state, "merge keys exceeded maxTotalMergeKeys (" + state.maxTotalMergeKeys + ")");
    }
  }
  function mergeMappings(state, destination, source, overridableKeys) {
    if (!common2.isObject(source)) {
      throwError(state, "cannot merge mappings; the provided source object is unacceptable");
    }
    chargeMergeWork(state);
    const sourceKeys = Object.keys(source);
    for (let index = 0, quantity = sourceKeys.length; index < quantity; index += 1) {
      const key = sourceKeys[index];
      chargeMergeWork(state);
      if (!_hasOwnProperty.call(destination, key)) {
        setProperty(destination, key, source[key]);
        overridableKeys[key] = true;
      }
    }
  }
  function storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, valueNode, startLine, startLineStart, startPos) {
    if (Array.isArray(keyNode)) {
      keyNode = Array.prototype.slice.call(keyNode);
      for (let index = 0, quantity = keyNode.length; index < quantity; index += 1) {
        if (Array.isArray(keyNode[index])) {
          throwError(state, "nested arrays are not supported inside keys");
        }
        if (typeof keyNode === "object" && _class(keyNode[index]) === "[object Object]") {
          keyNode[index] = "[object Object]";
        }
      }
    }
    if (typeof keyNode === "object" && _class(keyNode) === "[object Object]") {
      keyNode = "[object Object]";
    }
    keyNode = String(keyNode);
    if (_result === null) {
      _result = {};
    }
    if (keyTag === "tag:yaml.org,2002:merge") {
      if (Array.isArray(valueNode)) {
        if (valueNode.length > 100) {
          throwError(state, "abnormal merge sequence size");
        }
        for (let index = 0, quantity = valueNode.length; index < quantity; index += 1) {
          mergeMappings(state, _result, valueNode[index], overridableKeys);
        }
      } else {
        mergeMappings(state, _result, valueNode, overridableKeys);
      }
    } else {
      if (!state.json && !_hasOwnProperty.call(overridableKeys, keyNode) && _hasOwnProperty.call(_result, keyNode)) {
        state.line = startLine || state.line;
        state.lineStart = startLineStart || state.lineStart;
        state.position = startPos || state.position;
        throwError(state, "duplicated mapping key");
      }
      setProperty(_result, keyNode, valueNode);
      delete overridableKeys[keyNode];
    }
    return _result;
  }
  function readLineBreak(state) {
    const ch = state.input.charCodeAt(state.position);
    if (ch === 10) {
      state.position++;
    } else if (ch === 13) {
      state.position++;
      if (state.input.charCodeAt(state.position) === 10) {
        state.position++;
      }
    } else {
      throwError(state, "a line break is expected");
    }
    state.line += 1;
    state.lineStart = state.position;
    state.firstTabInLine = -1;
  }
  function skipSeparationSpace(state, allowComments, checkIndent) {
    let lineBreaks = 0;
    let ch = state.input.charCodeAt(state.position);
    while (ch !== 0) {
      while (isWhiteSpace(ch)) {
        if (ch === 9 && state.firstTabInLine === -1) {
          state.firstTabInLine = state.position;
        }
        ch = state.input.charCodeAt(++state.position);
      }
      if (allowComments && ch === 35) {
        do {
          ch = state.input.charCodeAt(++state.position);
        } while (ch !== 10 && ch !== 13 && ch !== 0);
      }
      if (isEol(ch)) {
        readLineBreak(state);
        ch = state.input.charCodeAt(state.position);
        lineBreaks++;
        state.lineIndent = 0;
        while (ch === 32) {
          state.lineIndent++;
          ch = state.input.charCodeAt(++state.position);
        }
      } else {
        break;
      }
    }
    if (checkIndent !== -1 && lineBreaks !== 0 && state.lineIndent < checkIndent) {
      throwWarning(state, "deficient indentation");
    }
    return lineBreaks;
  }
  function testDocumentSeparator(state) {
    let _position = state.position;
    let ch = state.input.charCodeAt(_position);
    if ((ch === 45 || ch === 46) && ch === state.input.charCodeAt(_position + 1) && ch === state.input.charCodeAt(_position + 2)) {
      _position += 3;
      ch = state.input.charCodeAt(_position);
      if (ch === 0 || isWsOrEol(ch)) {
        return true;
      }
    }
    return false;
  }
  function writeFoldedLines(state, count) {
    if (count === 1) {
      state.result += " ";
    } else if (count > 1) {
      state.result += common2.repeat("\n", count - 1);
    }
  }
  function readPlainScalar(state, nodeIndent, withinFlowCollection) {
    let captureStart;
    let captureEnd;
    let hasPendingContent;
    let _line;
    let _lineStart;
    let _lineIndent;
    const _kind = state.kind;
    const _result = state.result;
    let ch = state.input.charCodeAt(state.position);
    if (isWsOrEol(ch) || isFlowIndicator(ch) || ch === 35 || ch === 38 || ch === 42 || ch === 33 || ch === 124 || ch === 62 || ch === 39 || ch === 34 || ch === 37 || ch === 64 || ch === 96) {
      return false;
    }
    if (ch === 63 || ch === 45) {
      const following = state.input.charCodeAt(state.position + 1);
      if (isWsOrEol(following) || withinFlowCollection && isFlowIndicator(following)) {
        return false;
      }
    }
    state.kind = "scalar";
    state.result = "";
    captureStart = captureEnd = state.position;
    hasPendingContent = false;
    while (ch !== 0) {
      if (ch === 58) {
        const following = state.input.charCodeAt(state.position + 1);
        if (isWsOrEol(following) || withinFlowCollection && isFlowIndicator(following)) {
          break;
        }
      } else if (ch === 35) {
        const preceding = state.input.charCodeAt(state.position - 1);
        if (isWsOrEol(preceding)) {
          break;
        }
      } else if (state.position === state.lineStart && testDocumentSeparator(state) || withinFlowCollection && isFlowIndicator(ch)) {
        break;
      } else if (isEol(ch)) {
        _line = state.line;
        _lineStart = state.lineStart;
        _lineIndent = state.lineIndent;
        skipSeparationSpace(state, false, -1);
        if (state.lineIndent >= nodeIndent) {
          hasPendingContent = true;
          ch = state.input.charCodeAt(state.position);
          continue;
        } else {
          state.position = captureEnd;
          state.line = _line;
          state.lineStart = _lineStart;
          state.lineIndent = _lineIndent;
          break;
        }
      }
      if (hasPendingContent) {
        captureSegment(state, captureStart, captureEnd, false);
        writeFoldedLines(state, state.line - _line);
        captureStart = captureEnd = state.position;
        hasPendingContent = false;
      }
      if (!isWhiteSpace(ch)) {
        captureEnd = state.position + 1;
      }
      ch = state.input.charCodeAt(++state.position);
    }
    captureSegment(state, captureStart, captureEnd, false);
    if (state.result) {
      return true;
    }
    state.kind = _kind;
    state.result = _result;
    return false;
  }
  function readSingleQuotedScalar(state, nodeIndent) {
    let captureStart;
    let captureEnd;
    let ch = state.input.charCodeAt(state.position);
    if (ch !== 39) {
      return false;
    }
    state.kind = "scalar";
    state.result = "";
    state.position++;
    captureStart = captureEnd = state.position;
    while ((ch = state.input.charCodeAt(state.position)) !== 0) {
      if (ch === 39) {
        captureSegment(state, captureStart, state.position, true);
        ch = state.input.charCodeAt(++state.position);
        if (ch === 39) {
          captureStart = state.position;
          state.position++;
          captureEnd = state.position;
        } else {
          return true;
        }
      } else if (isEol(ch)) {
        captureSegment(state, captureStart, captureEnd, true);
        writeFoldedLines(state, skipSeparationSpace(state, false, nodeIndent));
        captureStart = captureEnd = state.position;
      } else if (state.position === state.lineStart && testDocumentSeparator(state)) {
        throwError(state, "unexpected end of the document within a single quoted scalar");
      } else {
        state.position++;
        if (!isWhiteSpace(ch)) {
          captureEnd = state.position;
        }
      }
    }
    throwError(state, "unexpected end of the stream within a single quoted scalar");
  }
  function readDoubleQuotedScalar(state, nodeIndent) {
    let captureStart;
    let captureEnd;
    let tmp;
    let ch = state.input.charCodeAt(state.position);
    if (ch !== 34) {
      return false;
    }
    state.kind = "scalar";
    state.result = "";
    state.position++;
    captureStart = captureEnd = state.position;
    while ((ch = state.input.charCodeAt(state.position)) !== 0) {
      if (ch === 34) {
        captureSegment(state, captureStart, state.position, true);
        state.position++;
        return true;
      } else if (ch === 92) {
        captureSegment(state, captureStart, state.position, true);
        ch = state.input.charCodeAt(++state.position);
        if (isEol(ch)) {
          skipSeparationSpace(state, false, nodeIndent);
        } else if (ch < 256 && simpleEscapeCheck[ch]) {
          state.result += simpleEscapeMap[ch];
          state.position++;
        } else if ((tmp = escapedHexLen(ch)) > 0) {
          let hexLength = tmp;
          let hexResult = 0;
          for (; hexLength > 0; hexLength--) {
            ch = state.input.charCodeAt(++state.position);
            if ((tmp = fromHexCode(ch)) >= 0) {
              hexResult = (hexResult << 4) + tmp;
            } else {
              throwError(state, "expected hexadecimal character");
            }
          }
          state.result += charFromCodepoint(hexResult);
          state.position++;
        } else {
          throwError(state, "unknown escape sequence");
        }
        captureStart = captureEnd = state.position;
      } else if (isEol(ch)) {
        captureSegment(state, captureStart, captureEnd, true);
        writeFoldedLines(state, skipSeparationSpace(state, false, nodeIndent));
        captureStart = captureEnd = state.position;
      } else if (state.position === state.lineStart && testDocumentSeparator(state)) {
        throwError(state, "unexpected end of the document within a double quoted scalar");
      } else {
        state.position++;
        if (!isWhiteSpace(ch)) {
          captureEnd = state.position;
        }
      }
    }
    throwError(state, "unexpected end of the stream within a double quoted scalar");
  }
  function readFlowCollection(state, nodeIndent) {
    let readNext = true;
    let _line;
    let _lineStart;
    let _pos;
    const _tag = state.tag;
    let _result;
    const _anchor = state.anchor;
    let terminator;
    let isPair;
    let isExplicitPair;
    let isMapping;
    const overridableKeys = /* @__PURE__ */ Object.create(null);
    let keyNode;
    let keyTag;
    let valueNode;
    let ch = state.input.charCodeAt(state.position);
    if (ch === 91) {
      terminator = 93;
      isMapping = false;
      _result = [];
    } else if (ch === 123) {
      terminator = 125;
      isMapping = true;
      _result = {};
    } else {
      return false;
    }
    if (state.anchor !== null) {
      storeAnchor(state, state.anchor, _result);
    }
    ch = state.input.charCodeAt(++state.position);
    while (ch !== 0) {
      skipSeparationSpace(state, true, nodeIndent);
      ch = state.input.charCodeAt(state.position);
      if (ch === terminator) {
        state.position++;
        state.tag = _tag;
        state.anchor = _anchor;
        state.kind = isMapping ? "mapping" : "sequence";
        state.result = _result;
        return true;
      } else if (!readNext) {
        throwError(state, "missed comma between flow collection entries");
      } else if (ch === 44) {
        throwError(state, "expected the node content, but found ','");
      }
      keyTag = keyNode = valueNode = null;
      isPair = isExplicitPair = false;
      if (ch === 63) {
        const following = state.input.charCodeAt(state.position + 1);
        if (isWsOrEol(following)) {
          isPair = isExplicitPair = true;
          state.position++;
          skipSeparationSpace(state, true, nodeIndent);
        }
      }
      _line = state.line;
      _lineStart = state.lineStart;
      _pos = state.position;
      composeNode(state, nodeIndent, CONTEXT_FLOW_IN, false, true);
      keyTag = state.tag;
      keyNode = state.result;
      skipSeparationSpace(state, true, nodeIndent);
      ch = state.input.charCodeAt(state.position);
      if ((isExplicitPair || state.line === _line) && ch === 58) {
        isPair = true;
        ch = state.input.charCodeAt(++state.position);
        skipSeparationSpace(state, true, nodeIndent);
        composeNode(state, nodeIndent, CONTEXT_FLOW_IN, false, true);
        valueNode = state.result;
      }
      if (isMapping) {
        storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, valueNode, _line, _lineStart, _pos);
      } else if (isPair) {
        _result.push(storeMappingPair(state, null, overridableKeys, keyTag, keyNode, valueNode, _line, _lineStart, _pos));
      } else {
        _result.push(keyNode);
      }
      skipSeparationSpace(state, true, nodeIndent);
      ch = state.input.charCodeAt(state.position);
      if (ch === 44) {
        readNext = true;
        ch = state.input.charCodeAt(++state.position);
      } else {
        readNext = false;
      }
    }
    throwError(state, "unexpected end of the stream within a flow collection");
  }
  function readBlockScalar(state, nodeIndent) {
    let folding;
    let chomping = CHOMPING_CLIP;
    let didReadContent = false;
    let detectedIndent = false;
    let textIndent = nodeIndent;
    let emptyLines = 0;
    let atMoreIndented = false;
    let tmp;
    let ch = state.input.charCodeAt(state.position);
    if (ch === 124) {
      folding = false;
    } else if (ch === 62) {
      folding = true;
    } else {
      return false;
    }
    state.kind = "scalar";
    state.result = "";
    while (ch !== 0) {
      ch = state.input.charCodeAt(++state.position);
      if (ch === 43 || ch === 45) {
        if (CHOMPING_CLIP === chomping) {
          chomping = ch === 43 ? CHOMPING_KEEP : CHOMPING_STRIP;
        } else {
          throwError(state, "repeat of a chomping mode identifier");
        }
      } else if ((tmp = fromDecimalCode(ch)) >= 0) {
        if (tmp === 0) {
          throwError(state, "bad explicit indentation width of a block scalar; it cannot be less than one");
        } else if (!detectedIndent) {
          textIndent = nodeIndent + tmp - 1;
          detectedIndent = true;
        } else {
          throwError(state, "repeat of an indentation width identifier");
        }
      } else {
        break;
      }
    }
    if (isWhiteSpace(ch)) {
      do {
        ch = state.input.charCodeAt(++state.position);
      } while (isWhiteSpace(ch));
      if (ch === 35) {
        do {
          ch = state.input.charCodeAt(++state.position);
        } while (!isEol(ch) && ch !== 0);
      }
    }
    while (ch !== 0) {
      readLineBreak(state);
      state.lineIndent = 0;
      ch = state.input.charCodeAt(state.position);
      while ((!detectedIndent || state.lineIndent < textIndent) && ch === 32) {
        state.lineIndent++;
        ch = state.input.charCodeAt(++state.position);
      }
      if (!detectedIndent && state.lineIndent > textIndent) {
        textIndent = state.lineIndent;
      }
      if (isEol(ch)) {
        emptyLines++;
        continue;
      }
      if (!detectedIndent && textIndent === 0) {
        throwError(state, "missing indentation for block scalar");
      }
      if (state.lineIndent < textIndent) {
        if (chomping === CHOMPING_KEEP) {
          state.result += common2.repeat("\n", didReadContent ? 1 + emptyLines : emptyLines);
        } else if (chomping === CHOMPING_CLIP) {
          if (didReadContent) {
            state.result += "\n";
          }
        }
        break;
      }
      if (folding) {
        if (isWhiteSpace(ch)) {
          atMoreIndented = true;
          state.result += common2.repeat("\n", didReadContent ? 1 + emptyLines : emptyLines);
        } else if (atMoreIndented) {
          atMoreIndented = false;
          state.result += common2.repeat("\n", emptyLines + 1);
        } else if (emptyLines === 0) {
          if (didReadContent) {
            state.result += " ";
          }
        } else {
          state.result += common2.repeat("\n", emptyLines);
        }
      } else {
        state.result += common2.repeat("\n", didReadContent ? 1 + emptyLines : emptyLines);
      }
      didReadContent = true;
      detectedIndent = true;
      emptyLines = 0;
      const captureStart = state.position;
      while (!isEol(ch) && ch !== 0) {
        ch = state.input.charCodeAt(++state.position);
      }
      captureSegment(state, captureStart, state.position, false);
    }
    return true;
  }
  function readBlockSequence(state, nodeIndent) {
    const _tag = state.tag;
    const _anchor = state.anchor;
    const _result = [];
    let detected = false;
    if (state.firstTabInLine !== -1) return false;
    if (state.anchor !== null) {
      storeAnchor(state, state.anchor, _result);
    }
    let ch = state.input.charCodeAt(state.position);
    while (ch !== 0) {
      if (state.firstTabInLine !== -1) {
        state.position = state.firstTabInLine;
        throwError(state, "tab characters must not be used in indentation");
      }
      if (ch !== 45) {
        break;
      }
      const following = state.input.charCodeAt(state.position + 1);
      if (!isWsOrEol(following)) {
        break;
      }
      detected = true;
      state.position++;
      if (skipSeparationSpace(state, true, -1)) {
        if (state.lineIndent <= nodeIndent) {
          _result.push(null);
          ch = state.input.charCodeAt(state.position);
          continue;
        }
      }
      const _line = state.line;
      composeNode(state, nodeIndent, CONTEXT_BLOCK_IN, false, true);
      _result.push(state.result);
      skipSeparationSpace(state, true, -1);
      ch = state.input.charCodeAt(state.position);
      if ((state.line === _line || state.lineIndent > nodeIndent) && ch !== 0) {
        throwError(state, "bad indentation of a sequence entry");
      } else if (state.lineIndent < nodeIndent) {
        break;
      }
    }
    if (detected) {
      state.tag = _tag;
      state.anchor = _anchor;
      state.kind = "sequence";
      state.result = _result;
      return true;
    }
    return false;
  }
  function readBlockMapping(state, nodeIndent, flowIndent) {
    let allowCompact;
    let _keyLine;
    let _keyLineStart;
    let _keyPos;
    const _tag = state.tag;
    const _anchor = state.anchor;
    const _result = {};
    const overridableKeys = /* @__PURE__ */ Object.create(null);
    let keyTag = null;
    let keyNode = null;
    let valueNode = null;
    let atExplicitKey = false;
    let detected = false;
    if (state.firstTabInLine !== -1) return false;
    if (state.anchor !== null) {
      storeAnchor(state, state.anchor, _result);
    }
    let ch = state.input.charCodeAt(state.position);
    while (ch !== 0) {
      if (!atExplicitKey && state.firstTabInLine !== -1) {
        state.position = state.firstTabInLine;
        throwError(state, "tab characters must not be used in indentation");
      }
      const following = state.input.charCodeAt(state.position + 1);
      const _line = state.line;
      if ((ch === 63 || ch === 58) && isWsOrEol(following)) {
        if (ch === 63) {
          if (atExplicitKey) {
            storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, null, _keyLine, _keyLineStart, _keyPos);
            keyTag = keyNode = valueNode = null;
          }
          detected = true;
          atExplicitKey = true;
          allowCompact = true;
        } else if (atExplicitKey) {
          atExplicitKey = false;
          allowCompact = true;
        } else {
          throwError(state, "incomplete explicit mapping pair; a key node is missed; or followed by a non-tabulated empty line");
        }
        state.position += 1;
        ch = following;
      } else {
        _keyLine = state.line;
        _keyLineStart = state.lineStart;
        _keyPos = state.position;
        if (!composeNode(state, flowIndent, CONTEXT_FLOW_OUT, false, true)) {
          break;
        }
        if (state.line === _line) {
          ch = state.input.charCodeAt(state.position);
          while (isWhiteSpace(ch)) {
            ch = state.input.charCodeAt(++state.position);
          }
          if (ch === 58) {
            ch = state.input.charCodeAt(++state.position);
            if (!isWsOrEol(ch)) {
              throwError(state, "a whitespace character is expected after the key-value separator within a block mapping");
            }
            if (atExplicitKey) {
              storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, null, _keyLine, _keyLineStart, _keyPos);
              keyTag = keyNode = valueNode = null;
            }
            detected = true;
            atExplicitKey = false;
            allowCompact = false;
            keyTag = state.tag;
            keyNode = state.result;
          } else if (detected) {
            throwError(state, "can not read an implicit mapping pair; a colon is missed");
          } else {
            state.tag = _tag;
            state.anchor = _anchor;
            return true;
          }
        } else if (detected) {
          throwError(state, "can not read a block mapping entry; a multiline key may not be an implicit key");
        } else {
          state.tag = _tag;
          state.anchor = _anchor;
          return true;
        }
      }
      if (state.line === _line || state.lineIndent > nodeIndent) {
        if (atExplicitKey) {
          _keyLine = state.line;
          _keyLineStart = state.lineStart;
          _keyPos = state.position;
        }
        if (composeNode(state, nodeIndent, CONTEXT_BLOCK_OUT, true, allowCompact)) {
          if (atExplicitKey) {
            keyNode = state.result;
          } else {
            valueNode = state.result;
          }
        }
        if (!atExplicitKey) {
          storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, valueNode, _keyLine, _keyLineStart, _keyPos);
          keyTag = keyNode = valueNode = null;
        }
        skipSeparationSpace(state, true, -1);
        ch = state.input.charCodeAt(state.position);
      }
      if ((state.line === _line || state.lineIndent > nodeIndent) && ch !== 0) {
        throwError(state, "bad indentation of a mapping entry");
      } else if (state.lineIndent < nodeIndent) {
        break;
      }
    }
    if (atExplicitKey) {
      storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, null, _keyLine, _keyLineStart, _keyPos);
    }
    if (detected) {
      state.tag = _tag;
      state.anchor = _anchor;
      state.kind = "mapping";
      state.result = _result;
    }
    return detected;
  }
  function readTagProperty(state) {
    let isVerbatim = false;
    let isNamed = false;
    let tagHandle;
    let tagName;
    let ch = state.input.charCodeAt(state.position);
    if (ch !== 33) return false;
    if (state.tag !== null) {
      throwError(state, "duplication of a tag property");
    }
    ch = state.input.charCodeAt(++state.position);
    if (ch === 60) {
      isVerbatim = true;
      ch = state.input.charCodeAt(++state.position);
    } else if (ch === 33) {
      isNamed = true;
      tagHandle = "!!";
      ch = state.input.charCodeAt(++state.position);
    } else {
      tagHandle = "!";
    }
    let _position = state.position;
    if (isVerbatim) {
      do {
        ch = state.input.charCodeAt(++state.position);
      } while (ch !== 0 && ch !== 62);
      if (state.position < state.length) {
        tagName = state.input.slice(_position, state.position);
        ch = state.input.charCodeAt(++state.position);
      } else {
        throwError(state, "unexpected end of the stream within a verbatim tag");
      }
    } else {
      while (ch !== 0 && !isWsOrEol(ch)) {
        if (ch === 33) {
          if (!isNamed) {
            tagHandle = state.input.slice(_position - 1, state.position + 1);
            if (!PATTERN_TAG_HANDLE.test(tagHandle)) {
              throwError(state, "named tag handle cannot contain such characters");
            }
            isNamed = true;
            _position = state.position + 1;
          } else {
            throwError(state, "tag suffix cannot contain exclamation marks");
          }
        }
        ch = state.input.charCodeAt(++state.position);
      }
      tagName = state.input.slice(_position, state.position);
      if (PATTERN_FLOW_INDICATORS.test(tagName)) {
        throwError(state, "tag suffix cannot contain flow indicator characters");
      }
    }
    if (tagName && !PATTERN_TAG_URI.test(tagName)) {
      throwError(state, "tag name cannot contain such characters: " + tagName);
    }
    try {
      tagName = decodeURIComponent(tagName);
    } catch (err) {
      throwError(state, "tag name is malformed: " + tagName);
    }
    if (isVerbatim) {
      state.tag = tagName;
    } else if (_hasOwnProperty.call(state.tagMap, tagHandle)) {
      state.tag = state.tagMap[tagHandle] + tagName;
    } else if (tagHandle === "!") {
      state.tag = "!" + tagName;
    } else if (tagHandle === "!!") {
      state.tag = "tag:yaml.org,2002:" + tagName;
    } else {
      throwError(state, 'undeclared tag handle "' + tagHandle + '"');
    }
    return true;
  }
  function readAnchorProperty(state) {
    let ch = state.input.charCodeAt(state.position);
    if (ch !== 38) return false;
    if (state.anchor !== null) {
      throwError(state, "duplication of an anchor property");
    }
    ch = state.input.charCodeAt(++state.position);
    const _position = state.position;
    while (ch !== 0 && !isWsOrEol(ch) && !isFlowIndicator(ch)) {
      ch = state.input.charCodeAt(++state.position);
    }
    if (state.position === _position) {
      throwError(state, "name of an anchor node must contain at least one character");
    }
    state.anchor = state.input.slice(_position, state.position);
    return true;
  }
  function readAlias(state) {
    let ch = state.input.charCodeAt(state.position);
    if (ch !== 42) return false;
    ch = state.input.charCodeAt(++state.position);
    const _position = state.position;
    while (ch !== 0 && !isWsOrEol(ch) && !isFlowIndicator(ch)) {
      ch = state.input.charCodeAt(++state.position);
    }
    if (state.position === _position) {
      throwError(state, "name of an alias node must contain at least one character");
    }
    const alias = state.input.slice(_position, state.position);
    if (!_hasOwnProperty.call(state.anchorMap, alias)) {
      throwError(state, 'unidentified alias "' + alias + '"');
    }
    state.result = state.anchorMap[alias];
    skipSeparationSpace(state, true, -1);
    return true;
  }
  function tryReadBlockMappingFromProperty(state, propertyStart, nodeIndent, flowIndent) {
    const fallbackState = snapshotState(state);
    beginAnchorTransaction(state);
    restoreState(state, propertyStart);
    state.tag = null;
    state.anchor = null;
    state.kind = null;
    state.result = null;
    if (readBlockMapping(state, nodeIndent, flowIndent) && state.kind === "mapping") {
      commitAnchorTransaction(state);
      return true;
    }
    rollbackAnchorTransaction(state);
    restoreState(state, fallbackState);
    return false;
  }
  function composeNode(state, parentIndent, nodeContext, allowToSeek, allowCompact) {
    let allowBlockScalars;
    let allowBlockCollections;
    let indentStatus = 1;
    let atNewLine = false;
    let hasContent = false;
    let propertyStart = null;
    let type2;
    let flowIndent;
    let blockIndent;
    if (state.depth >= state.maxDepth) {
      throwError(state, "nesting exceeded maxDepth (" + state.maxDepth + ")");
    }
    state.depth += 1;
    if (state.listener !== null) {
      state.listener("open", state);
    }
    state.tag = null;
    state.anchor = null;
    state.kind = null;
    state.result = null;
    const allowBlockStyles = allowBlockScalars = allowBlockCollections = CONTEXT_BLOCK_OUT === nodeContext || CONTEXT_BLOCK_IN === nodeContext;
    if (allowToSeek) {
      if (skipSeparationSpace(state, true, -1)) {
        atNewLine = true;
        if (state.lineIndent > parentIndent) {
          indentStatus = 1;
        } else if (state.lineIndent === parentIndent) {
          indentStatus = 0;
        } else if (state.lineIndent < parentIndent) {
          indentStatus = -1;
        }
      }
    }
    if (indentStatus === 1) {
      while (true) {
        const ch = state.input.charCodeAt(state.position);
        const propertyState = snapshotState(state);
        if (atNewLine && (ch === 33 && state.tag !== null || ch === 38 && state.anchor !== null)) {
          break;
        }
        if (!readTagProperty(state) && !readAnchorProperty(state)) {
          break;
        }
        if (propertyStart === null) {
          propertyStart = propertyState;
        }
        if (skipSeparationSpace(state, true, -1)) {
          atNewLine = true;
          allowBlockCollections = allowBlockStyles;
          if (state.lineIndent > parentIndent) {
            indentStatus = 1;
          } else if (state.lineIndent === parentIndent) {
            indentStatus = 0;
          } else if (state.lineIndent < parentIndent) {
            indentStatus = -1;
          }
        } else {
          allowBlockCollections = false;
        }
      }
    }
    if (allowBlockCollections) {
      allowBlockCollections = atNewLine || allowCompact;
    }
    if (indentStatus === 1 || CONTEXT_BLOCK_OUT === nodeContext) {
      if (CONTEXT_FLOW_IN === nodeContext || CONTEXT_FLOW_OUT === nodeContext) {
        flowIndent = parentIndent;
      } else {
        flowIndent = parentIndent + 1;
      }
      blockIndent = state.position - state.lineStart;
      if (indentStatus === 1) {
        if (allowBlockCollections && (readBlockSequence(state, blockIndent) || readBlockMapping(state, blockIndent, flowIndent)) || readFlowCollection(state, flowIndent)) {
          hasContent = true;
        } else {
          const ch = state.input.charCodeAt(state.position);
          if (propertyStart !== null && allowBlockStyles && !allowBlockCollections && ch !== 124 && ch !== 62 && tryReadBlockMappingFromProperty(
            state,
            propertyStart,
            propertyStart.position - propertyStart.lineStart,
            flowIndent
          )) {
            hasContent = true;
          } else if (allowBlockScalars && readBlockScalar(state, flowIndent) || readSingleQuotedScalar(state, flowIndent) || readDoubleQuotedScalar(state, flowIndent)) {
            hasContent = true;
          } else if (readAlias(state)) {
            hasContent = true;
            if (state.tag !== null || state.anchor !== null) {
              throwError(state, "alias node should not have any properties");
            }
          } else if (readPlainScalar(state, flowIndent, CONTEXT_FLOW_IN === nodeContext)) {
            hasContent = true;
            if (state.tag === null) {
              state.tag = "?";
            }
          }
          if (state.anchor !== null) {
            storeAnchor(state, state.anchor, state.result);
          }
        }
      } else if (indentStatus === 0) {
        hasContent = allowBlockCollections && readBlockSequence(state, blockIndent);
      }
    }
    if (state.tag === null) {
      if (state.anchor !== null) {
        storeAnchor(state, state.anchor, state.result);
      }
    } else if (state.tag === "?") {
      if (state.result !== null && state.kind !== "scalar") {
        throwError(state, 'unacceptable node kind for !<?> tag; it should be "scalar", not "' + state.kind + '"');
      }
      for (let typeIndex = 0, typeQuantity = state.implicitTypes.length; typeIndex < typeQuantity; typeIndex += 1) {
        type2 = state.implicitTypes[typeIndex];
        if (type2.resolve(state.result)) {
          state.result = type2.construct(state.result);
          state.tag = type2.tag;
          if (state.anchor !== null) {
            storeAnchor(state, state.anchor, state.result);
          }
          break;
        }
      }
    } else if (state.tag !== "!") {
      if (_hasOwnProperty.call(state.typeMap[state.kind || "fallback"], state.tag)) {
        type2 = state.typeMap[state.kind || "fallback"][state.tag];
      } else {
        type2 = null;
        const typeList = state.typeMap.multi[state.kind || "fallback"];
        for (let typeIndex = 0, typeQuantity = typeList.length; typeIndex < typeQuantity; typeIndex += 1) {
          if (state.tag.slice(0, typeList[typeIndex].tag.length) === typeList[typeIndex].tag) {
            type2 = typeList[typeIndex];
            break;
          }
        }
      }
      if (!type2) {
        throwError(state, "unknown tag !<" + state.tag + ">");
      }
      if (state.result !== null && type2.kind !== state.kind) {
        throwError(state, "unacceptable node kind for !<" + state.tag + '> tag; it should be "' + type2.kind + '", not "' + state.kind + '"');
      }
      if (!type2.resolve(state.result, state.tag)) {
        throwError(state, "cannot resolve a node with !<" + state.tag + "> explicit tag");
      } else {
        state.result = type2.construct(state.result, state.tag);
        if (state.anchor !== null) {
          storeAnchor(state, state.anchor, state.result);
        }
      }
    }
    if (state.listener !== null) {
      state.listener("close", state);
    }
    state.depth -= 1;
    return state.tag !== null || state.anchor !== null || hasContent;
  }
  function readDocument(state) {
    const documentStart = state.position;
    let hasDirectives = false;
    let ch;
    state.version = null;
    state.checkLineBreaks = state.legacy;
    state.tagMap = /* @__PURE__ */ Object.create(null);
    state.anchorMap = /* @__PURE__ */ Object.create(null);
    while ((ch = state.input.charCodeAt(state.position)) !== 0) {
      skipSeparationSpace(state, true, -1);
      ch = state.input.charCodeAt(state.position);
      if (state.lineIndent > 0 || ch !== 37) {
        break;
      }
      hasDirectives = true;
      ch = state.input.charCodeAt(++state.position);
      let _position = state.position;
      while (ch !== 0 && !isWsOrEol(ch)) {
        ch = state.input.charCodeAt(++state.position);
      }
      const directiveName = state.input.slice(_position, state.position);
      const directiveArgs = [];
      if (directiveName.length < 1) {
        throwError(state, "directive name must not be less than one character in length");
      }
      while (ch !== 0) {
        while (isWhiteSpace(ch)) {
          ch = state.input.charCodeAt(++state.position);
        }
        if (ch === 35) {
          do {
            ch = state.input.charCodeAt(++state.position);
          } while (ch !== 0 && !isEol(ch));
          break;
        }
        if (isEol(ch)) break;
        _position = state.position;
        while (ch !== 0 && !isWsOrEol(ch)) {
          ch = state.input.charCodeAt(++state.position);
        }
        directiveArgs.push(state.input.slice(_position, state.position));
      }
      if (ch !== 0) readLineBreak(state);
      if (_hasOwnProperty.call(directiveHandlers, directiveName)) {
        directiveHandlers[directiveName](state, directiveName, directiveArgs);
      } else {
        throwWarning(state, 'unknown document directive "' + directiveName + '"');
      }
    }
    skipSeparationSpace(state, true, -1);
    if (state.lineIndent === 0 && state.input.charCodeAt(state.position) === 45 && state.input.charCodeAt(state.position + 1) === 45 && state.input.charCodeAt(state.position + 2) === 45) {
      state.position += 3;
      skipSeparationSpace(state, true, -1);
    } else if (hasDirectives) {
      throwError(state, "directives end mark is expected");
    }
    composeNode(state, state.lineIndent - 1, CONTEXT_BLOCK_OUT, false, true);
    skipSeparationSpace(state, true, -1);
    if (state.checkLineBreaks && PATTERN_NON_ASCII_LINE_BREAKS.test(state.input.slice(documentStart, state.position))) {
      throwWarning(state, "non-ASCII line breaks are interpreted as content");
    }
    state.documents.push(state.result);
    if (state.position === state.lineStart && testDocumentSeparator(state)) {
      if (state.input.charCodeAt(state.position) === 46) {
        state.position += 3;
        skipSeparationSpace(state, true, -1);
      }
      return;
    }
    if (state.position < state.length - 1) {
      throwError(state, "end of the stream or a document separator is expected");
    }
  }
  function loadDocuments(input, options) {
    input = String(input);
    options = options || {};
    if (input.length !== 0) {
      if (input.charCodeAt(input.length - 1) !== 10 && input.charCodeAt(input.length - 1) !== 13) {
        input += "\n";
      }
      if (input.charCodeAt(0) === 65279) {
        input = input.slice(1);
      }
    }
    const state = new State(input, options);
    const nullpos = input.indexOf("\0");
    if (nullpos !== -1) {
      state.position = nullpos;
      throwError(state, "null byte is not allowed in input");
    }
    state.input += "\0";
    while (state.input.charCodeAt(state.position) === 32) {
      state.lineIndent += 1;
      state.position += 1;
    }
    while (state.position < state.length - 1) {
      readDocument(state);
    }
    return state.documents;
  }
  function loadAll2(input, iterator, options) {
    if (iterator !== null && typeof iterator === "object" && typeof options === "undefined") {
      options = iterator;
      iterator = null;
    }
    const documents = loadDocuments(input, options);
    if (typeof iterator !== "function") {
      return documents;
    }
    for (let index = 0, length = documents.length; index < length; index += 1) {
      iterator(documents[index]);
    }
  }
  function load2(input, options) {
    const documents = loadDocuments(input, options);
    if (documents.length === 0) {
      return void 0;
    } else if (documents.length === 1) {
      return documents[0];
    }
    throw new YAMLException2("expected a single document in the stream, but found more");
  }
  loader.loadAll = loadAll2;
  loader.load = load2;
  return loader;
}
var dumper = {};
var hasRequiredDumper;
function requireDumper() {
  if (hasRequiredDumper) return dumper;
  hasRequiredDumper = 1;
  const common2 = requireCommon();
  const YAMLException2 = requireException();
  const DEFAULT_SCHEMA2 = require_default();
  const _toString = Object.prototype.toString;
  const _hasOwnProperty = Object.prototype.hasOwnProperty;
  const CHAR_BOM = 65279;
  const CHAR_TAB = 9;
  const CHAR_LINE_FEED = 10;
  const CHAR_CARRIAGE_RETURN = 13;
  const CHAR_SPACE = 32;
  const CHAR_EXCLAMATION = 33;
  const CHAR_DOUBLE_QUOTE = 34;
  const CHAR_SHARP = 35;
  const CHAR_PERCENT = 37;
  const CHAR_AMPERSAND = 38;
  const CHAR_SINGLE_QUOTE = 39;
  const CHAR_ASTERISK = 42;
  const CHAR_COMMA = 44;
  const CHAR_MINUS = 45;
  const CHAR_COLON = 58;
  const CHAR_EQUALS = 61;
  const CHAR_GREATER_THAN = 62;
  const CHAR_QUESTION = 63;
  const CHAR_COMMERCIAL_AT = 64;
  const CHAR_LEFT_SQUARE_BRACKET = 91;
  const CHAR_RIGHT_SQUARE_BRACKET = 93;
  const CHAR_GRAVE_ACCENT = 96;
  const CHAR_LEFT_CURLY_BRACKET = 123;
  const CHAR_VERTICAL_LINE = 124;
  const CHAR_RIGHT_CURLY_BRACKET = 125;
  const ESCAPE_SEQUENCES = {};
  ESCAPE_SEQUENCES[0] = "\\0";
  ESCAPE_SEQUENCES[7] = "\\a";
  ESCAPE_SEQUENCES[8] = "\\b";
  ESCAPE_SEQUENCES[9] = "\\t";
  ESCAPE_SEQUENCES[10] = "\\n";
  ESCAPE_SEQUENCES[11] = "\\v";
  ESCAPE_SEQUENCES[12] = "\\f";
  ESCAPE_SEQUENCES[13] = "\\r";
  ESCAPE_SEQUENCES[27] = "\\e";
  ESCAPE_SEQUENCES[34] = '\\"';
  ESCAPE_SEQUENCES[92] = "\\\\";
  ESCAPE_SEQUENCES[133] = "\\N";
  ESCAPE_SEQUENCES[160] = "\\_";
  ESCAPE_SEQUENCES[8232] = "\\L";
  ESCAPE_SEQUENCES[8233] = "\\P";
  const DEPRECATED_BOOLEANS_SYNTAX = [
    "y",
    "Y",
    "yes",
    "Yes",
    "YES",
    "on",
    "On",
    "ON",
    "n",
    "N",
    "no",
    "No",
    "NO",
    "off",
    "Off",
    "OFF"
  ];
  const DEPRECATED_BASE60_SYNTAX = /^[-+]?[0-9_]+(?::[0-9_]+)+(?:\.[0-9_]*)?$/;
  function compileStyleMap(schema2, map2) {
    if (map2 === null) return {};
    const result = {};
    const keys2 = Object.keys(map2);
    for (let index = 0, length = keys2.length; index < length; index += 1) {
      let tag = keys2[index];
      let style = String(map2[tag]);
      if (tag.slice(0, 2) === "!!") {
        tag = "tag:yaml.org,2002:" + tag.slice(2);
      }
      const type2 = schema2.compiledTypeMap["fallback"][tag];
      if (type2 && _hasOwnProperty.call(type2.styleAliases, style)) {
        style = type2.styleAliases[style];
      }
      result[tag] = style;
    }
    return result;
  }
  function encodeHex(character) {
    let handle;
    let length;
    const string = character.toString(16).toUpperCase();
    if (character <= 255) {
      handle = "x";
      length = 2;
    } else if (character <= 65535) {
      handle = "u";
      length = 4;
    } else if (character <= 4294967295) {
      handle = "U";
      length = 8;
    } else {
      throw new YAMLException2("code point within a string may not be greater than 0xFFFFFFFF");
    }
    return "\\" + handle + common2.repeat("0", length - string.length) + string;
  }
  const QUOTING_TYPE_SINGLE = 1;
  const QUOTING_TYPE_DOUBLE = 2;
  function State(options) {
    this.schema = options["schema"] || DEFAULT_SCHEMA2;
    this.indent = Math.max(1, options["indent"] || 2);
    this.noArrayIndent = options["noArrayIndent"] || false;
    this.skipInvalid = options["skipInvalid"] || false;
    this.flowLevel = common2.isNothing(options["flowLevel"]) ? -1 : options["flowLevel"];
    this.styleMap = compileStyleMap(this.schema, options["styles"] || null);
    this.sortKeys = options["sortKeys"] || false;
    this.lineWidth = options["lineWidth"] || 80;
    this.noRefs = options["noRefs"] || false;
    this.noCompatMode = options["noCompatMode"] || false;
    this.condenseFlow = options["condenseFlow"] || false;
    this.quotingType = options["quotingType"] === '"' ? QUOTING_TYPE_DOUBLE : QUOTING_TYPE_SINGLE;
    this.forceQuotes = options["forceQuotes"] || false;
    this.replacer = typeof options["replacer"] === "function" ? options["replacer"] : null;
    this.implicitTypes = this.schema.compiledImplicit;
    this.explicitTypes = this.schema.compiledExplicit;
    this.tag = null;
    this.result = "";
    this.duplicates = [];
    this.usedDuplicates = null;
  }
  function indentString(string, spaces) {
    const ind = common2.repeat(" ", spaces);
    let position = 0;
    let result = "";
    const length = string.length;
    while (position < length) {
      let line;
      const next = string.indexOf("\n", position);
      if (next === -1) {
        line = string.slice(position);
        position = length;
      } else {
        line = string.slice(position, next + 1);
        position = next + 1;
      }
      if (line.length && line !== "\n") result += ind;
      result += line;
    }
    return result;
  }
  function generateNextLine(state, level) {
    return "\n" + common2.repeat(" ", state.indent * level);
  }
  function testImplicitResolving(state, str2) {
    for (let index = 0, length = state.implicitTypes.length; index < length; index += 1) {
      const type2 = state.implicitTypes[index];
      if (type2.resolve(str2)) {
        return true;
      }
    }
    return false;
  }
  function isWhitespace(c) {
    return c === CHAR_SPACE || c === CHAR_TAB;
  }
  function isPrintable(c) {
    return c >= 32 && c <= 126 || c >= 161 && c <= 55295 && c !== 8232 && c !== 8233 || c >= 57344 && c <= 65533 && c !== CHAR_BOM || c >= 65536 && c <= 1114111;
  }
  function isNsCharOrWhitespace(c) {
    return isPrintable(c) && c !== CHAR_BOM && // - b-char
    c !== CHAR_CARRIAGE_RETURN && c !== CHAR_LINE_FEED;
  }
  function isPlainSafe(c, prev, inblock) {
    const cIsNsCharOrWhitespace = isNsCharOrWhitespace(c);
    const cIsNsChar = cIsNsCharOrWhitespace && !isWhitespace(c);
    return (
      // ns-plain-safe
      (inblock ? cIsNsCharOrWhitespace : cIsNsCharOrWhitespace && // - c-flow-indicator
      c !== CHAR_COMMA && c !== CHAR_LEFT_SQUARE_BRACKET && c !== CHAR_RIGHT_SQUARE_BRACKET && c !== CHAR_LEFT_CURLY_BRACKET && c !== CHAR_RIGHT_CURLY_BRACKET) && // ns-plain-char
      c !== CHAR_SHARP && // false on '#'
      !(prev === CHAR_COLON && !cIsNsChar) || // false on ': '
      isNsCharOrWhitespace(prev) && !isWhitespace(prev) && c === CHAR_SHARP || // change to true on '[^ ]#'
      prev === CHAR_COLON && cIsNsChar
    );
  }
  function isPlainSafeFirst(c) {
    return isPrintable(c) && c !== CHAR_BOM && !isWhitespace(c) && // - s-white
    // - (c-indicator ::=
    // “-” | “?” | “:” | “,” | “[” | “]” | “{” | “}”
    c !== CHAR_MINUS && c !== CHAR_QUESTION && c !== CHAR_COLON && c !== CHAR_COMMA && c !== CHAR_LEFT_SQUARE_BRACKET && c !== CHAR_RIGHT_SQUARE_BRACKET && c !== CHAR_LEFT_CURLY_BRACKET && c !== CHAR_RIGHT_CURLY_BRACKET && // | “#” | “&” | “*” | “!” | “|” | “=” | “>” | “'” | “"”
    c !== CHAR_SHARP && c !== CHAR_AMPERSAND && c !== CHAR_ASTERISK && c !== CHAR_EXCLAMATION && c !== CHAR_VERTICAL_LINE && c !== CHAR_EQUALS && c !== CHAR_GREATER_THAN && c !== CHAR_SINGLE_QUOTE && c !== CHAR_DOUBLE_QUOTE && // | “%” | “@” | “`”)
    c !== CHAR_PERCENT && c !== CHAR_COMMERCIAL_AT && c !== CHAR_GRAVE_ACCENT;
  }
  function isPlainSafeLast(c) {
    return !isWhitespace(c) && c !== CHAR_COLON;
  }
  function codePointAt(string, pos) {
    const first = string.charCodeAt(pos);
    let second;
    if (first >= 55296 && first <= 56319 && pos + 1 < string.length) {
      second = string.charCodeAt(pos + 1);
      if (second >= 56320 && second <= 57343) {
        return (first - 55296) * 1024 + second - 56320 + 65536;
      }
    }
    return first;
  }
  function needIndentIndicator(string) {
    const leadingSpaceRe = /^\n* /;
    return leadingSpaceRe.test(string);
  }
  const STYLE_PLAIN = 1;
  const STYLE_SINGLE = 2;
  const STYLE_LITERAL = 3;
  const STYLE_FOLDED = 4;
  const STYLE_DOUBLE = 5;
  function chooseScalarStyle(string, singleLineOnly, indentPerLevel, lineWidth, testAmbiguousType, quotingType, forceQuotes, inblock) {
    let i;
    let char = 0;
    let prevChar = null;
    let hasLineBreak = false;
    let hasFoldableLine = false;
    const shouldTrackWidth = lineWidth !== -1;
    let previousLineBreak = -1;
    let plain = isPlainSafeFirst(codePointAt(string, 0)) && isPlainSafeLast(codePointAt(string, string.length - 1));
    if (singleLineOnly || forceQuotes) {
      for (i = 0; i < string.length; char >= 65536 ? i += 2 : i++) {
        char = codePointAt(string, i);
        if (!isPrintable(char)) {
          return STYLE_DOUBLE;
        }
        plain = plain && isPlainSafe(char, prevChar, inblock);
        prevChar = char;
      }
    } else {
      for (i = 0; i < string.length; char >= 65536 ? i += 2 : i++) {
        char = codePointAt(string, i);
        if (char === CHAR_LINE_FEED) {
          hasLineBreak = true;
          if (shouldTrackWidth) {
            hasFoldableLine = hasFoldableLine || // Foldable line = too long, and not more-indented.
            i - previousLineBreak - 1 > lineWidth && string[previousLineBreak + 1] !== " ";
            previousLineBreak = i;
          }
        } else if (!isPrintable(char)) {
          return STYLE_DOUBLE;
        }
        plain = plain && isPlainSafe(char, prevChar, inblock);
        prevChar = char;
      }
      hasFoldableLine = hasFoldableLine || shouldTrackWidth && (i - previousLineBreak - 1 > lineWidth && string[previousLineBreak + 1] !== " ");
    }
    if (!hasLineBreak && !hasFoldableLine) {
      if (plain && !forceQuotes && !testAmbiguousType(string)) {
        return STYLE_PLAIN;
      }
      return quotingType === QUOTING_TYPE_DOUBLE ? STYLE_DOUBLE : STYLE_SINGLE;
    }
    if (indentPerLevel > 9 && needIndentIndicator(string)) {
      return STYLE_DOUBLE;
    }
    if (!forceQuotes) {
      return hasFoldableLine ? STYLE_FOLDED : STYLE_LITERAL;
    }
    return quotingType === QUOTING_TYPE_DOUBLE ? STYLE_DOUBLE : STYLE_SINGLE;
  }
  function writeScalar(state, string, level, iskey, inblock) {
    state.dump = (function() {
      if (string.length === 0) {
        return state.quotingType === QUOTING_TYPE_DOUBLE ? '""' : "''";
      }
      if (!state.noCompatMode) {
        if (DEPRECATED_BOOLEANS_SYNTAX.indexOf(string) !== -1 || DEPRECATED_BASE60_SYNTAX.test(string)) {
          return state.quotingType === QUOTING_TYPE_DOUBLE ? '"' + string + '"' : "'" + string + "'";
        }
      }
      const indent = state.indent * Math.max(1, level);
      const lineWidth = state.lineWidth === -1 ? -1 : Math.max(Math.min(state.lineWidth, 40), state.lineWidth - indent);
      const singleLineOnly = iskey || // No block styles in flow mode.
      state.flowLevel > -1 && level >= state.flowLevel;
      function testAmbiguity(string2) {
        return testImplicitResolving(state, string2);
      }
      switch (chooseScalarStyle(
        string,
        singleLineOnly,
        state.indent,
        lineWidth,
        testAmbiguity,
        state.quotingType,
        state.forceQuotes && !iskey,
        inblock
      )) {
        case STYLE_PLAIN:
          return string;
        case STYLE_SINGLE:
          return "'" + string.replace(/'/g, "''") + "'";
        case STYLE_LITERAL:
          return "|" + blockHeader(string, state.indent) + dropEndingNewline(indentString(string, indent));
        case STYLE_FOLDED:
          return ">" + blockHeader(string, state.indent) + dropEndingNewline(indentString(foldString(string, lineWidth), indent));
        case STYLE_DOUBLE:
          return '"' + escapeString(string) + '"';
        default:
          throw new YAMLException2("impossible error: invalid scalar style");
      }
    })();
  }
  function blockHeader(string, indentPerLevel) {
    const indentIndicator = needIndentIndicator(string) ? String(indentPerLevel) : "";
    const clip = string[string.length - 1] === "\n";
    const keep = clip && (string[string.length - 2] === "\n" || string === "\n");
    const chomp = keep ? "+" : clip ? "" : "-";
    return indentIndicator + chomp + "\n";
  }
  function dropEndingNewline(string) {
    return string[string.length - 1] === "\n" ? string.slice(0, -1) : string;
  }
  function foldString(string, width) {
    const lineRe = /(\n+)([^\n]*)/g;
    let result = (function() {
      let nextLF = string.indexOf("\n");
      nextLF = nextLF !== -1 ? nextLF : string.length;
      lineRe.lastIndex = nextLF;
      return foldLine(string.slice(0, nextLF), width);
    })();
    let prevMoreIndented = string[0] === "\n" || string[0] === " ";
    let moreIndented;
    let match;
    while (match = lineRe.exec(string)) {
      const prefix = match[1];
      const line = match[2];
      moreIndented = line[0] === " ";
      result += prefix + (!prevMoreIndented && !moreIndented && line !== "" ? "\n" : "") + foldLine(line, width);
      prevMoreIndented = moreIndented;
    }
    return result;
  }
  function foldLine(line, width) {
    if (line === "" || line[0] === " ") return line;
    const breakRe = / [^ ]/g;
    let match;
    let start = 0;
    let end;
    let curr = 0;
    let next = 0;
    let result = "";
    while (match = breakRe.exec(line)) {
      next = match.index;
      if (next - start > width) {
        end = curr > start ? curr : next;
        result += "\n" + line.slice(start, end);
        start = end + 1;
      }
      curr = next;
    }
    result += "\n";
    if (line.length - start > width && curr > start) {
      result += line.slice(start, curr) + "\n" + line.slice(curr + 1);
    } else {
      result += line.slice(start);
    }
    return result.slice(1);
  }
  function escapeString(string) {
    let result = "";
    let char = 0;
    for (let i = 0; i < string.length; char >= 65536 ? i += 2 : i++) {
      char = codePointAt(string, i);
      const escapeSeq = ESCAPE_SEQUENCES[char];
      if (!escapeSeq && isPrintable(char)) {
        result += string[i];
        if (char >= 65536) result += string[i + 1];
      } else {
        result += escapeSeq || encodeHex(char);
      }
    }
    return result;
  }
  function writeFlowSequence(state, level, object) {
    let _result = "";
    const _tag = state.tag;
    for (let index = 0, length = object.length; index < length; index += 1) {
      let value = object[index];
      if (state.replacer) {
        value = state.replacer.call(object, String(index), value);
      }
      if (writeNode(state, level, value, false, false) || typeof value === "undefined" && writeNode(state, level, null, false, false)) {
        if (_result !== "") _result += "," + (!state.condenseFlow ? " " : "");
        _result += state.dump;
      }
    }
    state.tag = _tag;
    state.dump = "[" + _result + "]";
  }
  function writeBlockSequence(state, level, object, compact) {
    let _result = "";
    const _tag = state.tag;
    for (let index = 0, length = object.length; index < length; index += 1) {
      let value = object[index];
      if (state.replacer) {
        value = state.replacer.call(object, String(index), value);
      }
      if (writeNode(state, level + 1, value, true, true, false, true) || typeof value === "undefined" && writeNode(state, level + 1, null, true, true, false, true)) {
        if (!compact || _result !== "") {
          _result += generateNextLine(state, level);
        }
        if (state.dump && CHAR_LINE_FEED === state.dump.charCodeAt(0)) {
          _result += "-";
        } else {
          _result += "- ";
        }
        _result += state.dump;
      }
    }
    state.tag = _tag;
    state.dump = _result || "[]";
  }
  function writeFlowMapping(state, level, object) {
    let _result = "";
    const _tag = state.tag;
    const objectKeyList = Object.keys(object);
    for (let index = 0, length = objectKeyList.length; index < length; index += 1) {
      let pairBuffer = "";
      if (_result !== "") pairBuffer += ", ";
      if (state.condenseFlow) pairBuffer += '"';
      const objectKey = objectKeyList[index];
      let objectValue = object[objectKey];
      if (state.replacer) {
        objectValue = state.replacer.call(object, objectKey, objectValue);
      }
      if (!writeNode(state, level, objectKey, false, false)) {
        continue;
      }
      if (state.dump.length > 1024) pairBuffer += "? ";
      pairBuffer += state.dump + (state.condenseFlow ? '"' : "") + ":" + (state.condenseFlow ? "" : " ");
      if (!writeNode(state, level, objectValue, false, false)) {
        continue;
      }
      pairBuffer += state.dump;
      _result += pairBuffer;
    }
    state.tag = _tag;
    state.dump = "{" + _result + "}";
  }
  function writeBlockMapping(state, level, object, compact) {
    let _result = "";
    const _tag = state.tag;
    const objectKeyList = Object.keys(object);
    if (state.sortKeys === true) {
      objectKeyList.sort();
    } else if (typeof state.sortKeys === "function") {
      objectKeyList.sort(state.sortKeys);
    } else if (state.sortKeys) {
      throw new YAMLException2("sortKeys must be a boolean or a function");
    }
    for (let index = 0, length = objectKeyList.length; index < length; index += 1) {
      let pairBuffer = "";
      if (!compact || _result !== "") {
        pairBuffer += generateNextLine(state, level);
      }
      const objectKey = objectKeyList[index];
      let objectValue = object[objectKey];
      if (state.replacer) {
        objectValue = state.replacer.call(object, objectKey, objectValue);
      }
      if (!writeNode(state, level + 1, objectKey, true, true, true)) {
        continue;
      }
      const explicitPair = state.tag !== null && state.tag !== "?" || state.dump && state.dump.length > 1024;
      if (explicitPair) {
        if (state.dump && CHAR_LINE_FEED === state.dump.charCodeAt(0)) {
          pairBuffer += "?";
        } else {
          pairBuffer += "? ";
        }
      }
      pairBuffer += state.dump;
      if (explicitPair) {
        pairBuffer += generateNextLine(state, level);
      }
      if (!writeNode(state, level + 1, objectValue, true, explicitPair)) {
        continue;
      }
      if (state.dump && CHAR_LINE_FEED === state.dump.charCodeAt(0)) {
        pairBuffer += ":";
      } else {
        pairBuffer += ": ";
      }
      pairBuffer += state.dump;
      _result += pairBuffer;
    }
    state.tag = _tag;
    state.dump = _result || "{}";
  }
  function detectType(state, object, explicit) {
    const typeList = explicit ? state.explicitTypes : state.implicitTypes;
    for (let index = 0, length = typeList.length; index < length; index += 1) {
      const type2 = typeList[index];
      if ((type2.instanceOf || type2.predicate) && (!type2.instanceOf || typeof object === "object" && object instanceof type2.instanceOf) && (!type2.predicate || type2.predicate(object))) {
        if (explicit) {
          if (type2.multi && type2.representName) {
            state.tag = type2.representName(object);
          } else {
            state.tag = type2.tag;
          }
        } else {
          state.tag = "?";
        }
        if (type2.represent) {
          const style = state.styleMap[type2.tag] || type2.defaultStyle;
          let _result;
          if (_toString.call(type2.represent) === "[object Function]") {
            _result = type2.represent(object, style);
          } else if (_hasOwnProperty.call(type2.represent, style)) {
            _result = type2.represent[style](object, style);
          } else {
            throw new YAMLException2("!<" + type2.tag + '> tag resolver accepts not "' + style + '" style');
          }
          state.dump = _result;
        }
        return true;
      }
    }
    return false;
  }
  function writeNode(state, level, object, block, compact, iskey, isblockseq) {
    state.tag = null;
    state.dump = object;
    if (!detectType(state, object, false)) {
      detectType(state, object, true);
    }
    const type2 = _toString.call(state.dump);
    const inblock = block;
    if (block) {
      block = state.flowLevel < 0 || state.flowLevel > level;
    }
    const objectOrArray = type2 === "[object Object]" || type2 === "[object Array]";
    let duplicateIndex;
    let duplicate;
    if (objectOrArray) {
      duplicateIndex = state.duplicates.indexOf(object);
      duplicate = duplicateIndex !== -1;
    }
    if (state.tag !== null && state.tag !== "?" || duplicate || state.indent !== 2 && level > 0) {
      compact = false;
    }
    if (duplicate && state.usedDuplicates[duplicateIndex]) {
      state.dump = "*ref_" + duplicateIndex;
    } else {
      if (objectOrArray && duplicate && !state.usedDuplicates[duplicateIndex]) {
        state.usedDuplicates[duplicateIndex] = true;
      }
      if (type2 === "[object Object]") {
        if (block && Object.keys(state.dump).length !== 0) {
          writeBlockMapping(state, level, state.dump, compact);
          if (duplicate) {
            state.dump = "&ref_" + duplicateIndex + state.dump;
          }
        } else {
          writeFlowMapping(state, level, state.dump);
          if (duplicate) {
            state.dump = "&ref_" + duplicateIndex + " " + state.dump;
          }
        }
      } else if (type2 === "[object Array]") {
        if (block && state.dump.length !== 0) {
          if (state.noArrayIndent && !isblockseq && level > 0) {
            writeBlockSequence(state, level - 1, state.dump, compact);
          } else {
            writeBlockSequence(state, level, state.dump, compact);
          }
          if (duplicate) {
            state.dump = "&ref_" + duplicateIndex + state.dump;
          }
        } else {
          writeFlowSequence(state, level, state.dump);
          if (duplicate) {
            state.dump = "&ref_" + duplicateIndex + " " + state.dump;
          }
        }
      } else if (type2 === "[object String]") {
        if (state.tag !== "?") {
          writeScalar(state, state.dump, level, iskey, inblock);
        }
      } else if (type2 === "[object Undefined]") {
        return false;
      } else {
        if (state.skipInvalid) return false;
        throw new YAMLException2("unacceptable kind of an object to dump " + type2);
      }
      if (state.tag !== null && state.tag !== "?") {
        let tagStr = encodeURI(
          state.tag[0] === "!" ? state.tag.slice(1) : state.tag
        ).replace(/!/g, "%21");
        if (state.tag[0] === "!") {
          tagStr = "!" + tagStr;
        } else if (tagStr.slice(0, 18) === "tag:yaml.org,2002:") {
          tagStr = "!!" + tagStr.slice(18);
        } else {
          tagStr = "!<" + tagStr + ">";
        }
        state.dump = tagStr + " " + state.dump;
      }
    }
    return true;
  }
  function getDuplicateReferences(object, state) {
    const objects = [];
    const duplicatesIndexes = [];
    inspectNode(object, objects, duplicatesIndexes);
    const length = duplicatesIndexes.length;
    for (let index = 0; index < length; index += 1) {
      state.duplicates.push(objects[duplicatesIndexes[index]]);
    }
    state.usedDuplicates = new Array(length);
  }
  function inspectNode(object, objects, duplicatesIndexes) {
    if (object !== null && typeof object === "object") {
      const index = objects.indexOf(object);
      if (index !== -1) {
        if (duplicatesIndexes.indexOf(index) === -1) {
          duplicatesIndexes.push(index);
        }
      } else {
        objects.push(object);
        if (Array.isArray(object)) {
          for (let i = 0, length = object.length; i < length; i += 1) {
            inspectNode(object[i], objects, duplicatesIndexes);
          }
        } else {
          const objectKeyList = Object.keys(object);
          for (let i = 0, length = objectKeyList.length; i < length; i += 1) {
            inspectNode(object[objectKeyList[i]], objects, duplicatesIndexes);
          }
        }
      }
    }
  }
  function dump2(input, options) {
    options = options || {};
    const state = new State(options);
    if (!state.noRefs) getDuplicateReferences(input, state);
    let value = input;
    if (state.replacer) {
      value = state.replacer.call({ "": value }, "", value);
    }
    if (writeNode(state, 0, value, true, true)) return state.dump + "\n";
    return "";
  }
  dumper.dump = dump2;
  return dumper;
}
var hasRequiredJsYaml;
function requireJsYaml() {
  if (hasRequiredJsYaml) return jsYaml;
  hasRequiredJsYaml = 1;
  const loader2 = requireLoader();
  const dumper2 = requireDumper();
  function renamed(from, to) {
    return function() {
      throw new Error("Function yaml." + from + " is removed in js-yaml 4. Use yaml." + to + " instead, which is now safe by default.");
    };
  }
  jsYaml.Type = requireType();
  jsYaml.Schema = requireSchema();
  jsYaml.FAILSAFE_SCHEMA = requireFailsafe();
  jsYaml.JSON_SCHEMA = requireJson();
  jsYaml.CORE_SCHEMA = requireCore();
  jsYaml.DEFAULT_SCHEMA = require_default();
  jsYaml.load = loader2.load;
  jsYaml.loadAll = loader2.loadAll;
  jsYaml.dump = dumper2.dump;
  jsYaml.YAMLException = requireException();
  jsYaml.types = {
    binary: requireBinary(),
    float: requireFloat(),
    map: requireMap(),
    null: require_null(),
    pairs: requirePairs(),
    set: requireSet(),
    timestamp: requireTimestamp(),
    bool: requireBool(),
    int: requireInt(),
    merge: requireMerge(),
    omap: requireOmap(),
    seq: requireSeq(),
    str: requireStr()
  };
  jsYaml.safeLoad = renamed("safeLoad", "load");
  jsYaml.safeLoadAll = renamed("safeLoadAll", "loadAll");
  jsYaml.safeDump = renamed("safeDump", "dump");
  return jsYaml;
}
var jsYamlExports = requireJsYaml();
var yaml = /* @__PURE__ */ getDefaultExportFromCjs(jsYamlExports);
var {
  Type,
  Schema,
  FAILSAFE_SCHEMA,
  JSON_SCHEMA,
  CORE_SCHEMA,
  DEFAULT_SCHEMA,
  load,
  loadAll,
  dump,
  YAMLException,
  types,
  safeLoad,
  safeLoadAll,
  safeDump
} = yaml;

// tools/board-tool/schema/value-guards.ts
function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isUnknownArray(value) {
  return Array.isArray(value);
}
function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}
function isOneOf(value, values) {
  return values.some((candidate) => candidate === value);
}
function hasAsciiControl(value) {
  for (let i = 0; i < value.length; i++) if (value.charCodeAt(i) <= 31) return true;
  return false;
}

// tools/board-tool/schema/board-mindmap.ts
var BOARD_MINDMAP_HISTORY_LIMIT = 40;
var BOARD_MINDMAP_PINS_LIMIT = 6;
var BOARD_MINDMAP_EXPANDED_LIMIT = 8;
var validId = (value) => typeof value === "string" && !!value && value.length <= 256 && value.trim() === value && !hasAsciiControl(value) && !value.includes(String.fromCharCode(127));
var keysWithin = (value, keys2) => Object.keys(value).every((key) => keys2.includes(key));
function validIds(value, limit, unique = true) {
  return isUnknownArray(value) && value.length <= limit && value.every(validId) && (!unique || new Set(value).size === value.length);
}
function supportsBoardMindmapTarget(node) {
  return node.kind === "card" || node.kind === "board" || node.kind === "section" || node.kind === "text" && node.brainIdea === true;
}
function validBoardMindmapState(value) {
  if (!isRecord(value) || !keysWithin(value, ["version", "centerId", "expandedIds", "pins", "history", "descendantDepth"]) || value.descendantDepth !== void 0 && (typeof value.descendantDepth !== "number" || !Number.isInteger(value.descendantDepth) || value.descendantDepth < 1 || value.descendantDepth > 5) || value.version !== 1 || value.centerId !== void 0 && !validId(value.centerId) || !validIds(value.expandedIds, BOARD_MINDMAP_EXPANDED_LIMIT) || !validIds(value.pins, BOARD_MINDMAP_PINS_LIMIT) || !isRecord(value.history) || !keysWithin(value.history, ["entries", "index"])) return false;
  const history = value.history;
  if (!validIds(history.entries, BOARD_MINDMAP_HISTORY_LIMIT, false) || typeof history.index !== "number" || !Number.isInteger(history.index)) return false;
  const entries = history.entries;
  if (!entries.length) return history.index === -1 && value.centerId === void 0;
  return history.index >= 0 && history.index < entries.length && value.centerId === entries[history.index] && entries.every((id, index) => !index || id !== entries[index - 1]);
}

// tools/board-tool/schema/brain-reading-positions.ts
var BRAIN_READING_POSITIONS_LIMIT = 50;
var identifier = (value) => typeof value === "string" && !!value && value.length <= 256 && value.trim() === value && !hasAsciiControl(value) && !value.includes(String.fromCharCode(127));
var keys = (value, allowed) => Object.keys(value).every((key) => allowed.includes(key));
function validBrainReadingPositionState(value, named = false) {
  if (!isRecord(value) || !keys(value, named ? ["version", "id", "name", "centerId", "expandedIds", "depth", "viewport"] : ["version", "centerId", "expandedIds", "depth", "viewport"]) || value.version !== 1 || !identifier(value.centerId) || !isUnknownArray(value.expandedIds) || value.expandedIds.length > BOARD_MINDMAP_EXPANDED_LIMIT || !value.expandedIds.every(identifier) || new Set(value.expandedIds).size !== value.expandedIds.length || !isFiniteNumber(value.depth) || !Number.isInteger(value.depth) || value.depth < 1 || value.depth > 5) return false;
  const camera = value.viewport;
  if (!isRecord(camera) || !keys(camera, ["x", "y", "zoom"]) || ![camera.x, camera.y, camera.zoom].every(isFiniteNumber) || !isFiniteNumber(camera.zoom) || camera.zoom < 0.15 || camera.zoom > 2.5) return false;
  return !named || identifier(value.id) && typeof value.name === "string" && !!value.name.trim() && value.name.trim() === value.name && value.name.length <= 100 && !hasAsciiControl(value.name);
}
function validBrainReadingPositions(value) {
  return isUnknownArray(value) && value.length <= BRAIN_READING_POSITIONS_LIMIT && value.every((item) => validBrainReadingPositionState(item, true)) && new Set(value.map((item) => item.id)).size === value.length;
}

// tools/board-tool/schema/ink-model.ts
var MAX_STROKE_POINTS = 8192;
var MAX_INK_POINTS = 65536;
var MAX_INK_STROKES = 2e3;
var MAX_INK_COORDINATE = 1e6;
function record(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function finite(value) {
  return typeof value === "number" && Number.isFinite(value);
}
function control(value) {
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code < 32 || code === 127) return true;
  }
  return false;
}
function validInkData(raw) {
  if (!record(raw) || raw.version !== 1 || !Array.isArray(raw.strokes) || raw.strokes.length > MAX_INK_STROKES) return false;
  const ids = /* @__PURE__ */ new Set();
  let total = 0;
  for (const stroke of raw.strokes) {
    if (!record(stroke) || typeof stroke.id !== "string" || !stroke.id.trim() || stroke.id.length > 256 || control(stroke.id) || ids.has(stroke.id) || typeof stroke.color !== "string" || !/^#[0-9a-fA-F]{6}$/.test(stroke.color) || !finite(stroke.width) || stroke.width < 0.5 || stroke.width > 24 || !Array.isArray(stroke.points) || !stroke.points.length || stroke.points.length > MAX_STROKE_POINTS) return false;
    ids.add(stroke.id);
    total += stroke.points.length;
    if (total > MAX_INK_POINTS) return false;
    for (const point of stroke.points) {
      if (!Array.isArray(point) || point.length !== 3 || !finite(point[0]) || !finite(point[1]) || Math.abs(point[0]) > MAX_INK_COORDINATE || Math.abs(point[1]) > MAX_INK_COORDINATE || !finite(point[2]) || point[2] < 0 || point[2] > 1) return false;
    }
  }
  return true;
}
function assertInkData(raw) {
  if (!validInkData(raw)) throw Error("\u624B\u5199\u7B14\u8FF9\u6570\u636E\u65E0\u6548\u6216\u8D85\u51FA\u4FDD\u5B58\u4E0A\u9650\uFF0C\u5DF2\u963B\u6B62\u5199\u5165");
}

// tools/board-tool/schema/background-image.ts
var defaultBackgroundImagePreferences = { backgroundImagePath: "", backgroundImageFit: "cover", backgroundImageOpacity: 70 };
var MAX_BACKGROUND_IMAGE_BYTES = 20 * 1024 * 1024;
function cleanImagePath(value) {
  if (typeof value !== "string" || value.length > 4096 || [...value].some((char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127)) return "";
  const path4 = value.trim();
  if (!path4 || /^[~/]/.test(path4) || /[\\:?#]/.test(path4) || /%(?:2e|2f|5c|25)/i.test(path4)) return "";
  if (path4.split("/").some((part) => !part || part === "." || part === "..") || !/\.(?:png|jpe?g|webp|gif)$/i.test(path4)) return "";
  return path4;
}
function cleanBackgroundImagePreferences(raw) {
  const saved = isRecord(raw) ? raw : {}, fit = saved.backgroundImageFit;
  return {
    backgroundImagePath: cleanImagePath(saved.backgroundImagePath),
    backgroundImageFit: fit === "contain" || fit === "tile" ? fit : "cover",
    backgroundImageOpacity: isFiniteNumber(saved.backgroundImageOpacity) ? Math.max(0, Math.min(100, saved.backgroundImageOpacity)) : defaultBackgroundImagePreferences.backgroundImageOpacity
  };
}

// tools/board-tool/schema/paper-appearance.ts
var paperPresets = {
  cream: { name: "\u7C73\u9EC4\u7EB8", color: "#f3e9d4" },
  white: { name: "\u7EAF\u767D\u7EB8", color: "#ffffff" },
  ivory: { name: "\u8C61\u7259\u767D", color: "#f7f2e7" },
  kraft: { name: "\u725B\u76AE\u7EB8", color: "#d6ba8f" },
  recycled: { name: "\u518D\u751F\u7EB8", color: "#dedbd1" },
  custom: { name: "\u81EA\u5B9A\u4E49", color: "#f3e9d4" }
};
var defaultPaperPreferences = { paperPreset: "cream", paperColor: "#f3e9d4", paperTexture: 55 };
function cleanPaperPreferences(raw) {
  const saved = isRecord(raw) ? raw : {};
  return {
    paperPreset: typeof saved.paperPreset === "string" && Object.hasOwn(paperPresets, saved.paperPreset) ? saved.paperPreset : defaultPaperPreferences.paperPreset,
    paperColor: typeof saved.paperColor === "string" && /^#[0-9a-fA-F]{6}$/.test(saved.paperColor) ? saved.paperColor.toLowerCase() : defaultPaperPreferences.paperColor,
    paperTexture: isFiniteNumber(saved.paperTexture) ? Math.max(0, Math.min(100, saved.paperTexture)) : defaultPaperPreferences.paperTexture
  };
}

// tools/board-tool/schema/board-background.ts
function cleanBoardBackground(raw) {
  return { canvasBackground: isRecord(raw) && isOneOf(raw.canvasBackground, ["dots", "grid", "plain", "paper", "image"]) ? raw.canvasBackground : "dots", ...cleanPaperPreferences(raw), ...cleanBackgroundImagePreferences(raw) };
}

// tools/board-tool/schema/brain-colors.ts
var brainColorKeys = ["background", "node", "border", "text", "line"];
function brainColor(value) {
  if (typeof value !== "string") return;
  const hex = value.trim();
  if (/^#[\da-f]{6}$/i.test(hex)) return hex.toLowerCase();
  if (/^#[\da-f]{3}$/i.test(hex)) return "#" + [...hex.slice(1)].map((c) => c + c).join("").toLowerCase();
}
function cleanBrainColors(raw) {
  const colors2 = {};
  if (!isRecord(raw)) return colors2;
  for (const key of brainColorKeys) {
    const value = brainColor(raw[key]);
    if (value) colors2[key] = value;
  }
  return colors2;
}

// tools/board-tool/schema/portable-sha256.ts
var roundConstants = new Uint32Array([
  1116352408,
  1899447441,
  3049323471,
  3921009573,
  961987163,
  1508970993,
  2453635748,
  2870763221,
  3624381080,
  310598401,
  607225278,
  1426881987,
  1925078388,
  2162078206,
  2614888103,
  3248222580,
  3835390401,
  4022224774,
  264347078,
  604807628,
  770255983,
  1249150122,
  1555081692,
  1996064986,
  2554220882,
  2821834349,
  2952996808,
  3210313671,
  3336571891,
  3584528711,
  113926993,
  338241895,
  666307205,
  773529912,
  1294757372,
  1396182291,
  1695183700,
  1986661051,
  2177026350,
  2456956037,
  2730485921,
  2820302411,
  3259730800,
  3345764771,
  3516065817,
  3600352804,
  4094571909,
  275423344,
  430227734,
  506948616,
  659060556,
  883997877,
  958139571,
  1322822218,
  1537002063,
  1747873779,
  1955562222,
  2024104815,
  2227730452,
  2361852424,
  2428436474,
  2756734187,
  3204031479,
  3329325298
]);

// tools/board-tool/schema/markdown-literals.ts
function inlineCodeRanges(text) {
  const runs = [], last = /* @__PURE__ */ new Map();
  for (let i = text.indexOf("`"); i >= 0; i = text.indexOf("`", i)) {
    const from = i;
    while (text[i] === "`") i++;
    let slash = from;
    while (slash > 0 && text[slash - 1] === "\\") slash--;
    runs.push({ from, to: i, escaped: (from - slash) % 2 === 1, next: -1 });
  }
  for (let i = runs.length - 1; i >= 0; i--) {
    if (i + 1 < runs.length && /\r?\n[ \t]*\r?\n/.test(text.slice(runs[i].to, runs[i + 1].from))) last.clear();
    const n = runs[i].to - runs[i].from;
    runs[i].next = last.get(n) ?? -1;
    last.set(n, i);
  }
  const ranges = [];
  for (let i = 0; i < runs.length; i++) {
    const run = runs[i];
    if (run.escaped || run.next < 0) continue;
    ranges.push({ from: run.from, to: runs[run.next].to });
    i = run.next;
  }
  return ranges;
}
function commentTokenQuery(text) {
  let html, percent;
  return (from) => {
    if (html === void 0 || html >= 0 && html < from) html = text.indexOf("<!--", from);
    if (percent === void 0 || percent >= 0 && percent < from) percent = text.indexOf("%%", from);
    return html < 0 ? percent : percent < 0 ? html : Math.min(html, percent);
  };
}

// tools/board-tool/schema/markdown-context.ts
var markdownColumns = (s, initial = 0) => {
  let col = initial;
  for (const c of s) col = c === "	" ? col + 4 - col % 4 : col + 1;
  return col;
};
function frontmatterEndOffset(text) {
  if (!/^---\r?\n/.test(text)) return -1;
  for (let start = text.indexOf("\n") + 1; start <= text.length; ) {
    const end = text.indexOf("\n", start);
    if (/^(---|\.\.\.)\s*$/.test(text.slice(start, end < 0 ? text.length : end))) return start;
    if (end < 0) break;
    start = end + 1;
  }
  return -1;
}
function* markdownRows(text) {
  const frontEnd = frontmatterEndOffset(text);
  let fence = "", quoteDepth = 0, comment = "", lists = [];
  for (let line = 0, start = 0; start <= text.length; line++) {
    const offset = start, end = text.indexOf("\n", start), source = text.slice(start, end < 0 ? text.length : end), raw = source.replace(/\r$/, "");
    start = end < 0 ? text.length + 1 : end + 1;
    if (frontEnd >= 0 && offset <= frontEnd) {
      yield { source, line, visible: "", code: true, topLevel: false, commentBefore: false };
      continue;
    }
    const prefix = /^(?: {0,3}>[ \t]?)+/.exec(raw)?.[0] || "", depth = (prefix.match(/>/g) || []).length;
    if (depth !== quoteDepth && !(fence && quoteDepth === 0)) {
      fence = "";
      lists = [];
      quoteDepth = depth;
    }
    const content = raw.slice(prefix.length), indentText = /^[ \t]*/.exec(content)[0], indent = markdownColumns(indentText), body = content.slice(indentText.length);
    const commentBefore = !!comment;
    if (fence) {
      const close = /^(`{3,}|~{3,})[ \t]*$/.exec(body);
      if (close && indent - (lists.at(-1) || 0) < 4 && depth === quoteDepth && close[1][0] === fence[0] && close[1].length >= fence.length) fence = "";
      yield { source, line, visible: "", code: true, topLevel: false, commentBefore, openBlock: !!fence };
      continue;
    }
    if (body.trim()) while (lists.length && indent < lists[lists.length - 1]) lists.pop();
    const indented = indent - (lists.at(-1) || 0) >= 4;
    const marker = /^(`{3,}|~{3,})(.*)$/.exec(body);
    if (!comment && (indented || marker && !(marker[1][0] === "`" && marker[2].includes("`")))) {
      if (!indented) fence = marker[1];
      yield { source, line, visible: "", code: true, topLevel: false, commentBefore, fenceOpening: !indented, openBlock: !!fence };
      continue;
    }
    const topLevel = !prefix && !lists.length && indent < 4;
    let visible = raw;
    if (comment || raw.includes("<!--") || raw.includes("%%")) {
      const ranges = inlineCodeRanges(raw), nextComment = commentTokenQuery(raw), pieces = [];
      let range = 0, unmasked = 0;
      const mask = (from, to) => {
        pieces.push(raw.slice(unmasked, from), " ".repeat(to - from));
        unmasked = to;
      };
      for (let i = 0; i < raw.length; ) {
        if (comment) {
          const end2 = raw.indexOf(comment, i), to = end2 < 0 ? raw.length : end2 + comment.length;
          mask(i, to);
          i = to;
          if (end2 >= 0) comment = "";
          continue;
        }
        while (range < ranges.length && ranges[range].from < i) range++;
        const at = nextComment(i);
        if (at < 0) break;
        if (range < ranges.length && ranges[range].from <= at) {
          i = ranges[range++].to;
          continue;
        }
        i = at;
        const token = raw.startsWith("<!--", i) ? "<!--" : "%%";
        let slash = i;
        while (slash > 0 && raw[slash - 1] === "\\") slash--;
        if ((i - slash) % 2) {
          i++;
          continue;
        }
        comment = token === "<!--" ? "-->" : "%%";
        mask(i, i + token.length);
        i += token.length;
      }
      if (pieces.length) visible = pieces.join("") + raw.slice(unmasked);
    }
    const item = /^([-*+]|\d+[.)])([ \t]+)(.*)$/.exec(visible.slice(prefix.length + indentText.length));
    if (item) {
      const pad = markdownColumns(item[2], indent + item[1].length) - indent - item[1].length;
      lists.push(indent + item[1].length + (pad > 4 ? 1 : pad));
    }
    yield { source, line, visible, code: false, topLevel, commentBefore, openBlock: !!comment };
  }
}

// tools/board-tool/schema/sections.ts
function sectionContains(section, node) {
  if (section.kind !== "section" || section.id === node.id || node.x < section.x || node.y < section.y || node.x + node.width > section.x + section.width || node.y + node.height > section.y + section.height) return false;
  return node.kind !== "section" || node.x > section.x || node.y > section.y || node.x + node.width < section.x + section.width || node.y + node.height < section.y + section.height;
}
function sectionMemberQuery(nodes) {
  let candidates = nodes, axis = "x";
  if (nodes.filter((n) => n.kind === "section").length > 8) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const n of nodes) {
      minX = Math.min(minX, n.x);
      maxX = Math.max(maxX, n.x);
      minY = Math.min(minY, n.y);
      maxY = Math.max(maxY, n.y);
    }
    axis = maxY - minY > maxX - minX ? "y" : "x";
    candidates = [...nodes].sort((a, b) => a[axis] - b[axis]);
  }
  return (section) => {
    const members = [];
    let start = 0;
    if (candidates !== nodes) {
      let end = candidates.length;
      while (start < end) {
        const middle = start + end >>> 1;
        if (candidates[middle][axis] < section[axis]) start = middle + 1;
        else end = middle;
      }
    }
    const limit = section[axis] + (axis === "x" ? section.width : section.height);
    for (let i = start; i < candidates.length; i++) {
      const node = candidates[i];
      if (candidates !== nodes && node[axis] > limit) break;
      if (sectionContains(section, node)) members.push(node);
    }
    return members;
  };
}

// tools/board-tool/schema/mindmap.ts
function validateBranches(b) {
  const nodes = new Map(b.nodes.map((n) => [n.id, n])), parents = /* @__PURE__ */ new Map(), branches = b.edges.filter((e) => e.kind === "branch");
  for (const e of branches) {
    if (!nodes.has(e.from) || !nodes.has(e.to) || parents.has(e.to)) throw new Error("\u5206\u652F\u7AEF\u70B9\u5FC5\u987B\u5B58\u5728\uFF0C\u6BCF\u4E2A\u5BF9\u8C61\u53EA\u80FD\u6709\u4E00\u4E2A\u7236\u7EA7");
    parents.set(e.to, e.from);
  }
  const done = /* @__PURE__ */ new Set();
  for (const id of parents.keys()) {
    let current = id;
    const path4 = /* @__PURE__ */ new Set();
    while (current !== void 0 && !done.has(current)) {
      if (path4.has(current)) throw new Error("\u5BFC\u56FE\u5206\u652F\u4E0D\u80FD\u5F62\u6210\u5FAA\u73AF");
      path4.add(current);
      current = parents.get(current);
    }
    path4.forEach((n) => done.add(n));
  }
  if (branches.some((e) => nodes.get(e.to)?.kind === "section")) {
    const members = sectionMemberQuery(b.nodes), children = /* @__PURE__ */ new Map(), groupTargets = /* @__PURE__ */ new Set();
    for (const e of branches) {
      const list = children.get(e.from) || [];
      list.push(e.to);
      children.set(e.from, list);
      if (nodes.get(e.to)?.kind === "section") groupTargets.add(e.to);
    }
    const settled = /* @__PURE__ */ new Set(), active = /* @__PURE__ */ new Set();
    for (const id of groupTargets) {
      if (settled.has(id)) continue;
      const stack = [{ id, exit: false }];
      while (stack.length) {
        const entry = stack.pop();
        if (entry.exit) {
          active.delete(entry.id);
          settled.add(entry.id);
          continue;
        }
        if (active.has(entry.id)) throw Error("\u5206\u7EC4\u7236\u5B50\u5173\u7CFB\u4E0E\u5305\u542B\u5173\u7CFB\u4E0D\u80FD\u5F62\u6210\u5FAA\u73AF");
        if (settled.has(entry.id)) continue;
        active.add(entry.id);
        stack.push({ id: entry.id, exit: true });
        const node = nodes.get(entry.id);
        if (node.kind === "section") for (const member of members(node)) stack.push({ id: member.id, exit: false });
        for (const child of children.get(entry.id) || []) stack.push({ id: child, exit: false });
      }
    }
  }
  return parents;
}

// tools/board-tool/schema/paragraph-card.ts
function validParagraphOrigin(value) {
  if (!isRecord(value)) return false;
  if (typeof value.path !== "string" || value.path.length > 2048 || !/\.md$/i.test(value.path) || hasAsciiControl(value.path) || value.path.includes("\\") || /^[/\\]|^[a-z][\w+.-]*:/i.test(value.path) || value.path.split("/").some((p) => p === ".." || p === ".") || !(value.subpath === void 0 || typeof value.subpath === "string" && value.subpath.startsWith("#") && value.subpath.length <= 2048 && !hasAsciiControl(value.subpath))) return false;
  if (value.mode === "embed") return typeof value.subpath === "string" && value.subpath.length > 1;
  return value.mode === "snapshot" && typeof value.quote === "string" && !!value.quote.trim() && value.quote.length <= 1e5 && typeof value.hash === "string" && /^[a-f0-9]{64}$/.test(value.hash) && Number.isSafeInteger(value.from) && Number.isSafeInteger(value.to) && value.from >= 0 && value.to - value.from === value.quote.length;
}

// tools/board-tool/schema/online-video.ts
var maxStart = 7 * 24 * 60 * 60;

// tools/board-tool/schema/web-card.ts
function webUrl(value) {
  if (typeof value !== "string") return;
  const input = value.trim();
  if (!input || input.length > 8192 || (/[\s\\<>]/.test(input) || Array.from(input).some((c) => c.charCodeAt(0) < 32))) return;
  try {
    const url = new URL(input);
    if (["https:", "http:"].includes(url.protocol) && url.hostname && !url.username && !url.password) return url.href;
  } catch {
  }
}

// tools/board-tool/schema/expansion-checkpoint.ts
var foldKeys = ["collapsed", "branchFolded", "sectionFolded"];
var geometryKeys = ["x", "y", "width", "height"];
function validReadingCheckpoint(value, nodes) {
  if (!isRecord(value) || value.version !== 1 || typeof value.signature !== "string" || value.signature.length > 8e6) return false;
  for (const entries of [value.base, value.applied]) {
    if (!isUnknownArray(entries) || entries.length !== nodes.length) return false;
    for (let i = 0; i < entries.length; i++) {
      const n = entries[i], kind = nodes[i].kind;
      if (!isRecord(n) || n.id !== nodes[i].id || !geometryKeys.every((key) => isFiniteNumber(n[key])) || Number(n.width) < 80 || Number(n.height) < (kind === "text" ? 40 : 60)) return false;
      if (foldKeys.some((key) => n[key] !== void 0 && typeof n[key] !== "boolean")) return false;
      if (n.collapsed && (n.height !== 72 || !isFiniteNumber(n.expandedHeight) || n.expandedHeight < (kind === "text" ? 40 : 60))) return false;
      if (!n.collapsed && n.expandedHeight !== void 0) return false;
    }
  }
  return true;
}

// tools/board-tool/schema/text-sizing.ts
var tableCache = /* @__PURE__ */ new WeakMap();
function textHasTable(node) {
  const text = node.text || "", cached = tableCache.get(node);
  if (cached?.text === text) return cached.table;
  let table = false, previous = "";
  if (text.includes("|") && text.includes("---")) for (const row of markdownRows(text)) {
    if (row.code || !row.topLevel) {
      previous = "";
      continue;
    }
    const line = row.visible.trim();
    if (previous.includes("|") && /^\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)*\|?$/.test(line) && line.includes("|")) {
      table = true;
      break;
    }
    previous = line;
  }
  tableCache.set(node, { text, table });
  return table;
}
function textFitsContent(node) {
  return node?.kind === "text" && !node.webUrl && (node.textAutoHeight === true || node.textAutoHeight !== false && node.autoSize !== false && (node.topic === true || textHasTable(node)));
}

// tools/board-tool/schema/relation-geometry-checkpoint.ts
function canPersistRelationGeometry(node) {
  return node.kind === "card" ? node.autoFit === true : node.kind === "image" || node.kind === "pdf" || textFitsContent(node);
}
var validStat = (value) => isFiniteNumber(value) && value >= 0;
function validSource(value) {
  if (!isRecord(value) || typeof value.path !== "string" || !value.path || value.path.length > 2048 || hasAsciiControl(value.path) || value.path.includes("\\") || /^\/|^[a-z][\w+.-]*:/i.test(value.path) || value.path.split("/").some((part) => !part || part === "." || part === "..")) return false;
  return validStat(value.mtime) && validStat(value.size) && Number.isSafeInteger(value.size) && (value.ctime === void 0 || validStat(value.ctime));
}
function validRelationGeometryCheckpoint(value, nodes) {
  if (!isRecord(value) || value.version !== 1 || !isUnknownArray(value.entries) || value.entries.length > Math.min(nodes.length, 1e5)) return false;
  const live = new Map(nodes.map((node) => [node.id, node])), seen = /* @__PURE__ */ new Set();
  let total = 0;
  for (const entry of value.entries) {
    if (!isRecord(entry) || typeof entry.id !== "string" || !entry.id.trim() || entry.id.length > 2048 || seen.has(entry.id) || typeof entry.shape !== "string" || !entry.shape || entry.shape.length > 65536) return false;
    const node = live.get(entry.id);
    if (!node || !canPersistRelationGeometry(node)) return false;
    if (entry.textStamp !== void 0 && (typeof entry.textStamp !== "string" || !/^[a-f0-9]{64}$/.test(entry.textStamp))) return false;
    if (entry.source !== void 0 && !validSource(entry.source)) return false;
    total += entry.shape.length;
    if (total > 8e6) return false;
    seen.add(entry.id);
  }
  return true;
}

// tools/board-tool/schema/board-path.ts
function isBoardPath(value) {
  return typeof value === "string" && (value.endsWith(".thoughtspace") || /\.md$/i.test(value)) && !/(^\/|(^|\/)\.\.?(\/|$)|\\)/.test(value);
}

// tools/board-tool/schema/media-source.ts
var maximumMediaTime = 1e8;
function mediaKind(path4) {
  if (/\.(mp4|webm|mov|m4v|ogv|tsvideo)$/i.test(path4)) return "video";
  if (/\.(mp3|m4a|wav|ogg|oga|flac|aac|opus|tsaudio)$/i.test(path4)) return "audio";
}
function isVaultMediaPath(path4) {
  return isVaultPath(path4) && mediaKind(path4) !== void 0;
}
function isVaultPath(path4) {
  return typeof path4 === "string" && path4.length > 0 && path4.length <= 8192 && path4.trim() === path4 && !hasControl(path4) && !path4.includes("\\") && !/^([a-z][a-z\d+.-]*:|\/)/i.test(path4) && path4.split("/").every((part) => part !== "" && part !== "." && part !== "..");
}
function hasControl(value) {
  return hasAsciiControl(value) || value.includes("\x7F");
}
function validMediaTime(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= maximumMediaTime;
}

// tools/board-tool/schema/image-host.ts
function remoteImageUrl(value) {
  if (typeof value !== "string" || value.length > 8192 || /[\s\\<>]/.test(value)) return;
  try {
    const url = new URL(value);
    if (url.protocol === "https:" && !url.username && !url.password && url.hostname) return url.href;
  } catch {
  }
}

// tools/board-tool/schema/yingjian.ts
function yingjianNotePath(value) {
  if (typeof value !== "string" || !value || value.length > 4096 || /[\\\r\n\0]/.test(value) || value.startsWith("/") || /^[a-z]:/i.test(value) || !value.endsWith(".md")) return;
  if (value.split("/").some((part) => !part || part === "." || part === ".." || part.startsWith("."))) return;
  return value;
}

// tools/board-tool/schema/saved-searches.ts
var queryKeys = ["query", "kind", "group", "color", "review", "full"];
function validQuery(value) {
  return isRecord(value) && Object.keys(value).every((key) => queryKeys.includes(key)) && typeof value.query === "string" && value.query.length <= 2e3 && isOneOf(value.kind, ["", "card", "text", "image", "pdf", "audio", "video", "section", "board", "mindmap"]) && typeof value.group === "string" && value.group.length <= 200 && isOneOf(value.color, ["", "sand", "blue", "green", "rose", "purple", "orange", "red", "teal", "cyan", "lime", "slate", "brown"]) && isOneOf(value.review, ["", "later", "reading", "done"]) && typeof value.full === "boolean";
}
function validSavedSearches(value) {
  if (!isUnknownArray(value) || value.length > 50) return false;
  const seen = /* @__PURE__ */ new Set();
  for (const item of value) {
    if (!isRecord(item) || Object.keys(item).some((key) => !["id", "name", "query"].includes(key)) || typeof item.id !== "string" || !item.id.trim() || item.id.length > 200 || seen.has(item.id) || typeof item.name !== "string" || !item.name.trim() || item.name.length > 100 || hasAsciiControl(item.name) || !validQuery(item.query)) return false;
    seen.add(item.id);
  }
  return true;
}

// tools/board-tool/schema/model.ts
var colors = ["sand", "blue", "green", "rose", "purple", "orange", "red", "teal", "cyan", "lime", "slate", "brown"];
var validCardFill = (value) => typeof value === "string" && (value === "none" || colors.includes(value) || /^#[0-9a-fA-F]{6}$/.test(value));
var emptyBoard = () => ({ version: 1, nodes: [], edges: [], viewport: { x: 60, y: 60, zoom: 1 } });
function parseBoard(text) {
  return parseBoardValue(JSON.parse(text));
}
function parseBoardValue(b) {
  assertBoardData(b);
  if (b.background !== void 0) b.background = cleanBoardBackground(b.background);
  if (b.brainColors !== void 0) {
    const colors2 = cleanBrainColors(b.brainColors);
    if (Object.keys(colors2).length) b.brainColors = colors2;
    else delete b.brainColors;
  }
  validateBranches(b);
  if (b.readingLayout !== void 0 && !validReadingCheckpoint(b.readingLayout, b.nodes)) delete b.readingLayout;
  if (b.relationGeometry !== void 0 && !validRelationGeometryCheckpoint(b.relationGeometry, b.nodes)) delete b.relationGeometry;
  return b;
}
function assertBoardData(b) {
  if (!isRecord(b) || !isOneOf(b.version, [1, 2, 3]) || !isUnknownArray(b.nodes) || !isUnknownArray(b.edges)) throw new Error("\u4E0D\u652F\u6301\u7684\u767D\u677F\u683C\u5F0F\u6216\u7248\u672C");
  if (b.presentation === "handwriting") {
    if (b.version !== 3) throw Error("\u624B\u5199\u767D\u677F\u7248\u672C\u65E0\u6548");
    assertInkData(b.ink);
  } else if (b.ink !== void 0) throw Error("\u624B\u5199\u7B14\u8FF9\u53EA\u80FD\u4FDD\u5B58\u5728\u624B\u5199\u767D\u677F");
  if (b.defaultEdgeStyle !== void 0 && (!isOneOf(b.defaultEdgeStyle, ["curve", "straight", "elbow"]) || b.version !== 3)) throw Error("\u767D\u677F\u9ED8\u8BA4\u8FDE\u7EBF\u8DEF\u5F84\u65E0\u6548");
  const ids = /* @__PURE__ */ new Set();
  for (const n of b.nodes) {
    if (!isRecord(n) || typeof n.id !== "string" || !n.id.trim() || ids.has(n.id) || !isOneOf(n.kind, b.version === 3 ? ["card", "section", "board", "mindmap", "text", "image", "pdf", "audio", "video"] : b.version === 2 ? ["card", "section", "board"] : ["card", "section"]) || ![n.x, n.y].every(isFiniteNumber) || !isFiniteNumber(n.width) || !isFiniteNumber(n.height) || n.width < 80 || n.height < nodeMinimumHeight(n.kind) || !isOneOf(n.color, colors) || isOneOf(n.kind, ["card", "board", "image", "pdf", "audio", "video"]) && (typeof n.file !== "string" || !(n.kind === "audio" || n.kind === "video" ? isVaultMediaPath(n.file) && mediaKind(n.file) === n.kind : n.kind === "pdf" ? /\.pdf$/i.test(n.file) : n.kind === "image" ? /\.(png|jpe?g|gif|webp|avif|bmp)$/i.test(n.file) : n.kind === "board" ? isBoardPath(n.file) : /\.md$/i.test(n.file)) || /(^\/|(^|\/)\.\.?(\/|$)|\\)/.test(n.file)) || n.kind === "section" && typeof n.title !== "string") throw new Error("\u767D\u677F\u8282\u70B9\u6570\u636E\u4E0D\u5B8C\u6574");
    if (["file", "title", "text"].some((key) => n[key] !== void 0 && typeof n[key] !== "string")) throw new Error("\u767D\u677F\u8282\u70B9\u6570\u636E\u4E0D\u5B8C\u6574");
    if (n.brainIdea !== void 0 && (b.version !== 3 || n.kind !== "text" || n.brainIdea !== true || typeof n.title !== "string" || !n.title.trim() || n.title.length > 160 || n.file !== void 0)) throw Error("\u8111\u56FE\u60F3\u6CD5\u8282\u70B9\u65E0\u6548");
    if (n.kind === "mindmap" ? !validBoardMindmapState(n.mindmap) : n.mindmap !== void 0) throw Error("\u8111\u56FE\u5BB9\u5668\u72B6\u6001\u65E0\u6548");
    if (n.collapsed !== void 0 && typeof n.collapsed !== "boolean" || n.collapsed && (!isOneOf(n.kind, ["card", "pdf", "board", "mindmap", "text", "audio", "video", "image"]) || n.height !== 72 || !isFiniteNumber(n.expandedHeight) || n.expandedHeight < nodeMinimumHeight(n.kind)) || !n.collapsed && n.expandedHeight !== void 0) throw new Error("\u5361\u7247\u6298\u53E0\u6570\u636E\u4E0D\u5B8C\u6574");
    if (n.kind === "text" && typeof n.text !== "string" || n.topic !== void 0 && (b.version !== 3 || typeof n.topic !== "boolean")) throw new Error("\u6587\u672C\u6216\u4E3B\u9898\u6570\u636E\u4E0D\u5B8C\u6574");
    if (n.textColor !== void 0 && !isOneOf(n.textColor, ["default", ...colors]) || n.fontSize !== void 0 && (!isFiniteNumber(n.fontSize) || n.fontSize < 12 || n.fontSize > 48) || n.fontFamily !== void 0 && !isOneOf(n.fontFamily, ["default", "serif", "mono"]) || n.textAlign !== void 0 && !isOneOf(n.textAlign, ["left", "center", "right"]) || n.autoSize !== void 0 && typeof n.autoSize !== "boolean" || n.textAutoHeight !== void 0 && (n.kind !== "text" || typeof n.textAutoHeight !== "boolean")) throw new Error("\u6587\u672C\u6837\u5F0F\u6570\u636E\u4E0D\u5B8C\u6574");
    if (n.mindmapRules !== void 0 && (!isRecord(n.mindmapRules) || !isOneOf(n.mindmapRules.layout, ["right", "left", "down", "up", "bilateral"]) || !isOneOf(n.mindmapRules.density, ["compact", "standard", "relaxed"]) || typeof n.mindmapRules.automatic !== "boolean" || n.kind === "section")) throw Error("\u5BFC\u56FE\u81EA\u52A8\u5E03\u5C40\u89C4\u5219\u65E0\u6548");
    if (n.textMaxWidth !== void 0 && (n.kind !== "text" || !isFiniteNumber(n.textMaxWidth) || n.textMaxWidth < 160 || n.textMaxWidth > 720)) throw Error("\u4E3B\u9898\u6362\u884C\u5BBD\u5EA6\u65E0\u6548");
    if (n.mediaStart !== void 0 && (!isOneOf(n.kind, ["audio", "video"]) || !validMediaTime(n.mediaStart))) throw Error("\u5A92\u4F53\u8D77\u59CB\u65F6\u95F4\u65E0\u6548");
    if (n.pdfPage !== void 0 && (n.kind !== "pdf" || !isFiniteNumber(n.pdfPage) || !Number.isSafeInteger(n.pdfPage) || n.pdfPage < 1)) throw Error("PDF \u9875\u7801\u65E0\u6548");
    if (n.paragraphQuote !== void 0 && (n.kind !== "text" || !validParagraphOrigin(n.paragraphQuote))) throw Error("\u6BB5\u843D\u6765\u6E90\u65E0\u6548");
    if (n.pdfQuote !== void 0 && (n.kind !== "text" || !isRecord(n.pdfQuote) || typeof n.pdfQuote.original !== "string" || n.pdfQuote.original.length > 1e5 || typeof n.pdfQuote.sourcePath !== "string" || n.pdfQuote.sourcePath.length > 2048 || hasAsciiControl(n.pdfQuote.sourcePath))) throw Error("PDF \u5F15\u7528\u539F\u6587\u65E0\u6548");
    if (n.webUrl !== void 0 && (n.kind !== "text" || !webUrl(n.webUrl))) throw Error("\u7F51\u9875\u94FE\u63A5\u65E0\u6548");
    if (n.imageUrl !== void 0 && (n.kind !== "image" || !remoteImageUrl(n.imageUrl))) throw Error("\u56FE\u5E8A\u56FE\u7247\u5730\u5740\u65E0\u6548");
    if (n.videoCapture !== void 0 && (!isOneOf(n.kind, ["text", "image"]) || !isRecord(n.videoCapture) || typeof n.videoCapture.id !== "string" || !/^[a-f0-9-]{36}$/.test(n.videoCapture.id) || !yingjianNotePath(n.videoCapture.note))) throw Error("\u89C6\u9891\u8BB0\u5F55\u6765\u6E90\u65E0\u6548");
    if (n.transparent !== void 0 && (!isOneOf(n.kind, ["card", "text", "section"]) || typeof n.transparent !== "boolean")) throw Error("\u5BF9\u8C61\u900F\u660E\u6837\u5F0F\u65E0\u6548");
    if (n.cardStyle !== void 0 && (!(n.kind === "text" || n.kind === "card" && typeof n.file === "string" && /\.md$/i.test(n.file)) || !!n.webUrl || !isOneOf(n.cardStyle, ["band", "paper", "index", "sticky"]))) throw Error("\u7B14\u8BB0\u5361\u7247\u6837\u5F0F\u65E0\u6548");
    if (n.fillColor !== void 0 && (!isOneOf(n.kind, ["card", "text", "section"]) || !validCardFill(n.fillColor))) throw Error("\u5BF9\u8C61\u80CC\u666F\u989C\u8272\u65E0\u6548");
    if (n.sectionDivider !== void 0 && (n.kind !== "section" || !isOneOf(n.sectionDivider, ["none", "solid", "dashed", "dotted"]))) throw Error("\u5206\u7EC4\u6807\u9898\u5206\u9694\u7EBF\u6837\u5F0F\u65E0\u6548");
    if (n.preferredWidth !== void 0 && (n.kind !== "card" || !isFiniteNumber(n.preferredWidth) || n.preferredWidth < 220 || n.preferredWidth > 520)) throw Error("\u5361\u7247\u9ED8\u8BA4\u5BBD\u5EA6\u65E0\u6548");
    if (n.customBorder !== void 0 && typeof n.customBorder !== "boolean") throw Error("\u8FB9\u6846\u989C\u8272\u8BBE\u7F6E\u65E0\u6548");
    if (n.locked !== void 0 && typeof n.locked !== "boolean" || n.autoFit !== void 0 && (n.kind !== "card" || typeof n.autoFit !== "boolean") || n.borderWidth !== void 0 && !isOneOf(n.borderWidth, [0, 1, 2, 3, 4]) || n.borderStyle !== void 0 && !isOneOf(n.borderStyle, ["solid", "dashed", "dotted"])) throw Error("\u5BF9\u8C61\u6837\u5F0F\u6216\u9501\u5B9A\u72B6\u6001\u4E0D\u5B8C\u6574");
    if (n.branchFolded !== void 0 && (b.version !== 3 || typeof n.branchFolded !== "boolean")) throw Error("\u5BFC\u56FE\u6298\u53E0\u72B6\u6001\u65E0\u6548");
    if (n.sectionFolded !== void 0 && (b.version !== 3 || typeof n.sectionFolded !== "boolean" || n.kind !== "section")) throw Error("\u5206\u7EC4\u6298\u53E0\u72B6\u6001\u65E0\u6548");
    if (n.review !== void 0 && (!isOneOf(n.review, ["later", "reading", "done"]) || !isOneOf(n.kind, ["card", "text", "image", "pdf"]))) throw Error("\u9605\u8BFB\u72B6\u6001\u65E0\u6548");
    ids.add(n.id);
  }
  const edgeIds = /* @__PURE__ */ new Set();
  for (const e of b.edges) {
    if (!isRecord(e) || typeof e.id !== "string" || !e.id.trim() || edgeIds.has(e.id) || typeof e.from !== "string" || typeof e.to !== "string" || !ids.has(e.from) || !ids.has(e.to) || e.from === e.to || typeof e.label !== "string") throw new Error("\u767D\u677F\u8FDE\u7EBF\u6570\u636E\u4E0D\u5B8C\u6574");
    for (const [key, values] of Object.entries({ style: ["curve", "straight", "elbow"], direction: ["forward", "both", "none"], color: colors, fromSide: ["top", "right", "bottom", "left"], toSide: ["top", "right", "bottom", "left"], kind: ["branch"] })) if (e[key] !== void 0 && (b.version !== 3 || !isOneOf(e[key], values))) throw new Error("\u8FDE\u7EBF\u6837\u5F0F\u4E0D\u5B8C\u6574");
    if (e.dashed !== void 0 && (b.version !== 3 || typeof e.dashed !== "boolean")) throw new Error("\u8FDE\u7EBF\u6837\u5F0F\u4E0D\u5B8C\u6574");
    edgeIds.add(e.id);
  }
  if (!isRecord(b.viewport) || ![b.viewport.x, b.viewport.y].every(isFiniteNumber) || !isFiniteNumber(b.viewport.zoom) || b.viewport.zoom < 0.15 || b.viewport.zoom > 2.5) throw new Error("\u767D\u677F\u89C6\u53E3\u6570\u636E\u4E0D\u5B8C\u6574");
  if (b.presentation !== void 0 && (b.version !== 3 || !isOneOf(b.presentation, ["brain", "handwriting"]))) throw Error("\u767D\u677F\u5C55\u793A\u6A21\u5F0F\u65E0\u6548");
  if (b.presentation === "brain" ? !validBoardMindmapState(b.brain) : b.brain !== void 0) throw Error("\u8111\u56FE\u767D\u677F\u72B6\u6001\u65E0\u6548");
  if (b.brainReadingPositions !== void 0 && (b.version !== 3 || b.presentation !== "brain" || !validBrainReadingPositions(b.brainReadingPositions))) throw Error("\u8111\u56FE\u9605\u8BFB\u4F4D\u7F6E\u6570\u636E\u65E0\u6548");
  if (b.brainViewport !== void 0 && (b.presentation !== "brain" || !validBrainViewport(b.brainViewport))) throw Error("\u8111\u56FE\u767D\u677F\u89C6\u53E3\u65E0\u6548");
  if (b.mode !== void 0 && (b.version !== 3 || !isOneOf(b.mode, ["free", "mindmap"])) || b.mindmapDirection !== void 0 && (b.version !== 3 || !isOneOf(b.mindmapDirection, ["right", "down", "up"]))) throw new Error("\u5BFC\u56FE\u8BBE\u7F6E\u4E0D\u5B8C\u6574");
  if (b.mindmapLayout !== void 0 && (b.version !== 3 || !isOneOf(b.mindmapLayout, ["right", "left", "down", "up", "bilateral"])) || b.mindmapDensity !== void 0 && (b.version !== 3 || !isOneOf(b.mindmapDensity, ["compact", "standard", "relaxed"]))) throw Error("\u601D\u7EF4\u5BFC\u56FE\u5E03\u5C40\u8BBE\u7F6E\u65E0\u6548");
  if (b.spaceId !== void 0 && (typeof b.spaceId !== "string" || !/^[a-zA-Z0-9-]{1,80}$/.test(b.spaceId))) throw Error("\u7A7A\u95F4\u6807\u8BC6\u65E0\u6548");
  if (b.snapToGrid !== void 0 && typeof b.snapToGrid !== "boolean") throw Error("\u5438\u9644\u8BBE\u7F6E\u65E0\u6548");
  if (b.savedViews !== void 0) {
    if (!isUnknownArray(b.savedViews) || b.savedViews.length > 50) throw Error("\u4FDD\u5B58\u89C6\u89D2\u65E0\u6548");
    const seen = /* @__PURE__ */ new Set();
    for (const v of b.savedViews) {
      if (!isRecord(v) || typeof v.id !== "string" || seen.has(v.id) || typeof v.name !== "string" || !v.name.trim() || v.name.length > 100 || !isRecord(v.viewport) || ![v.viewport.x, v.viewport.y].every(isFiniteNumber) || !isFiniteNumber(v.viewport.zoom) || v.viewport.zoom < 0.15 || v.viewport.zoom > 2.5) throw Error("\u4FDD\u5B58\u89C6\u89D2\u65E0\u6548");
      seen.add(v.id);
    }
  }
  if (b.savedSearches !== void 0 && (b.version !== 3 || !validSavedSearches(b.savedSearches))) throw Error("\u6750\u6599\u6E05\u5355\u6570\u636E\u65E0\u6548");
  if (b.selectionSets !== void 0) {
    if (!isUnknownArray(b.selectionSets) || b.selectionSets.length > 30) throw Error("\u4FDD\u5B58\u9009\u533A\u65E0\u6548");
    const seen = /* @__PURE__ */ new Set();
    for (const s of b.selectionSets) {
      if (!isRecord(s) || typeof s.id !== "string" || seen.has(s.id) || typeof s.name !== "string" || !s.name.trim() || s.name.length > 60 || !isUnknownArray(s.ids) || s.ids.length > 1e5 || s.ids.some((id) => typeof id !== "string") || new Set(s.ids).size !== s.ids.length) throw Error("\u4FDD\u5B58\u9009\u533A\u65E0\u6548");
      seen.add(s.id);
    }
  }
  if (b.writing !== void 0) {
    const w = b.writing;
    if (!isRecord(w) || typeof w.title !== "string" || w.title.length > 160 || !isUnknownArray(w.order) || w.order.length > 1e5 || w.order.some((id) => typeof id !== "string") || new Set(w.order).size !== w.order.length || w.referenceId !== void 0 && typeof w.referenceId !== "string" || w.draftPath !== void 0 && typeof w.draftPath !== "string") throw Error("\u5199\u4F5C\u987A\u5E8F\u6570\u636E\u65E0\u6548");
    if (w.manuscript !== void 0 && (typeof w.manuscript !== "string" || w.manuscript.length > 1e6)) throw Error("\u5199\u4F5C\u6B63\u6587\u6570\u636E\u65E0\u6548");
    if (w.assemblyStamp !== void 0 && (typeof w.assemblyStamp !== "string" || !/^[a-f0-9]{16}$/.test(w.assemblyStamp))) throw Error("\u5199\u4F5C\u7F16\u6392\u5BF9\u7167\u65E0\u6548");
    if (w.completedSections !== void 0 && (!isUnknownArray(w.completedSections) || w.completedSections.length > 1e4 || w.completedSections.some((key) => typeof key !== "string" || !/^[a-f0-9]{16}:\d+:\d+$/.test(key)) || new Set(w.completedSections).size !== w.completedSections.length)) throw Error("\u5199\u4F5C\u7AE0\u8282\u8FDB\u5EA6\u65E0\u6548");
    if (w.includeSources !== void 0 && typeof w.includeSources !== "boolean") throw Error("\u5199\u4F5C\u6765\u6E90\u9009\u9879\u65E0\u6548");
    if (w.referenceIds !== void 0 && (!isUnknownArray(w.referenceIds) || w.referenceIds.length > 12 || w.referenceIds.some((id) => typeof id !== "string") || new Set(w.referenceIds).size !== w.referenceIds.length)) throw Error("\u5199\u4F5C\u53C2\u8003\u6570\u636E\u65E0\u6548");
    const chapter = (c) => isRecord(c) && typeof c.id === "string" && typeof c.title === "string" && c.title.length <= 160 && typeof c.body === "string" && c.body.length <= 1e5 && !ids.has(c.id);
    if (w.chapters !== void 0 && (!isUnknownArray(w.chapters) || w.chapters.length > 500 || !w.chapters.every(chapter) || new Set(w.chapters.map((c) => c.id)).size !== w.chapters.length)) throw Error("\u5199\u4F5C\u7AE0\u8282\u6570\u636E\u65E0\u6548");
    if (w.options !== void 0) {
      if (!isRecord(w.options)) throw Error("\u5199\u4F5C\u9009\u9879\u65E0\u6548");
      for (const o of Object.values(w.options)) {
        if (!isRecord(o) || o.title !== void 0 && (typeof o.title !== "string" || o.title.length > 160) || o.note !== void 0 && (typeof o.note !== "string" || o.note.length > 2e4) || o.level !== void 0 && !isOneOf(o.level, [0, 2, 3, 4]) || o.excluded !== void 0 && typeof o.excluded !== "boolean") throw Error("\u5199\u4F5C\u9009\u9879\u65E0\u6548");
      }
    }
  }
}
function validBrainViewport(value) {
  return isRecord(value) && Object.keys(value).every((key) => ["x", "y", "zoom"].includes(key)) && [value.x, value.y].every(isFiniteNumber) && isFiniteNumber(value.zoom) && value.zoom >= 0.15 && value.zoom <= 2.5;
}
function nodeMinimumHeight(kind) {
  return kind === "text" ? 40 : 60;
}

// tools/board-tool/schema/board-document.ts
var BoardDocumentError = class extends Error {
  constructor(code, message, cause) {
    super(message, cause === void 0 ? void 0 : { cause });
    this.code = code;
    this.name = "BoardDocumentError";
  }
};
var START = "<!-- thoughtspace-board-layout:start -->";
var END = "<!-- thoughtspace-board-layout:end -->";
var metadata = /* @__PURE__ */ new WeakMap();
function isMarkdownBoardFrontmatter(raw) {
  return isRecord(raw) && Object.hasOwn(raw, "thoughtspace") && raw.thoughtspace === "board";
}
function readBoardDocument(text, extension, parseYaml) {
  const suffix = extension.toLowerCase().replace(/^\./, "");
  if (suffix === "thoughtspace") {
    const board2 = validatedBoard(text.replace(/^\uFEFF/, ""));
    return remember({ format: "legacy", board: board2, source: text, layoutSource: text }, { extras: {}, eol: "\n" });
  }
  if (suffix !== "md") throw new BoardDocumentError("unsupported-extension", "\u4E0D\u652F\u6301\u7684\u767D\u677F\u6587\u4EF6\u6269\u5C55\u540D");
  const frontmatterEnd = validateFrontmatter(text, parseYaml), zone = layoutZone(text, frontmatterEnd);
  let envelope;
  try {
    envelope = JSON.parse(zone.payload);
  } catch (cause) {
    throw new BoardDocumentError("layout-json-invalid", "\u767D\u677F\u5E03\u5C40\u533A\u7684 JSON \u65E0\u6548\uFF0C\u539F\u6587\u672A\u66F4\u6539", cause);
  }
  if (!isRecord(envelope) || envelope.format !== "thoughtspace-board" || !Object.hasOwn(envelope, "board")) throw new BoardDocumentError("layout-envelope-invalid", "\u767D\u677F\u5E03\u5C40\u6570\u636E\u5C01\u88C5\u65E0\u6548\uFF0C\u539F\u6587\u672A\u66F4\u6539");
  if (envelope.version !== 1) throw new BoardDocumentError("layout-version-unsupported", "\u4E0D\u652F\u6301\u7684\u767D\u677F\u5E03\u5C40\u7248\u672C\uFF0C\u539F\u6587\u672A\u66F4\u6539");
  const exceptionalNumbers = /-0(?:\.\d+)?(?:[eE][+-]?\d+)?(?=[,\]} \t\r\n])|[eE][+-]?\d|\d{309}/.test(zone.payload);
  const board = exceptionalNumbers ? validatedBoard(serialize(envelope.board)) : validatedBoardValue(envelope.board), extras = { ...envelope };
  delete extras.board;
  delete extras.format;
  delete extras.version;
  return remember({ format: "markdown", board, source: text, layoutSource: zone.source, layoutStart: zone.start, layoutEnd: zone.end }, { extras, eol: zone.eol });
}
function createMarkdownBoardDocument(board, title) {
  const heading = (title.replace(/[\r\n\u2028\u2029]+/g, " ").trim() || "ThoughtSpace \u767D\u677F").replace(/[\\`*_[\]<>#]/g, "\\$&");
  return `---
thoughtspace: board
---

# ${heading}

\u53EF\u5728\u5E03\u5C40\u533A\u5916\u6DFB\u52A0 Markdown \u6B63\u6587\uFF1B\u767D\u677F\u5E03\u5C40\u533A\u7531 ThoughtSpace \u7BA1\u7406\u3002

${serializeZone(board, {}, "\n")}
`;
}
function remember(document, extra) {
  metadata.set(document, { source: document.source, layoutSource: document.layoutSource, format: document.format, ...extra });
  return document;
}
function validatedBoard(text) {
  try {
    return parseBoard(text);
  } catch (cause) {
    throw new BoardDocumentError("board-invalid", "\u767D\u677F\u6570\u636E\u65E0\u6548\uFF0C\u539F\u6587\u672A\u66F4\u6539", cause);
  }
}
function validatedBoardValue(value) {
  try {
    return parseBoardValue(value);
  } catch (cause) {
    throw new BoardDocumentError("board-invalid", "\u767D\u677F\u6570\u636E\u65E0\u6548\uFF0C\u539F\u6587\u672A\u66F4\u6539", cause);
  }
}
function serialize(value) {
  try {
    const result = JSON.stringify(value, null, 2);
    if (result === void 0) throw Error("No JSON value");
    return result;
  } catch (cause) {
    throw new BoardDocumentError("serialization-failed", "\u767D\u677F\u5E03\u5C40\u65E0\u6CD5\u5E8F\u5217\u5316\uFF0C\u539F\u6587\u672A\u66F4\u6539", cause);
  }
}
function serializeZone(board, extras, eol) {
  const payload = serialize({ ...extras, format: "thoughtspace-board", version: 1, board }).replaceAll("\n", eol);
  return [START, "```json", payload, "```", END].join(eol);
}
function validateFrontmatter(text, parseYaml) {
  const opening = /^(?:\uFEFF)?---[ \t]*(?:\r?\n)/.exec(text);
  if (!opening) throw new BoardDocumentError("frontmatter-missing", "Markdown \u767D\u677F\u7F3A\u5C11\u9876\u90E8 YAML \u5C5E\u6027\uFF0C\u539F\u6587\u672A\u66F4\u6539");
  const closing = /^---[ \t]*(?:\r?\n|$)/gm;
  closing.lastIndex = opening[0].length;
  const match = closing.exec(text);
  if (!match) throw new BoardDocumentError("frontmatter-invalid", "Markdown \u767D\u677F\u7684 YAML \u5C5E\u6027\u533A\u672A\u5B8C\u6574\u95ED\u5408\uFF0C\u539F\u6587\u672A\u66F4\u6539");
  let raw;
  try {
    raw = parseYaml(text.slice(opening[0].length, match.index));
  } catch (cause) {
    throw new BoardDocumentError("yaml-invalid", "Markdown \u767D\u677F\u7684 YAML \u5C5E\u6027\u65E0\u6548\uFF0C\u539F\u6587\u672A\u66F4\u6539", cause);
  }
  if (!isMarkdownBoardFrontmatter(raw)) throw new BoardDocumentError("not-board", "Markdown \u6587\u4EF6\u672A\u58F0\u660E thoughtspace: board\uFF0C\u539F\u6587\u672A\u66F4\u6539");
  return match.index + match[0].length;
}
function layoutZone(text, frontmatterEnd) {
  const markers = /^[ \t]*<!--[ \t]*thoughtspace-board-layout\b[^\r\n]*(?:\r?\n|$)/gmi;
  const starts = [], ends = [];
  let match;
  while (match = markers.exec(text)) {
    const line = match[0].replace(/\r?\n$/, ""), trimmed = line.trim();
    if (trimmed !== START && trimmed !== END) throw new BoardDocumentError("layout-damaged", "\u767D\u677F\u5E03\u5C40\u6807\u8BB0\u5DF2\u635F\u574F\uFF0C\u539F\u6587\u672A\u66F4\u6539");
    (trimmed === START ? starts : ends).push({ index: match.index, line });
  }
  if (starts.length > 1 || ends.length > 1) throw new BoardDocumentError("layout-duplicate", "\u6587\u4EF6\u5305\u542B\u91CD\u590D\u7684\u767D\u677F\u5E03\u5C40\u6807\u8BB0\uFF0C\u539F\u6587\u672A\u66F4\u6539");
  if (starts.length !== 1 || ends.length !== 1) throw new BoardDocumentError("layout-missing", "\u6587\u4EF6\u7F3A\u5C11\u5B8C\u6574\u7684\u767D\u677F\u5E03\u5C40\u533A\uFF0C\u539F\u6587\u672A\u66F4\u6539");
  const begin = starts[0], finish = ends[0];
  if (begin.index < frontmatterEnd || finish.index <= begin.index) throw new BoardDocumentError("layout-damaged", "\u767D\u677F\u5E03\u5C40\u6807\u8BB0\u987A\u5E8F\u6216\u4F4D\u7F6E\u65E0\u6548\uFF0C\u539F\u6587\u672A\u66F4\u6539");
  const body = text.slice(begin.index + begin.line.length, finish.index), fence = /^(\r?\n)[ \t]*```json[ \t]*\r?\n([\s\S]*?)\r?\n[ \t]*```[ \t]*\r?\n$/.exec(body);
  const fences = body.match(/^[ \t]*`{3,}[^\r\n]*$/gm);
  if (!fence || fences?.length !== 2) throw new BoardDocumentError("layout-damaged", "\u767D\u677F\u5E03\u5C40\u533A\u5FC5\u987B\u5305\u542B\u4E00\u4E2A\u5B8C\u6574\u7684 JSON \u4EE3\u7801\u5757\uFF0C\u539F\u6587\u672A\u66F4\u6539");
  const end = finish.index + finish.line.length;
  return { start: begin.index, end, source: text.slice(begin.index, end), payload: fence[2], eol: fence[1] };
}

// tools/board-tool/diagnostics.ts
var record2 = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
var finite2 = (value) => typeof value === "number" && Number.isFinite(value);
var escape = (key) => key.replaceAll("~", "~0").replaceAll("/", "~1");
var pointer = (base, key) => base + "/" + escape(String(key));
function causeText(error) {
  if (!(error instanceof Error)) return String(error);
  let text = error.name + ": " + error.message;
  const seen = /* @__PURE__ */ new Set([error]);
  let cause = error.cause;
  while (cause !== void 0 && !seen.has(cause)) {
    seen.add(cause);
    text += " <- " + (cause instanceof Error ? cause.name + ": " + cause.message : String(cause));
    cause = cause instanceof Error ? cause.cause : void 0;
  }
  return text;
}
function deepestMessage(error) {
  let current = error;
  const seen = /* @__PURE__ */ new Set();
  while (current instanceof Error && current.cause instanceof Error && !seen.has(current)) {
    seen.add(current);
    current = current.cause;
  }
  return current instanceof Error ? current.message : String(current);
}
function inkLocation(raw, base) {
  if (!record2(raw)) return { pointer: base };
  if (raw.version !== 1) return { pointer: pointer(base, "version") };
  const strokes = raw.strokes, sp = pointer(base, "strokes");
  if (!Array.isArray(strokes) || strokes.length > MAX_INK_STROKES) return { pointer: sp };
  const seen = /* @__PURE__ */ new Map();
  let total = 0;
  for (let i = 0; i < strokes.length; i++) {
    const s = strokes[i], p = pointer(sp, i);
    if (!record2(s)) return { pointer: p };
    if (typeof s.id !== "string" || !s.id.trim() || s.id.length > 256 || /[\u0000-\u001f\u007f]/.test(s.id)) return { pointer: pointer(p, "id") };
    if (seen.has(s.id)) return { pointer: pointer(p, "id"), relatedPointers: [pointer(pointer(sp, seen.get(s.id)), "id")] };
    seen.set(s.id, i);
    if (typeof s.color !== "string" || !/^#[0-9a-fA-F]{6}$/.test(s.color)) return { pointer: pointer(p, "color") };
    if (!finite2(s.width) || s.width < 0.5 || s.width > 24) return { pointer: pointer(p, "width") };
    if (!Array.isArray(s.points) || !s.points.length || s.points.length > MAX_STROKE_POINTS) return { pointer: pointer(p, "points") };
    total += s.points.length;
    if (total > MAX_INK_POINTS) return { pointer: sp, relatedPointers: [pointer(p, "points")] };
    for (let j = 0; j < s.points.length; j++) {
      const point = s.points[j], pp = pointer(pointer(p, "points"), j);
      if (!Array.isArray(point) || point.length !== 3) return { pointer: pp };
      for (const k of [0, 1]) if (!finite2(point[k]) || Math.abs(point[k]) > MAX_INK_COORDINATE) return { pointer: pointer(pp, k) };
      if (!finite2(point[2]) || point[2] < 0 || point[2] > 1) return { pointer: pointer(pp, 2) };
    }
  }
  return { pointer: base };
}
function boardErrorLocation(raw, base, message) {
  if (!record2(raw)) return { pointer: base };
  if (message === "\u4E0D\u652F\u6301\u7684\u767D\u677F\u683C\u5F0F\u6216\u7248\u672C") {
    if (![1, 2, 3].includes(raw.version)) return { pointer: pointer(base, "version") };
    return { pointer: pointer(base, Array.isArray(raw.nodes) ? "edges" : "nodes") };
  }
  if (message.startsWith("\u624B\u5199\u7B14\u8FF9\u6570\u636E\u65E0\u6548")) return inkLocation(raw.ink, pointer(base, "ink"));
  if (message === "\u624B\u5199\u767D\u677F\u7248\u672C\u65E0\u6548") return { pointer: pointer(base, "version") };
  if (message === "\u624B\u5199\u7B14\u8FF9\u53EA\u80FD\u4FDD\u5B58\u5728\u624B\u5199\u767D\u677F") return { pointer: pointer(base, "ink") };
  const nodes = Array.isArray(raw.nodes) ? raw.nodes : [], ids = /* @__PURE__ */ new Map();
  if (message === "\u767D\u677F\u8282\u70B9\u6570\u636E\u4E0D\u5B8C\u6574") for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i], p = pointer(pointer(base, "nodes"), i);
    if (!record2(n)) return { pointer: p };
    if (typeof n.id !== "string" || !n.id.trim()) return { pointer: pointer(p, "id") };
    if (ids.has(n.id)) return { pointer: pointer(p, "id"), relatedPointers: [pointer(pointer(pointer(base, "nodes"), ids.get(n.id)), "id")] };
    ids.set(n.id, i);
    const kinds = raw.version === 3 ? ["card", "section", "board", "mindmap", "text", "image", "pdf", "audio", "video"] : raw.version === 2 ? ["card", "section", "board"] : ["card", "section"];
    if (typeof n.kind !== "string" || !kinds.includes(n.kind)) return { pointer: pointer(p, "kind") };
    for (const key of ["x", "y", "width", "height"]) if (!finite2(n[key])) return { pointer: pointer(p, key) };
    if (n.width < 80) return { pointer: pointer(p, "width") };
    if (n.height < nodeMinimumHeight(n.kind)) return { pointer: pointer(p, "height") };
    if (!colors.includes(n.color)) return { pointer: pointer(p, "color") };
    if (["card", "board", "image", "pdf", "audio", "video"].includes(n.kind)) {
      const file = n.file, valid = typeof file === "string" && !/(^\/|(^|\/)\.\.?(\/|$)|\\)/.test(file) && (n.kind === "audio" || n.kind === "video" ? isVaultMediaPath(file) && mediaKind(file) === n.kind : n.kind === "pdf" ? /\.pdf$/i.test(file) : n.kind === "image" ? /\.(png|jpe?g|gif|webp|avif|bmp)$/i.test(file) : n.kind === "board" ? isBoardPath(file) : /\.md$/i.test(file));
      if (!valid) return { pointer: pointer(p, "file") };
    }
    if (n.kind === "section" && typeof n.title !== "string") return { pointer: pointer(p, "title") };
    for (const key of ["file", "title", "text"]) if (n[key] !== void 0 && typeof n[key] !== "string") return { pointer: pointer(p, key) };
  }
  if (message === "\u767D\u677F\u8FDE\u7EBF\u6570\u636E\u4E0D\u5B8C\u6574") {
    const nodeIds = new Set(nodes.filter(record2).map((n) => n.id)), seen = /* @__PURE__ */ new Map(), edges = Array.isArray(raw.edges) ? raw.edges : [];
    for (let i = 0; i < edges.length; i++) {
      const e = edges[i], p = pointer(pointer(base, "edges"), i);
      if (!record2(e)) return { pointer: p };
      if (typeof e.id !== "string" || !e.id.trim()) return { pointer: pointer(p, "id") };
      if (seen.has(e.id)) return { pointer: pointer(p, "id"), relatedPointers: [pointer(pointer(pointer(base, "edges"), seen.get(e.id)), "id")] };
      seen.set(e.id, i);
      if (typeof e.from !== "string" || !nodeIds.has(e.from)) return { pointer: pointer(p, "from") };
      if (typeof e.to !== "string" || !nodeIds.has(e.to) || e.from === e.to) return { pointer: pointer(p, "to") };
      if (typeof e.label !== "string") return { pointer: pointer(p, "label") };
    }
  }
  if (message === "\u767D\u677F\u89C6\u53E3\u6570\u636E\u4E0D\u5B8C\u6574") {
    const vp = raw.viewport, p = pointer(base, "viewport");
    if (!record2(vp)) return { pointer: p };
    for (const key of ["x", "y", "zoom"]) if (!finite2(vp[key])) return { pointer: pointer(p, key) };
    return { pointer: pointer(p, "zoom") };
  }
  const objects = { "\u8111\u56FE\u767D\u677F\u72B6\u6001\u65E0\u6548": "brain", "\u8111\u56FE\u9605\u8BFB\u4F4D\u7F6E\u6570\u636E\u65E0\u6548": "brainReadingPositions", "\u8111\u56FE\u767D\u677F\u89C6\u53E3\u65E0\u6548": "brainViewport", "\u767D\u677F\u5C55\u793A\u6A21\u5F0F\u65E0\u6548": "presentation", "\u8FDE\u7EBF\u6837\u5F0F\u4E0D\u5B8C\u6574": "edges", "\u5206\u652F\u7AEF\u70B9\u5FC5\u987B\u5B58\u5728\uFF0C\u6BCF\u4E2A\u5BF9\u8C61\u53EA\u80FD\u6709\u4E00\u4E2A\u7236\u7EA7": "edges", "\u5BFC\u56FE\u5206\u652F\u4E0D\u80FD\u5F62\u6210\u5FAA\u73AF": "edges", "\u5206\u7EC4\u7236\u5B50\u5173\u7CFB\u4E0E\u5305\u542B\u5173\u7CFB\u4E0D\u80FD\u5F62\u6210\u5FAA\u73AF": "edges" };
  return { pointer: objects[message] ? pointer(base, objects[message]) : base };
}
function normalizationDiagnostics(raw, normalized, base) {
  const pending = [{ before: raw, after: normalized, path: base }], diagnostics = [];
  let count = 0;
  while (pending.length) {
    const entry = pending.pop();
    if (Object.is(entry.before, entry.after)) continue;
    if (record2(entry.before) && record2(entry.after)) {
      for (const key of /* @__PURE__ */ new Set([...Object.keys(entry.before), ...Object.keys(entry.after)])) {
        if (Object.hasOwn(entry.before, key) !== Object.hasOwn(entry.after, key)) {
          count++;
          if (diagnostics.length < 100) diagnostics.push({ severity: "normalized", code: "parser-normalization", message: "\u771F\u5B9E\u89E3\u6790\u5668\u65B0\u589E\u6216\u79FB\u9664\u4E86\u6B64\u5B57\u6BB5", pointer: pointer(entry.path, key) });
        } else pending.push({ before: entry.before[key], after: entry.after[key], path: pointer(entry.path, key) });
      }
      continue;
    }
    if (Array.isArray(entry.before) && Array.isArray(entry.after) && entry.before.length === entry.after.length) {
      for (let i = entry.before.length - 1; i >= 0; i--) pending.push({ before: entry.before[i], after: entry.after[i], path: pointer(entry.path, i) });
      continue;
    }
    count++;
    if (diagnostics.length < 100) diagnostics.push({ severity: "normalized", code: "parser-normalization", message: "\u771F\u5B9E\u89E3\u6790\u5668\u5F52\u4E00\u5316\u4E86\u6B64\u503C\uFF1B\u8F93\u5165\u6587\u4EF6\u672A\u6539\u5199", pointer: entry.path });
  }
  return { diagnostics, count };
}
function recoverableBrainDiagnostics(board, base) {
  const available = new Set(board.nodes.filter(supportsBoardMindmapTarget).map((n) => n.id)), diagnostics = [];
  const check = (id, p) => {
    if (!available.has(id)) diagnostics.push({ severity: "recoverable", code: "brain-reference-unavailable", message: "\u4FDD\u5B58\u7684\u8111\u56FE\u5F15\u7528\u5DF2\u7F3A\u5931\u6216\u76EE\u6807\u4E0D\u518D\u652F\u6301\uFF1B\u771F\u5B9E\u89E3\u6790\u5668\u5141\u8BB8\u4FDD\u7559\uFF0C\u5DE5\u5177\u6CA1\u6709\u6062\u590D\u6216\u5220\u9664\u8BE5\u72B6\u6001", pointer: p });
  };
  const state = (brain, p) => {
    if (brain.centerId !== void 0) check(brain.centerId, pointer(p, "centerId"));
    for (const key of ["expandedIds", "pins"]) brain[key].forEach((id, i) => check(id, pointer(pointer(p, key), i)));
    brain.history.entries.forEach((id, i) => check(id, pointer(pointer(pointer(p, "history"), "entries"), i)));
  };
  if (board.brain) state(board.brain, pointer(base, "brain"));
  board.nodes.forEach((n, i) => {
    if (n.mindmap) state(n.mindmap, pointer(pointer(pointer(base, "nodes"), i), "mindmap"));
  });
  board.brainReadingPositions?.forEach((position, i) => {
    const p = pointer(pointer(base, "brainReadingPositions"), i);
    check(position.centerId, pointer(p, "centerId"));
    position.expandedIds.forEach((id, j) => check(id, pointer(pointer(p, "expandedIds"), j)));
  });
  return diagnostics;
}

// tools/board-tool/references.ts
import { promises as fs2 } from "node:fs";
import path2 from "node:path";

// tools/board-tool/safe-files.ts
import { constants } from "node:fs";
import * as fs from "node:fs/promises";
import path from "node:path";
async function assertNoSymlinks(input, allowMissingLeaf = false) {
  const absolute = path.resolve(input), parsed = path.parse(absolute);
  let current = parsed.root;
  const parts = absolute.slice(parsed.root.length).split(path.sep).filter(Boolean);
  for (let i = 0; i < parts.length; i++) {
    current = path.join(current, parts[i]);
    let info;
    try {
      info = await fs.lstat(current);
    } catch (error) {
      if (allowMissingLeaf && i === parts.length - 1 && error instanceof Error && "code" in error && error.code === "ENOENT") return absolute;
      throw error;
    }
    if (info.isSymbolicLink()) throw Error(`\u62D2\u7EDD\u7B26\u53F7\u94FE\u63A5\u8DEF\u5F84\uFF1A${current}`);
    if (i < parts.length - 1 && !info.isDirectory()) throw Error(`\u8DEF\u5F84\u7236\u7EA7\u4E0D\u662F\u76EE\u5F55\uFF1A${current}`);
  }
  return absolute;
}
async function readLocalFile(input) {
  const absolute = await assertNoSymlinks(input), before = await fs.lstat(absolute);
  if (!before.isFile()) throw Error("\u8F93\u5165\u8DEF\u5F84\u4E0D\u662F\u666E\u901A\u6587\u4EF6");
  const handle = await fs.open(absolute, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const opened = await handle.stat();
    await assertNoSymlinks(absolute);
    const current = await fs.lstat(absolute);
    if (!opened.isFile() || opened.dev !== current.dev || opened.ino !== current.ino) throw Error("\u8BFB\u53D6\u524D\u6587\u4EF6\u8EAB\u4EFD\u5DF2\u53D8\u5316");
    const text = await handle.readFile("utf8"), after = await handle.stat();
    await assertNoSymlinks(absolute);
    const final = await fs.lstat(absolute);
    if (opened.dev !== final.dev || opened.ino !== final.ino || after.size !== opened.size || after.mtimeMs !== opened.mtimeMs || final.size !== after.size || final.mtimeMs !== after.mtimeMs) throw Error("\u8BFB\u53D6\u671F\u95F4\u6587\u4EF6\u5DF2\u53D8\u5316");
    return text;
  } finally {
    await handle.close();
  }
}
async function referencePath(root, target) {
  if (!target || target.trim() !== target || /[\\\u0000-\u001f\u007f]/.test(target) || path.isAbsolute(target) || /^[a-z][a-z\d+.-]*:/i.test(target) || target.split("/").some((part) => !part || part === "." || part === "..")) throw Error("\u5F15\u7528\u5FC5\u987B\u4E3A\u6839\u76EE\u5F55\u5185\u7684\u4ED3\u5E93\u76F8\u5BF9\u8DEF\u5F84");
  const absoluteRoot = await assertNoSymlinks(root), rootInfo = await fs.lstat(absoluteRoot);
  if (!rootInfo.isDirectory()) throw Error("vault-root \u4E0D\u662F\u76EE\u5F55");
  const absolute = path.resolve(absoluteRoot, ...target.split("/")), relative = path.relative(absoluteRoot, absolute);
  if (!relative || relative.startsWith(".." + path.sep) || relative === ".." || path.isAbsolute(relative)) throw Error("\u5F15\u7528\u8DEF\u5F84\u9003\u9038 vault-root");
  await assertNoSymlinks(absolute);
  const info = await fs.lstat(absolute);
  if (!info.isFile()) throw Error("\u5F15\u7528\u76EE\u6807\u4E0D\u662F\u666E\u901A\u6587\u4EF6");
  const realRoot = await fs.realpath(absoluteRoot), real = await fs.realpath(absolute);
  if (real !== absolute || realRoot !== absoluteRoot || !real.startsWith(realRoot + path.sep)) throw Error("\u5F15\u7528\u8DEF\u5F84\u8EAB\u4EFD\u6216\u6839\u76EE\u5F55\u5DF2\u53D8\u5316");
  return absolute;
}
async function writeNewFile(input, source) {
  const absolute = await assertNoSymlinks(input, true), parent = path.dirname(absolute), parentInfo = await fs.lstat(parent);
  if (!parentInfo.isDirectory()) throw Error("\u8F93\u51FA\u7236\u7EA7\u4E0D\u662F\u76EE\u5F55");
  const handle = await fs.open(absolute, "wx", 384);
  let completed = false, failed = false, failure;
  try {
    await assertNoSymlinks(parent);
    const stat2 = await handle.stat(), current = await fs.lstat(absolute);
    if (stat2.dev !== current.dev || stat2.ino !== current.ino || current.isSymbolicLink()) throw Error("\u8F93\u51FA\u6587\u4EF6\u8EAB\u4EFD\u5DF2\u53D8\u5316");
    await handle.writeFile(source, "utf8");
    await handle.sync();
    await assertNoSymlinks(parent);
    const final = await fs.lstat(absolute);
    if (final.isSymbolicLink() || stat2.dev !== final.dev || stat2.ino !== final.ino) throw Error("\u8F93\u51FA\u671F\u95F4\u6587\u4EF6\u8EAB\u4EFD\u5DF2\u53D8\u5316");
    completed = true;
  } catch (error) {
    failed = true;
    failure = error;
  }
  const stat = await handle.stat().catch(() => void 0);
  try {
    await handle.close();
  } catch (error) {
    completed = false;
    if (!failed) {
      failed = true;
      failure = error;
    }
  }
  try {
    if (!completed && stat) {
      const safe = await assertNoSymlinks(parent).then(() => true, () => false);
      const current = safe ? await fs.lstat(absolute).catch(() => void 0) : void 0;
      if (current && !current.isSymbolicLink() && stat.dev === current.dev && stat.ino === current.ino) await fs.unlink(absolute);
    }
  } catch (error) {
    failed = true;
    failure = new Error("\u65B0\u8F93\u51FA\u672A\u80FD\u5B89\u5168\u6E05\u7406\uFF1B\u8BF7\u6838\u5BF9\u62A5\u544A\u8DEF\u5F84\uFF0C\u5DE5\u5177\u6CA1\u6709\u8986\u76D6\u5176\u4ED6\u6587\u4EF6", { cause: error });
  }
  if (failed) throw failure;
}

// tools/board-tool/references.ts
var limitations = [
  "Checks structured direct references only; child boards are parsed once, without recursively checking their references or cross-board cycles.",
  "Ordinary note and attachment checks establish regular-file existence only; no codecs, PDF pages, timestamps, anchors, capture IDs or remote resources are resolved.",
  "Markdown inline links and references hidden in opaque unknown fields are not resolved. This report does not certify the whole vault or a concurrent future state."
];
function collect(board, base) {
  const refs = [];
  board.nodes.forEach((node, i) => {
    const np = pointer(pointer(base, "nodes"), i), add = (kind, target, keys2, extra = {}) => refs.push({ kind, target, pointer: (typeof keys2 === "string" ? [keys2] : keys2).reduce(pointer, np), ...extra });
    if (node.file !== void 0 && ["card", "board", "image", "pdf", "audio", "video"].includes(node.kind)) add(node.kind, node.file, "file", { child: node.kind === "board", ...node.kind === "pdf" && node.pdfPage !== void 0 ? { semantic: "PDF page existence is not checked." } : {}, ...(node.kind === "audio" || node.kind === "video") && node.mediaStart !== void 0 ? { semantic: "Media timestamp is not checked." } : {} });
    if (node.paragraphQuote) add("paragraph", node.paragraphQuote.path, ["paragraphQuote", "path"], { semantic: "Paragraph selection/hash and native heading/block anchors are not checked." });
    if (node.pdfQuote) add("pdf-quote", node.pdfQuote.sourcePath, ["pdfQuote", "sourcePath"], { semantic: "PDF quote text, pages and coordinates are not checked." });
    if (node.videoCapture) add("video-capture", node.videoCapture.note, ["videoCapture", "note"], { semantic: "Capture ID within the note is not checked." });
    if (node.webUrl) add("web", node.webUrl, "webUrl", { remote: true });
    if (node.imageUrl) add("remote-image", node.imageUrl, "imageUrl", { remote: true });
    if (node.text && /\[\[[^\]\r\n]+\]\]|\]\([^)\r\n]+\)/.test(node.text)) add("inline-markdown", "Inline Markdown destinations", "text", { remote: true, semantic: "Inline Markdown destinations are not resolved." });
  });
  if (board.background?.backgroundImagePath) refs.push({ kind: "background-image", target: board.background.backgroundImagePath, pointer: pointer(pointer(base, "background"), "backgroundImagePath") });
  if (board.writing?.draftPath) refs.push({ kind: "writing-draft", target: board.writing.draftPath, pointer: pointer(pointer(base, "writing"), "draftPath") });
  return refs;
}
async function checkReferences(board, base, options) {
  const refs = collect(board, base), details = [];
  let root;
  if (options.vaultRoot !== void 0) {
    try {
      if (!options.vaultRoot.trim()) throw Error("vault-root must be an explicit nonempty directory");
      root = await assertNoSymlinks(options.vaultRoot);
      if (!(await fs2.lstat(root)).isDirectory()) throw Error("vault-root is not a directory");
    } catch (error) {
      return { status: "failed", totalCount: refs.length, checkedCount: 0, details: [{ kind: "vault-root", target: options.vaultRoot, pointer: base, status: "failed", message: String(error) }], limitations };
    }
  }
  for (const ref of refs) {
    const detail = { kind: ref.kind, target: ref.target, pointer: ref.pointer };
    if (ref.remote) {
      details.push({ ...detail, status: "not_checked", message: ref.semantic || "Remote resource is not checked; no network request is made." });
      continue;
    }
    if (root === void 0) {
      details.push({ ...detail, status: "not_checked", message: "Provide an explicit --vault-root to check this direct reference." });
      continue;
    }
    try {
      const target = await referencePath(root, ref.target);
      let semantic = ref.semantic;
      if (ref.child) {
        const child = readBoardDocument(await readLocalFile(target), path2.extname(target), load);
        if (collect(child.board, "").length) semantic = "Direct child document passed the real parser, but its known references remain unchecked. No recursive reads are performed.";
      }
      details.push({ ...detail, status: semantic ? "not_checked" : "checked", message: semantic ? "Regular file exists. " + semantic : ref.child ? "Direct child document passed the real parser and has no known references detected; unknown opaque references are not resolved." : "Regular file exists; content semantics are outside this check." });
    } catch (error) {
      details.push({ ...detail, status: "failed", message: String(error) });
    }
  }
  const failed = details.some((detail) => detail.status === "failed"), unchecked = details.some((detail) => detail.status === "not_checked");
  return { status: failed ? "failed" : unchecked ? "not_checked" : refs.length ? "checked" : "not_applicable", totalCount: refs.length, checkedCount: details.filter((detail) => detail.status === "checked").length, details, limitations };
}

// tools/board-tool/types.ts
var TOOL_VERSION = "1.0.0-local";

// tools/board-tool/index.ts
function failureReport(command, code, error, pointer2 = null) {
  return { toolVersion: TOOL_VERSION, command, overall: "failed", format: { status: "failed" }, references: { status: "not_checked", totalCount: 0, checkedCount: 0, details: [], limitations: ["Format or file access failed before reference checking."] }, diagnostics: [{ severity: "error", code, message: error instanceof Error ? error.message : String(error), pointer: pointer2, cause: causeText(error) }] };
}
function originalBoard(source, extension) {
  try {
    if (extension.toLowerCase().replace(/^\./, "") === "thoughtspace") return JSON.parse(source.replace(/^\uFEFF/, ""));
    const zone = /^[ \t]*<!-- thoughtspace-board-layout:start -->[ \t]*\r?\n[ \t]*```json[ \t]*\r?\n([\s\S]*?)\r?\n[ \t]*```[ \t]*\r?\n[ \t]*<!-- thoughtspace-board-layout:end -->[ \t]*(?:\r?\n|$)/m.exec(source);
    if (!zone) return void 0;
    const envelope = JSON.parse(zone[1]);
    return record2(envelope) ? envelope.board : void 0;
  } catch {
    return void 0;
  }
}
async function validateSource(source, extension, options = {}) {
  const base = extension.toLowerCase().replace(/^\./, "") === "md" ? "/board" : "", raw = originalBoard(source, extension);
  let document;
  try {
    document = readBoardDocument(source, extension, load);
  } catch (error) {
    const code = error instanceof BoardDocumentError ? error.code : "parser-error", report2 = failureReport("validate", code, error, error instanceof BoardDocumentError && error.code === "board-invalid" ? base : null);
    if (error instanceof BoardDocumentError && error.code === "board-invalid") Object.assign(report2.diagnostics[0], boardErrorLocation(raw, base, deepestMessage(error)));
    return { report: report2 };
  }
  const board = document.board, normalized = normalizationDiagnostics(originalBoard(document.layoutSource, extension), board, base), references = await checkReferences(board, base, options);
  const report = { toolVersion: TOOL_VERSION, command: "validate", overall: references.status === "failed" ? "failed" : references.status === "not_checked" ? "format_only" : "passed", format: { status: "passed", document: document.format, ...document.format === "markdown" ? { envelopeVersion: 1 } : {}, boardVersion: board.version, presentation: board.presentation || "ordinary" }, references, diagnostics: [...normalized.diagnostics, ...recoverableBrainDiagnostics(board, base)], normalizationCount: normalized.count, summary: { nodes: board.nodes.length, edges: board.edges.length, strokes: board.ink?.strokes.length || 0, points: board.ink?.strokes.reduce((sum, stroke) => sum + stroke.points.length, 0) || 0 } };
  for (const detail of references.details) if (detail.status === "failed") report.diagnostics.push({ severity: "error", code: "reference-failed", pointer: detail.pointer, message: detail.message });
  return { report, board };
}
async function validateFile(filePath, options = {}) {
  try {
    const result = await validateSource(await readLocalFile(filePath), path3.extname(filePath), options);
    result.report.path = path3.resolve(filePath);
    return result;
  } catch (error) {
    return { report: { ...failureReport("validate", "file-read-failed", error), path: path3.resolve(filePath) } };
  }
}
async function inspectFile(filePath, options = {}) {
  const result = await validateFile(filePath, options);
  result.report.command = "inspect";
  return result;
}
function template(kind) {
  const board = emptyBoard();
  board.version = 3;
  if (kind === "brain") {
    board.presentation = "brain";
    board.brain = { version: 1, expandedIds: [], pins: [], history: { entries: [], index: -1 } };
  }
  if (kind === "ink") {
    board.presentation = "handwriting";
    board.ink = { version: 1, strokes: [] };
  }
  return board;
}
async function createFile(kind, outputPath, options = {}) {
  const fail = (code, error) => ({ report: { ...failureReport("create", code, error), path: path3.resolve(outputPath), created: false } });
  try {
    if (!["ordinary", "brain", "ink"].includes(kind)) return fail("invalid-kind", Error("create kind must be ordinary, brain or ink"));
    const extension = path3.extname(outputPath).toLowerCase(), format = options.format || (extension === ".thoughtspace" ? "legacy" : "markdown");
    if (!["markdown", "legacy"].includes(format) || extension !== (format === "legacy" ? ".thoughtspace" : ".md")) return fail("invalid-output-format", Error("Output must be .md for markdown or .thoughtspace for legacy"));
    const input = options.boardJsonPath !== void 0 ? await readLocalFile(options.boardJsonPath) : JSON.stringify(template(kind)), validated = await validateSource(input, "thoughtspace", options);
    if (!validated.board || validated.report.overall === "failed") {
      validated.report.command = "create";
      validated.report.created = false;
      validated.report.path = path3.resolve(outputPath);
      return validated;
    }
    const board = validated.board, expected = kind === "ink" ? "handwriting" : kind === "brain" ? "brain" : void 0;
    if (board.presentation !== expected) return fail("kind-mismatch", Error("Input Board presentation does not match requested create kind"));
    const source = format === "legacy" ? JSON.stringify(board, null, 2) : createMarkdownBoardDocument(board, options.title || "ThoughtSpace \u767D\u677F"), result = await validateSource(source, extension, options);
    result.report.command = "create";
    result.report.path = path3.resolve(outputPath);
    result.report.created = false;
    if (result.report.overall === "failed") return result;
    if (validated.report.normalizationCount) {
      result.report.diagnostics.unshift(...validated.report.diagnostics.filter((issue) => issue.severity === "normalized"));
      result.report.normalizationCount = validated.report.normalizationCount;
    }
    const serialized = normalizationDiagnostics(board, result.board, format === "markdown" ? "/board" : "");
    if (serialized.count) {
      result.report.diagnostics.unshift(...serialized.diagnostics.map((issue) => ({ ...issue, code: "serialization-normalization", message: "\u751F\u6210\u5E8F\u5217\u5316\u6539\u53D8\u4E86\u6B64\u503C\uFF08\u5982\u8D1F\u96F6\u6216\u672A\u77E5\u975E\u6709\u9650\u6570\uFF09\uFF1B\u539F\u8F93\u5165\u6587\u4EF6\u672A\u6539\u5199" })));
      result.report.normalizationCount = (result.report.normalizationCount || 0) + serialized.count;
    }
    try {
      await writeNewFile(outputPath, source);
      result.report.created = true;
    } catch (error) {
      result.report.overall = "failed";
      result.report.diagnostics.push({ severity: "error", code: "file-create-failed", pointer: null, message: error instanceof Error ? error.message : String(error), cause: causeText(error) });
    }
    return result;
  } catch (error) {
    return fail("create-failed", error);
  }
}
export {
  TOOL_VERSION,
  createFile,
  failureReport,
  inspectFile,
  validateFile,
  validateSource
};
