(function () {
    "use strict";

    function showStrokeRecognitions(result) {
        var strokes = result.getStrokes();
        if (recognitionMenu) {
            recognitionMenu.destroy();
        }

        var target = world.topMorphAt(new Point(strokes[0].boundingRect.x, strokes[0].boundingRect.y)),
            m = new MenuMorph(target, '');

        if (target === world) {
            var makeMorph = function (cls) {
                return function () {
                    var m = new cls();
                    m.isEditable = true;
                    var bounds = getStrokeBounds(strokes);
                    m.isDraggable = true;
                    m.setPosition(bounds.topLeft());
                    m.setExtent(bounds.extent());
                    world.add(m);
                }
            }
            target = {
                rectangle: makeMorph(Morph),
                box: makeMorph(BoxMorph),
                circle: makeMorph(CircleBoxMorph),
                slider: makeMorph(SliderMorph),
                string: makeMorph(StringMorph)
            }
        }

        var list = [];

        if (!target.isParameter) {
            result.getTextCandidates().forEach(function (text) {
                if (text.length < 2) {
                    list = list.concat(getSymbolicFunction(text));
                };
                var funcs = fuzzyMatchFunctions(target, text);
                list = list.concat(funcs);
                list.push(text);
            });

            list.getUnique().forEach(function (text) {
                if (typeof (target[text]) == "function") {
                    m.addItem(text, function () {
                        try {
                            sendMessage(target, text);
                        } catch (e) {
                            world.inform("Could not eval target." + text + "(). The error was " + e);
                        }
                        deleteStrokes(strokes);
                    }, undefined, undefined, true);
                } else {
                    m.addItem(text, function () {
                        try {
                            eval("target." + text)
                        } catch (e) {
                            world.inform("Could not eval target." + text + "(). The error was " + e);
                        }
                        deleteStrokes(strokes);
                    });
                }
            });
        } else {
            result.getTextCandidates().forEach(function (text) {
                m.addItem(text, function () {
                    target.text = text + target.text.slice(target.text.length - 1, target.text.length);
                    target.changed();
                    target.drawNew();
                    target.changed();
                    deleteStrokes(strokes);
                });
            });
        }

        if (m.items.length < 1) return;
        m.drawNew();
        m.addShadow(new Point(2, 2), 80);
        m.keepWithin(world);
        world.add(m);
        m.setPosition(new Point(strokes[0].boundingRect.x - m.maxWidth() - 80, strokes[0].boundingRect.y));
        m.fullChanged();
        recognitionMenu = m;
    }

    function sendMessage(target, text) {
        var names = getParamNames(target[text]);
        if (names.length === 0) return target[text]();
        var pos = recognitionMenu.position();

        var parammorphs = [];
        function makeArgs(s, last) {
            var m = new TextMorph(s + (last ? ")" : ","), 48, undefined, undefined, true);
            m.backgroundColor = (new Color(230, 230, 230));
            m.setPosition(pos);
            pos = pos.add(new Point(m.width() + 4, 0));
            m.isParameter = true;
            world.add(m);
            m.changed();
            m.drawNew();
            m.changed();
            parammorphs.push(m);
        }

        var m = new TextMorph(text + "(", 48, undefined, true);
        m.backgroundColor = (new Color(230, 230, 230));
        m.setPosition(pos);
        pos = pos.add(new Point(m.width() + 2, 0));
        m.mouseClickLeft = function () {
            var message = text + "(";
            parammorphs.forEach(function (m, idx) {
                message = message + m.text;
                m.destroy()
            });
            m.destroy();
            try {
                eval("target." + message);
            } catch (e) {
                world.inform("Could not eval target." + text + "(). The error was " + e);
            }
        };
        world.add(m);
        m.changed();
        m.drawNew();
        m.changed();

        names.forEach(function (name, idx) {
            makeArgs(name, idx === names.length - 1);
        });
    }

    var recognitionMenu;

    function fuzzyMatchFunctions(object, text) {
        if (text.length < 2) return [];
        var list = [];
        text = text.toLowerCase().replace(/\s+/, "");
        for (var k in object) {
            if (typeof (object[k]) == "function" && k.length < text.length * 2) {
                if (levenshteinDistance(k.slice(0, text.length - 1), text) < 2) {
                    list.push(k);
                }
            }
        }
        return list.sort();
    }

    function levenshteinDistance(a, b) {
        if (a.length == 0) return b.length;
        if (b.length == 0) return a.length;

        var matrix = [];

        // increment along the first column of each row
        var i;
        for (i = 0; i <= b.length; i++) {
            matrix[i] = [i];
        }

        // increment each column in the first row
        var j;
        for (j = 0; j <= a.length; j++) {
            matrix[0][j] = j;
        }

        // Fill in the rest of the matrix
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

    var STRIP_COMMENTS = /((\/\/.*$)|(\/\*[\s\S]*?\*\/))/mg;
    var ARGUMENT_NAMES = /([^\s,]+)/g;
    function getParamNames(func) {
        var fnStr = func.toString().replace(STRIP_COMMENTS, '');
        var result = fnStr.slice(fnStr.indexOf('(') + 1, fnStr.indexOf(')')).match(ARGUMENT_NAMES);
        if (result === null)
            result = [];
        return result;
    }
}).call(this);