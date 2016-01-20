(function(exports) {
    "use strict";
    exports.StrokeManager = StrokeManager;

    var currentRecognitionResults = null;

    // Tied to Microsoft Ink Manager for Bezier curve fitting and stroke grouping
    function StrokeManager() {
        this.inkManager = new Windows.UI.Input.Inking.InkManager();
        this.drawingAttributes = new Windows.UI.Input.Inking.InkDrawingAttributes();
        this.drawingAttributes.fitToCurve = true;
        this.inkManager.setDefaultDrawingAttributes(this.drawingAttributes);
        var msrecognizers = this.inkManager.getRecognizers();
        for (var i = 0, len = msrecognizers.length; i < len; i++) {
            if ("Microsoft English (US) Handwriting Recognizer" === msrecognizers[i].name) {
                this.inkManager.setDefaultRecognizer(msrecognizers[i]);
                break;
            }
        }
        // TODO
        this.recognizers = [new PDollarRecognizer()];
    }

    StrokeManager.prototype.setLineWidth = function (s) {
        this.drawingAttributes.size.width = this.drawingAttributes.size.height = s;
        this.inkManager.setDefaultDrawingAttributes(this.drawingAttributes);
    }

    StrokeManager.prototype.setStrokeStyle = function (c) {
        this.drawingAttributes.color = fromNameOrHex(c);
        this.inkManager.setDefaultDrawingAttributes(this.drawingAttributes);
    }

    StrokeManager.prototype.setMode = function (str) {
        if (str === "inking") {
            this.inkManager.mode = Windows.UI.Input.Inking.InkManipulationMode.inking;
        } else if (str === "erasing") {
            this.inkManager.mode = Windows.UI.Input.Inking.InkManipulationMode.erasing;
        }
    }

    StrokeManager.prototype.deleteStrokes = function (strokes) {
        strokes.forEach((stroke) => { stroke.selected = true });
        this.inkManager.deleteSelected();
    }

    StrokeManager.prototype.processPointerDown = function (pt) {
        this.inkManager.processPointerDown(pt);
    }

    StrokeManager.prototype.processPointerUpdate = function (pt) {
        this.inkManager.processPointerUpdate(pt);
    }

    StrokeManager.prototype.processPointerUp = function (pt) {
        this.inkManager.processPointerUp(pt);
    }

    StrokeManager.prototype.getStrokes = function () {
        return this.inkManager.getStrokes().map((stroke) => {
            stroke.color = colorToCSS(stroke.drawingAttributes.color);
            stroke.size = stroke.drawingAttributes.size.width;
            return stroke;
        });
    }

    StrokeManager.prototype.recognize = function() {
        return new Promise((resolve, reject) => {
            if (currentRecognitionResults !== null || this.inkManager.getStrokes().length === 0) {
                reject(Error("recognize operation already running or no strokes available"))
            } else {
                currentRecognitionResults = [];
                var recognizersLeftToProcess = 0;

                this.determineStrokeGroups().then(
                    (strokeGroups) => {
                        strokeGroups.forEach((strokeGroup, resultId) => {
                            var inkpoints = _.flatten(strokeGroup.map((stroke, idx) => {
                                return stroke.getInkPoints().map((pt) => {
                                    return new Point(pt.position.x, pt.position.y, idx);
                                });
                            }));
                            this.recognizers.forEach((r) => {
                                recognizersLeftToProcess++;
                                r.recognizeInk(inkpoints, strokeGroup).then(
                                    (results) => {
                                        currentRecognitionResults[resultId] = currentRecognitionResults[resultId].concat(results);
                                        if (--recognizersLeftToProcess === 0) {
                                            resolve(finishRecognition(strokeGroups));
                                        }
                                    },
                                    (e) => {
                                        if (--recognizersLeftToProcess === 0) {
                                            resolve(finishRecognition(strokeGroups));
                                        }
                                        reject(e);
                                    })
                            });
                        });
                    },
                    (e) => {
                        reject(Error("Could not determine stroke groups"));
                    }
                )

                function finishRecognition(strokeGroups) {
                    var results = currentRecognitionResults.map((r, i) => {
                        return {
                            strokes: strokeGroups[i],
                            textCandidates: r
                        }
                    });
                    currentRecognitionResults = null;
                    return results;
                }
            }
        })
    }

    StrokeManager.prototype.determineStrokeGroups = function () {
        return new Promise((resolve, reject) => {
            this.inkManager.recognizeAsync(Windows.UI.Input.Inking.InkRecognitionTarget.all).done(
                (results) => {
                    var strokeGroups = [];
                    results.forEach((result) => {
                        strokeGroups.push(result.getStrokes());
                        currentRecognitionResults.push(_.toArray(result.getTextCandidates()));
                    });
                    resolve(strokeGroups);
                },
                reject
            );
        })
    }
    
    // common api for supported stroke recognition engines
    PDollarRecognizer.prototype.recognizeInk = function (inkpoints, strokes) {
        return new Promise((resolve, reject) => {
            try {
                var result = this.Recognize(inkpoints);
                if (result.Score > 0.7) {
                    resolve([result.Name]);
                } else {
                    resolve([]);
                }
            } catch (e) {
                reject(e);
            }
        });
    }

    // private
    function colorToCSS(color) {
        return "#" + byteHex(color.r) + byteHex(color.g) + byteHex(color.b);
        function byteHex(num) {
            var hex = num.toString(16);
            if (hex.length === 1) {
                hex = "0" + hex;
            }
            return hex;
        }
    }

    function fromNameOrHex(color) {
        // Convert from the few color names used in this app to Windows.UI.Input.Inking's color code.
        // If it isn't one of those, then decode the hex string.  Otherwise return gray.
        // The alpha component is always set to full (255).
        if (Windows.UI.Colors[color.toLowerCase()]) {
            return Windows.UI.Colors[color.toLowerCase()];
        } else if ((color.length === 7) && (color.charAt(0) === "#")) {
            var r = parseInt(color.substr(1, 2), 16);
            var g = parseInt(color.substr(3, 2), 16);
            var b = parseInt(color.substr(5, 2), 16);
            return Windows.UI.ColorHelper.fromArgb(255, r, g, b);
        } else {
            return Windows.UI.Colors.gray;
        }
    }

    function Point(x, y, id) {
        this.X = x;
        this.Y = y;
        this.ID = id; // line ID to which this point belongs (1,2,...)
    }
})(this)