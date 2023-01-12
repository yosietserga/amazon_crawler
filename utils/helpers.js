var chalk = require("cli-color");

const getParamsFromURI = (uri) => {
    const url = new URL(uri, baseUrl);
    return url.searchParams;
};

function mt_rand(mi, ma) {
    const min = mi ?? 5;
    const max = ma ?? 50;
    return parseInt(Math.floor(Math.random() * (max - min) + min));
}

//logging with filename, linenumber and colors to a better syntax info
Object.defineProperty(global, "__stack", {
    get: function () {
        var orig = Error.prepareStackTrace;
        Error.prepareStackTrace = function (_, stack) {
            return stack;
        };
        var err = new Error();
        Error.captureStackTrace(err, arguments.callee);
        var stack = err.stack;
        Error.prepareStackTrace = orig;
        return stack;
    }
});

//prototyping to get line number from caller stack
Object.defineProperty(global, "__line", {
    get: function () {
        return __stack[2]?.getLineNumber();
    }
});

//prototyping to get function name from caller stack
Object.defineProperty(global, "__function", {
    get: function () {
        return __stack[2]?.getFunctionName() || __stack[2]?.getMethodName();
    }
});

//prototyping to get file name from caller stack
Object.defineProperty(global, "__file", {
    get: function () {
        return __stack[2]?.getFileName();
    }
});

async function log(msg, level, __index) {
    let x = {};
    if (parseInt(__index) > 0) {
        x.__file = __stack[__index].getFileName();
        x.__line = __stack[__index].getLineNumber();
        x.__function =
            __stack[__index].getFunctionName() ||
            __stack[__index].getMethodName();
    } else {
        x.__file = __file;
        x.__line = __line;
        x.__function = __function;
    }
    let separator = __dirname.indexOf("/") == -1 ? "\\" : "/";
    let basedir = __dirname.replace("src", "");
    let file = x.__file?.replace(basedir, "." + separator);
    let lvl =
        level == "error"
            ? chalk.red.bold("  ERROR  ")
            : level == "warning"
            ? chalk.bgXterm(214)("  WARNING  ")
            : "";

    if (level == "raw") console.log(msg);
    else if (typeof msg == "object") {
        console.log(
            `${lvl}${chalk.bgGreen("  " + file + ":")}${chalk.bgGreen.bold(
                x.__line + "  "
            )}${chalk.bgCyan.bold(
                "  fn:" + (x.__function ?? "unknown") + "  "
            )} `
        );
        console.log(msg);
    } else
        console.log(
            `${lvl}${chalk.bgGreen("  " + file + ":")}${chalk.bgGreen.bold(
                x.__line + "  "
            )}${chalk.bgCyan.bold(
                "  fn:" + (x.__function ?? "unknown") + "  "
            )} ${chalk.xterm(214)(`${msg}`)} `
        );
}

function empty(mixedVar) {
    let undef;
    let key;
    let i;
    let len;
    const emptyValues = [undef, null, false, 0, "", "0"];
    for (i = 0, len = emptyValues.length; i < len; i++) {
        if (mixedVar === emptyValues[i]) {
            return true;
        }
    }
    if (typeof mixedVar === "object") {
        for (key in mixedVar) {
            if (mixedVar.hasOwnProperty(key)) {
                return false;
            }
        }
        return true;
    }
    return false;
}

function isset() {
    const a = arguments;
    const l = a.length;
    let i = 0;
    let undef;
    if (l === 0) {
        throw new Error("Empty isset");
    }
    while (i !== l) {
        if (a[i] === undef || a[i] === null) {
            return false;
        }
        i++;
    }
    return true;
}
function ucfirst(str) {
    str += "";
    const f = str.charAt(0).toUpperCase();
    return f + str.substr(1);
}

function ucfsplit(str) {
    return ucfirst(
        ucfirst(str.split("_").join(" "))
            .match(/[A-Z]+(?![a-z])|[A-Z]?[a-z]+|\d+/g)
            .join(" ")
    );
}

function unique(value, index, self) {
    return self.indexOf(value) === index;
}

function isPrimitive(test) {
    return test !== Object(test);
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

//init cookie var just when is in browser
if (typeof window != "undefined") setCookie("init", 1);

const d = {
    mt_rand,
    unique,
    isset,
    empty,
    log,
    isPrimitive,
    delay,
    ucfirst,
    ucfsplit,
    getParamsFromURI
};

module.exports = d;
