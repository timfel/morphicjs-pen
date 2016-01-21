(function () {
    "use strict";

    // determines if it is ok to draw over this morph
    Morph.prototype.allowsDrawingOver = function () {
        return true;
    }

    MenuMorph.prototype.allowsDrawingOver = function () {
        return false;
    }

    MenuItemMorph.prototype.allowsDrawingOver = function () {
        return false;
    }

    // convenience API
    Morph.prototype.clone = function () {
        var m = this.fullCopy();
        if (this.root()) {
            this.root().add(m);
            m.setPosition(m.position().add(30));
        }
    }

    // Here come the functions for responding to pen input - respondToPossibleText, findFunctionCandidates, fillHelpMeu
    Morph.prototype.respondToPossibleText = function (textCandidates, strokeBounds, thenCb) {
        var myFunctions = this.findFunctionCandidates(textCandidates, strokeBounds),
            menu = this.fillHelpMenu(myFunctions, thenCb);
        menu.popup(this.root(), this.root().topLeft());
    }

    Morph.prototype.findFunctionCandidates = function (textCandidates, strokeBounds) {
        return _.flatten(textCandidates.map((text) => {
            var funcNames = fuzzyMatchesFromList(text, _.functions(this)),
                functions = funcNames.map((n) => {
                    return [this.makeFunctionFor(n), n]
                });
            functions.push([() => { eval("this." + text) }, text]);
            return functions;
        }), true);
    }

    Morph.prototype.makeFunctionFor = function (funcName) {
        var names = getParamNames(this[funcName]);
        if (names.length === 0) {
            // simple case, just call
            return (() => { this[funcName]() });
        } else {
            // ask for parameters
            return (() => {
                var pos = this.position();
                var callM = new ParameterCallMorph(this, funcName);
                callM.setPosition(pos);
                pos = pos.add(new Point(callM.width() + 8, 0));
                names.forEach((s) => {
                    var m = new ParameterQuestionMorph(s);
                    m.setPosition(pos);
                    pos = pos.add(new Point(m.width() + 8, 0));
                    callM.add(m);
                });
                callM.openInWorld(this.root());
            });
        }

        function getParamNames(func) {
            var STRIP_COMMENTS = /((\/\/.*$)|(\/\*[\s\S]*?\*\/))/mg,
                ARGUMENT_NAMES = /([^\s,]+)/g,
                fnStr = func.toString().replace(STRIP_COMMENTS, ''),
                result = fnStr.slice(fnStr.indexOf('(') + 1, fnStr.indexOf(')')).match(ARGUMENT_NAMES);
            return result || [];
        }
    }

    Morph.prototype.fillHelpMenu = function (functionList, thenDo) {
        var m = new MenuMorph(null, ''),
            names = [];
        functionList.forEach((funcAndText) => {
            if (names.indexOf(funcAndText[1]) < 0) {
                m.addItem(funcAndText[1], () => {
                    funcAndText[0]();
                    thenDo();
                });
                names.push(funcAndText[1]);
            }
        });
        return m;
    }

    // these morphs draw parameterized methods
    var ParameterQuestionMorph,
        ParameterCallMorph;
    ParameterQuestionMorph.prototype = new TextMorph();
    ParameterQuestionMorph.prototype.constructor = ParameterQuestionMorph;
    ParameterQuestionMorph.uber = TextMorph.prototype;
    ParameterCallMorph.prototype = new TextMorph();
    ParameterCallMorph.prototype.constructor = ParameterCallMorph;
    ParameterCallMorph.uber = TextMorph.prototype;

    function ParameterCallMorph(target, string) {
        this.target = target;
        ParameterCallMorph.uber.init.call(this, string, 48, undefined, undefined, true);
        this.backgroundColor = (new Color(230, 230, 230, 128));
    }

    function ParameterQuestionMorph(string) {
        ParameterQuestionMorph.uber.init.call(this, string, 48, undefined, true);
        this.backgroundColor = (new Color(230, 230, 230, 128));
    }

    ParameterCallMorph.prototype.openInWorld = function (world) {
        world.add(this);
        this.forAllChildren((child) => {
            child.changed(); child.drawNew(); child.changed();
        });
        this.changed(); this.drawNew(); this.changed();
    }

    ParameterCallMorph.prototype.findFunctionCandidates = function (textCandidates, strokeBounds) {
        return [
            [() => {
                var message = this.text + "(";
                this.children.forEach((m) => { message += m.text + "," });
                message = message.slice(0, message.length - 1);
                message += ")";
                this.destroy();
                try {
                    eval("this.target." + message);
                } catch (e) {
                    world.inform("Could not eval target." + message + ".\nThe error was " + e);
                }
            }, "Run"],
            [() => {
                this.destroy();
            }, "Cancel"]
        ]
    }

    ParameterQuestionMorph.prototype.findFunctionCandidates = function (textCandidates, strokeBounds) {
        return textCandidates.map((text) => {
            return [() => {
                this.text = text;
                this.changed();
                this.drawNew();
                this.changed();
            }, text]
        });
    }

    // the world morph overrides the function candidates
    WorldMorph.prototype.findFunctionCandidates = function (textCandidates, strokeBounds) {
        var makeMorph = (cls) => {
            var m = new cls();
            m.isEditable = true;
            m.isDraggable = true;
            m.setPosition(strokeBounds.topLeft());
            m.setExtent(strokeBounds.extent());
            this.add(m);
        };
        var funcList = ["rectangle", "circle", "string"].concat(_.functions(this)),
            makerFunctions = [Morph, CircleBoxMorph, String].map((cls) => { return () => { makeMorph(cls) } });

        return _.flatten(textCandidates.map((text) => {
            var funcNames = fuzzyMatchesFromList(text, funcList),
                functions = funcNames.map((n) => {
                    var idx = funcList.indexOf(n);
                    if (idx >= 0 && idx < makerFunctions.length) {
                        return [makerFunctions[idx], "Make new " + n]
                    } else {
                        return [this.makeFunctionFor(n), n];
                    }
                });
            functions.push([() => { eval("this." + text) }, text]);
            return functions;
        }), true);
    }

    // various helpers
    function fuzzyMatchesFromList(text, list) {
        if (text.length < 2) return [];
        text = text.toLowerCase().replace(/\s+/, "");
        return _.compact(list.map((k) => {
            if (k.length < text.length * 2 &&
                // split camelcase and underscores
                k.replace(/([a-z](?=[A-Z]))/g, '$1 ').split(/\s|_/).concat([k]).find((part) => {
                    part = part.toLowerCase();
                    return levenshteinDistance(part.slice(0, text.length - 1), text) < 2;
                })) {
                return k;
            }
        })).sort();

        function levenshteinDistance(a, b) {
            if (a.length == 0) return b.length;
            if (b.length == 0) return a.length;
            var matrix = [];
            var i;
            for (i = 0; i <= b.length; i++) {
                matrix[i] = [i];
            }
            var j;
            for (j = 0; j <= a.length; j++) {
                matrix[0][j] = j;
            }
            for (i = 1; i <= b.length; i++) {
                for (j = 1; j <= a.length; j++) {
                    if (b.charAt(i - 1) == a.charAt(j - 1)) {
                        matrix[i][j] = matrix[i - 1][j - 1];
                    } else {
                        matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, // substitution
                                                Math.min(matrix[i][j - 1] + 1, // insertion
                                                         matrix[i - 1][j] + 1)); // deletion
                    }
                }
            }
            return matrix[b.length][a.length];
        };
    }
})();