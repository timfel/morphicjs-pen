(function () {
    "use strict";

    function no_history() {
        return "no history";
    }

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

    Morph.prototype["Make shape into Morph"] = function () {
        var strokes = CurrentLiteralStrokeData[0],
            inkpoints = CurrentLiteralStrokeData[1];
        
        var m = new Morph();
        m.isDraggable = true;
        m.isEditable = true;
        m.noticesTransparentClick = true;
        var bounds = getStrokeBounds(strokes);
        var topLeft = bounds.topLeft();
        var extentPoint = bounds.extent();
        m.color = new Color(0, 0, 0, 0);
        m.setPosition(topLeft);
        m.setExtent(extentPoint);
        m.drawNew = function () {
            var canvas, ext;
            ext = extentPoint;
            canvas = document.createElement('canvas');
            canvas.width = ext.x;
            canvas.height = ext.y;
            this.image = canvas;
            var context = this.image.getContext('2d');
            context.fillStyle = this.color.toString();
            context.fillRect(0, 0, this.width(), this.height());

            strokes.forEach((stroke) => {
                renderStroke(stroke, "black", stroke.drawingAttributes.size.width, context);
            });
            function renderStroke(stroke, color, width, ctx) {
                ctx.save();
                ctx.beginPath();
                ctx.strokeStyle = color;
                ctx.lineWidth = width;
                var first = true;
                stroke.getRenderingSegments().forEach((segment) => {
                    if (first) {
                        ctx.moveTo(segment.position.x - topLeft.x, segment.position.y - topLeft.y);
                        first = false;
                    } else {
                        ctx.bezierCurveTo(segment.bezierControlPoint1.x - topLeft.x, segment.bezierControlPoint1.y - topLeft.y,
                                            segment.bezierControlPoint2.x - topLeft.x, segment.bezierControlPoint2.y - topLeft.y,
                                            segment.position.x - topLeft.x, segment.position.y - topLeft.y);
                    }
                });
                ctx.stroke();
                ctx.closePath();
                ctx.restore();
            }
            if (this.cachedTexture) {
                this.drawCachedTexture();
            } else if (this.texture) {
                this.drawTexture(this.texture);
            }
        }.bind(m);

        this.root().add(m);
        m.changed();
        m.drawNew();
        m.changed();

        function getStrokeBounds(strokes) {
            var x1 = Number.MAX_SAFE_INTEGER, y1 = Number.MAX_SAFE_INTEGER, x2 = 0, y2 = 0;
            strokes.forEach((stroke) => {
                if (stroke.boundingRect.x < x1) {
                    x1 = stroke.boundingRect.x;
                }
                if (stroke.boundingRect.y < y1) {
                    y1 = stroke.boundingRect.y;
                }
                if (stroke.boundingRect.x + stroke.boundingRect.width > x2) {
                    x2 = stroke.boundingRect.x + stroke.boundingRect.width;
                }
                if (stroke.boundingRect.y + stroke.boundingRect.height > y2) {
                    y2 = stroke.boundingRect.y + stroke.boundingRect.height;
                }
            });
            return new Rectangle(x1, y1, x2, y2);
        }
    }

    // Here come the functions for responding to pen input - respondToPossibleText, findFunctionCandidates, fillHelpMeu
    Morph.prototype.respondToPossibleText = function (textCandidates, strokeBounds, thenCb, startPt, endPt) {
        var myFunctions = this.findFunctionCandidates(textCandidates, strokeBounds);
        if (textCandidates.indexOf("squiggle") >= 0) {
            myFunctions = myFunctions.concat(this.proposeConnectionTo(this.root().topMorphAt(endPt), thenCb));
        }
        var menu = this.fillHelpMenu(myFunctions, thenCb);
        menu.popup(this.root(), this.root().bottomLeft().subtract(new Point(0, menu.height())));
    }

    Morph.prototype.proposeConnectionTo = function (anotherMorph, thenDo) {
        return [[
            () => {
                var m1, m2, cancelCb = () => {
                    m1.destroy();
                    m2.destroy();
                    thenDo();
                }
                var eventName, fun, clickFunc;

                var m1 = new MenuMorph(null, 'Which event should we react to?'),
                    events = ["mouseClickLeft", "mouseClickRight"];
                events.forEach((n) => {
                    m1.addItem(n, () => {
                        eventName = n;
                        clickFunc();
                    });
                });
                m1.addLine();
                m1.addItem("Cancel", cancelCb);
                m1.isListContents = true;
                m1.popup(this, this.bottomLeft());

                var m2 = new MenuMorph(null, 'Which function should we trigger?'),
                    funcs = _.functions(anotherMorph).filter((funcName) => {
                        return getParamNames(anotherMorph[funcName]).length === 0;
                    });
                funcs.forEach((n) => {
                    m2.addItem(n, () => {
                        fun = () => { anotherMorph[n]() };
                        clickFunc();
                    });
                });
                m2.addLine();
                m2.addItem("... or drop some code tile here ...", () => { });
                m2.addLine();
                m2.addItem("Cancel", cancelCb);
                m2.isListContents = true
                m2.wantsDropOf = function (aMorph) {
                    if (typeof (aMorph.getMessage) == "function") {
                        var text = aMorph.getMessage(),
                            dropItem = this.children[this.children.length - 3];
                        dropItem.labelString = text;
                        dropItem.createLabel();
                        fun = () => {
                            eval("anotherMorph." + text);
                        }
                        clickFunc();
                        dropItem.mouseDownLeft();
                        dropItem.mouseClickLeft();
                        setTimeout(() => { aMorph.destroy(); }, 100);
                    }
                }
                if (this === anotherMorph) {
                    m2.popup(m1, anotherMorph.bottomRight().add(new Point(m2.width(), 0)));
                } else {
                    m2.popup(anotherMorph, anotherMorph.bottomLeft());
                }

                clickFunc = () => {
                    clickFunc = () => {
                        clickFunc = () => { };
                        var doIt = new MenuMorph(null, "");
                        doIt.addItem("Connect!", () => {
                            var prevEvent = this[eventName];
                            this[eventName] = () => {
                                fun();
                                if (prevEvent) prevEvent();
                            }
                            m1.destroy();
                            m2.destroy();
                            thenDo();
                        });
                        doIt.popup(this.root(), this.root().bottomLeft().subtract(new Point(0, doIt.height())));
                    };
                };

                return no_history();
            },
            "Connect ..."
        ]]
    }

    Morph.prototype.findFunctionCandidates = function (textCandidates, strokeBounds) {
        return _.flatten(textCandidates.map((text) => {
            var funcNames = fuzzyMatchesFromList(text, _.functions(this)),
                functions = funcNames.map((n) => {
                    return [this.makeFunctionFor(n), n]
                });
            // functions.push([() => { eval("this." + text) }, text]);
            return functions;
        }), true);
    }

    Morph.prototype.makeFunctionFor = function (funcName, isConstructor, rcvr) {
        rcvr = rcvr || this;
        var names = getParamNames(rcvr[funcName]);
        if (names.length === 0) {
            // simple case, just call
            return (() => {
                return {
                    text: funcName + "()",
                    value: (isConstructor ? new rcvr[funcName]() : rcvr[funcName]())
                }
            });
        } else {
            // ask for parameters
            return (() => {
                var pos = this.position();
                var callM = new ParameterCallMorph(rcvr, isConstructor ? "new " + funcName : funcName);
                callM.setPosition(pos);
                pos = pos.add(new Point(callM.width() + 8, 0));
                names.forEach((s) => {
                    var m = new ParameterQuestionMorph(s);
                    m.setPosition(pos);
                    pos = pos.add(new Point(m.width() + 8, 0));
                    callM.add(m);
                });
                callM.openInWorld(this.root());
                return no_history();
            });
        }
    }

    Morph.prototype.fillHelpMenu = function (functionList, thenDo) {
        var m = new MenuMorph(null, ''),
            names = [];
        functionList.forEach((funcAndText) => {
            if (names.indexOf(funcAndText[1]) < 0) {
                m.addItem(funcAndText[1], () => {
                    var result = funcAndText[0]();
                    if (result !== no_history()) {
                        var hmorph = new HistoryMorph(
                            '"' + funcAndText[1] + '" → ' + result.text + " = `" + result.value + "'",
                            result.text,
                            funcAndText[0]
                        );
                        this.root().sidePane.add(hmorph);
                        hmorph.stickToTop();
                    }
                    thenDo();
                });
                names.push(funcAndText[1]);
            }
        });
        return m;
    }

    // these morphs track the history of executions
    var HistoryMorph;
    HistoryMorph.prototype = new TextMorph();
    HistoryMorph.prototype.constructor = HistoryMorph;
    HistoryMorph.uber = TextMorph.prototype;
    function HistoryMorph(string, message, func) {
        this.init(string, message, func);
    }
    HistoryMorph.prototype.init = function (string, message, func) {
        this.func = func;
        this.message = message;
        HistoryMorph.uber.init.call(this, string, 22);
        this.backgroundColor = new Color(200, 200, 200, 128);
        this.changed();
        this.drawNew();
        this.changed();
        this.isTemplate = true;
    }
    HistoryMorph.prototype.getMessage = function () {
        return this.message;
    }
    HistoryMorph.prototype.stickToTop = function () {
        this.setPosition(this.parent.children.reduce((previous, current) => {
            if (current !== this) {
                return current.bottomLeft().max(previous);
            } else {
                return previous;
            }
        }, this.parent.topLeft()).add(new Point(0, 2)));
    }
    HistoryMorph.prototype.mouseClickLeft = function () {
        this.func();
    }
    HistoryMorph.prototype.findFunctionCandidates = function (textCandidates, strokeBounds) {
        var results = [];
        if (textCandidates.find((txt) => { return txt === "T" || txt === "tick" })) {
            results.push([() => {
                var runners = this.parent.children.filter((m) => {
                    return ((m instanceof HistoryMorph) && 
                            m.bounds.intersects(strokeBounds));
                });
                this.fps = 5;
                var idx = -1;
                this.step = () => {
                    idx = (idx + 1) % runners.length;
                    runners[idx].func();
                }
                return no_history();
            }, "Start ticking"]);
        }
        if (textCandidates.find((txt) => { return txt === "S" || txt === "stop" })) {
            results.push([() => {
                this.step = () => { };
                return no_history();
            }, "Stop ticking"]);
        }
        return results;
    }
    HistoryMorph.prototype.reactToTemplateCopy = function () {
        // when we're a copy, we also react normally (but still work for ticking/stop-ticking
        var oldFfc = this.findFunctionCandidates.bind(this);
        this.findFunctionCandidates = () => {
            var r = oldFfc.apply(this, arguments);
            return r.concat(Morph.prototype.findFunctionCandidates.apply(this, arguments));
        }
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
        this.isDraggable = true;
    }

    function ParameterQuestionMorph(string) {
        ParameterQuestionMorph.uber.init.call(this, string, 48, undefined, true);
        this.backgroundColor = (new Color(230, 230, 230, 128));
        this.isEditable = true;
    }

    ParameterCallMorph.prototype.openInWorld = function (world) {
        world.add(this);
        this.forAllChildren((child) => {
            child.changed(); child.drawNew(); child.changed();
        });
        this.changed(); this.drawNew(); this.changed();
    }

    ParameterCallMorph.prototype.getMessage = function () {
        var message = this.text + "(";
        this.children.forEach((m) => { if (m.text) message += m.text + "," });
        message = message.slice(0, message.length - 1);
        message += ")";
        return message;
    }

    ParameterCallMorph.prototype.findFunctionCandidates = function (textCandidates, strokeBounds) {
        var results = [];
        if (textCandidates.find((txt) => { return txt === "destroy" || txt === "line" })) {
            results.push([() => { this.destroy(); return no_history(); }, "Cancel"])
        }
        if (textCandidates.find((txt) => { return txt === "tickmark" })) {
            results.push([() => {
                var message = this.getMessage();
                var evalCode;
                if (message.startsWith("new ")) {
                    evalCode = message.replace("new ", "new this.target.");
                } else {
                    evalCode = "this.target." + message;
                }
                this.destroy();
                try {
                    return {
                        text: message,
                        value: eval(evalCode)
                    }
                } catch (e) {
                    world.inform("Could not eval target." + message + ".\nThe error was " + e);
                }
            }, "Run"]);
        }
        return results;
    }

    ParameterQuestionMorph.prototype.wantsDropOf = function (aMorph) {
        if (typeof(aMorph.getMessage) == "function") {
            this.text = aMorph.getMessage();
            this.changed();
            this.drawNew();
            this.changed();
            setTimeout(() => { aMorph.destroy(); }, 100);
        }
    }

    ParameterQuestionMorph.prototype.findFunctionCandidates = function (textCandidates, strokeBounds) {
        return textCandidates.map((text) => {
            return [() => {
                this.text = text;
                this.changed();
                this.drawNew();
                this.changed();
                return no_history();
            }, text]
        });
    }

    ParameterQuestionMorph.prototype.edit = function () {
        var pos = this.position();
        ParameterQuestionMorph.uber.edit.call(this);
        this.setPosition(pos.add(new Point(30, 0)));
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
            return {
                text: cls + "",
                value: m
            }
        };
        var funcList = ["rectangle", "circle", "string"].concat(_.functions(this));
        var globalClasses = _.functions(window).filter((f) => {
            return /^[A-Z]/.test(f);
        });
        var makerFunctions = [Morph, CircleBoxMorph, String].map((cls) => { return () => { return makeMorph(cls) } });

        return _.flatten(textCandidates.map((text) => {
            var funcNames = fuzzyMatchesFromList(text, funcList.concat(globalClasses)),
                functions = funcNames.map((n) => {
                    var idx = funcList.indexOf(n);
                    if (idx >= 0 && idx < makerFunctions.length) {
                        return [makerFunctions[idx], "Make new " + n]
                    } else if (globalClasses.indexOf(n) >= 0) {
                        return [this.makeFunctionFor(n, true, window), "new " + n]
                    } else {
                        return [this.makeFunctionFor(n), n];
                    }
                });
            // functions.push([() => { eval("this." + text) }, text]);
            return functions;
        }), true);
    }

    // various helpers
    function fuzzyMatchesFromList(text, list) {
        if (text.length < 2) return [];
        text = text.toLowerCase();
        return _.compact(list.map((k) => {
            if (k.toLowerCase() === text) {
                return k
            }
            if (k.length < text.length * 2 &&
                // split camelcase and underscores
                k.replace(/([a-z](?=[A-Z]))/g, '$1 ').split(/\s|_/).concat([k]).find((part) => {
                    part = part.toLowerCase();
                    return (levenshteinDistance(part.slice(0, text.replace(/\s+/g, "").length - 1), text.replace(/\s+/g, "")) < 2 ||
                            levenshteinDistance(part.slice(0, text.length - 1), text) < 2);
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

    function getParamNames(func) {
        var STRIP_COMMENTS = /((\/\/.*$)|(\/\*[\s\S]*?\*\/))/mg,
            ARGUMENT_NAMES = /([^\s,]+)/g,
            fnStr = func.toString().replace(STRIP_COMMENTS, ''),
            result = fnStr.slice(fnStr.indexOf('(') + 1, fnStr.indexOf(')')).match(ARGUMENT_NAMES);
        return result || [];
    }
})();