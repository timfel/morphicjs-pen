(function() {
    "use strict";

    // Prevent two concurrent recognizeAsync() operations
    var recognizeOperationRunning = false;

    // A button handler which runs the currently-loaded handwriting recognizer over
    // the selected ink (not counting highlight strokes).  If no ink is selected, then it
    // runs over all the ink (again, not counting highlight strokes).
    // The recognition results (a string) is displayed in the status window.
    // The recognition results are also stored within the ink manager itself, so that
    // other commands can find the bounding boxes (or ink strokes) of any specific
    // word of ink.
    function recognize(thenDo) {
        if (recognizeOperationRunning || inkManager.getStrokes().length === 0) {
            return;
        }
        recognizeOperationRunning = true;
        inkManager.recognizeAsync(Windows.UI.Input.Inking.InkRecognitionTarget.all).done(
            function (results) {
                // Doing a recognition does not update the storage of results (the results that are stored inside the ink manager).
                // We do that ourselves by calling this method.
                inkManager.updateRecognitionResults(results);

                // The arg "results" is an array of result objects representing "words", where "words" means words of ink (not computer memory words).
                // I.e., if you write "this is a test" that is 4 words, and results will be an array of length 4.

                var alternates = ""; // Will accumulate the result words, with spaces between
                results.forEach(function (result) {
                    // Method getTextCandidates() returns an array of recognition alternates (different interpretations of the same word of ink).
                    // This is a standard JavaScript array of standard JavaScript strings.
                    // For this program we only use the first (top) alternate in our display.
                    // If we were doing search over this ink, we would want to search all alternates.
                    var alts = result.getTextCandidates();
                    alternates = alternates + " " + alts[0];

                    // The specific strokes forming the current word of ink are available to us.
                    // This feature is not used here, but we could, if we chose, display the ink,
                    // with the recognition result for each word directly above the specific word of ink,
                    // by fetching the bounding box of the recognitionResult (via the boundingRect property).
                    // Or, if we needed to do something to each stroke in the recognized word, we could
                    // call recognitionResult.getStrokes(), then iterate over the individual strokes.
                });
                displayStatus(alternates);

                if (thenDo) thenDo(results);

                // Reset recognizeOperationRunning, can call recognizeAsync() once again
                recognizeOperationRunning = false;
            },
            function (e) {
                displayError("InkManager::recognizeAsync: " + e.toString());

                // We still want to reset recognizeOperationRunning if an error occurs
                recognizeOperationRunning = false;
            }
        );
    }

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

    function getSymbolicFunction(text) {
        switch (text) {
            case "x":
            case "X":
                return ["destroy"]
            case ">":
                return ["moveBy(new Point(10,0))"]
            case "<":
                return ["moveBy(new Point(-10,0))"]
            case "^":
                return ["moveBy(new Point(0,-10))"]
            case "/":
                return ["moveBy(new Point(10,-10))"]
            case "\\":
                return ["moveBy(new Point(10,10))"]
            default:
                return []
        }
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

    var STRIP_COMMENTS = /((\/\/.*$)|(\/\*[\s\S]*?\*\/))/mg;
    var ARGUMENT_NAMES = /([^\s,]+)/g;
    function getParamNames(func) {
        var fnStr = func.toString().replace(STRIP_COMMENTS, '');
        var result = fnStr.slice(fnStr.indexOf('(') + 1, fnStr.indexOf(')')).match(ARGUMENT_NAMES);
        if (result === null)
            result = [];
        return result;
    }
})()