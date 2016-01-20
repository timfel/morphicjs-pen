//// Copyright (c) Microsoft Corporation. All rights reserved

// Sample app demonstrating the use of Ink and Reco APIs for Windows Store apps.
// We are using Windows.UI.Input.Inking.InkManager.

(function (exports) {
    "use strict";

    exports.StrokeManager = function(morphicWorld, optionalRecognizerName) {
        var recognizerName = optionalRecognizerName || "Microsoft English (US) Handwriting Recognizer";

        this.world = morphicWorld;
        this.inkCanvas = this.world.worldCanvas;
        this.inkCanvas.addEventListener("pointerdown", this.handlePointerDown.bind(this), false);
        this.inkCanvas.addEventListener("pointerup", this.handlePointerUp.bind(this), false);
        this.inkCanvas.addEventListener("pointermove", this.handlePointerMove.bind(this), false);
        this.inkCanvas.addEventListener("pointerout", this.handlePointerUp.bind(this), false); // same as pointer up
        this.inkContext = this.inkCanvas.getContext("2d");
        this.inkContext.lineWidth = 2;
        this.inkContext.lineCap = "round";
        this.inkContext.lineJoin = "round";
        this.inkManager = new Windows.UI.Input.Inking.InkManager();
        this.savedDrawingMode = {};
        this.penId = -1;

        this.drawingAttributes = new Windows.UI.Input.Inking.InkDrawingAttributes();
        this.drawingAttributes.fitToCurve = true;
        this.drawingAttributes.size.width = this.drawingAttributes.size.height = this.inkContext.lineWidth;
        this.inkManager.setDefaultDrawingAttributes(this.drawingAttributes);

        if (!this.setRecognizerByName(recognizerName)) {
            alert("Failed to find '" + recognizerName + "' handwriting recognizer");
        }

        this.inkMode();
    }

    StrokeManager.prototype.setRecognizerByName = function(recoName) {
        var recognizers = this.inkManager.getRecognizers();
        for (var i = 0, len = recognizers.length; i < len; i++) {
            if (recoName === recognizers[i].name) {
                this.inkManager.setDefaultRecognizer(recognizers[i]);
                return true;
            }
        }
        return false;
    }

    StrokeManager.prototype.inkMode = function() {
        this.inkContext.strokeStyle = colorToCSS(this.drawingAttributes.color = fromNameOrHex("blue"));
        this.inkManager.setDefaultDrawingAttributes(this.drawingAttributes);
        this.inkManager.mode = Windows.UI.Input.Inking.InkManipulationMode.inking;
        this.inkCanvas.style.cursor = "default";
    }

    StrokeManager.prototype.eraserMode = function() {
        this.inkContext.strokeStyle = "rgba(255,255,255,0.5)";
        this.inkManager.mode = Windows.UI.Input.Inking.InkManipulationMode.erasing;
        this.inkCanvas.style.cursor = "url(images/erase.cur), auto";
    }

    StrokeManager.prototype.handlePointerDown = function(evt) {
        if (evt.pointerType === "pen") {
            var morph = this.world.topMorphAt(new Point(evt.x, evt.y));
            if (!morph.allowsDrawingOver()) return;

            if (evt.currentPoint.properties.isEraser) {
                this.eraserMode();
            } else {
                this.inkMode();
            }

            this.inkContext.beginPath();
            this.inkContext.moveTo(evt.currentPoint.rawPosition.x, evt.currentPoint.rawPosition.y);
            this.inkManager.processPointerDown(evt.currentPoint);
            this.penID = evt.pointerId;
            evt.preventDefault();
            return false;
        }
    }

    StrokeManager.prototype.handlePointerMove = function(evt) {
        if (evt.pointerId === this.penID) {
            this.inkContext.lineTo(evt.currentPoint.rawPosition.x, evt.currentPoint.rawPosition.y);
            this.inkContext.stroke();
            // Get all the points we missed and feed them to inkManager.
            // The array pts has the oldest point in position length-1; the most recent point is in position 0.
            // Actually, the point in position 0 is the same as the point in pt above (returned by evt.currentPoint).
            var pts = evt.intermediatePoints;
            for (var i = pts.length - 1; i >= 0 ; i--) {
                this.inkManager.processPointerUpdate(pts[i]);
            }
            evt.preventDefault();
            return false;
        }
    }

    StrokeManager.prototype.handlePointerUp = function(evt) {
        if (evt.pointerId === this.penID) {
            this.penID = -1;
            this.inkContext.lineTo(evt.currentPoint.rawPosition.x, evt.currentPoint.rawPosition.y);
            this.inkContext.stroke();
            this.inkContext.closePath();
            this.inkManager.processPointerUp(evt.currentPoint);
            evt.preventDefault();
            this.changed();
            return false;
        }
    }

    StrokeManager.prototype.changed = function() {
        this.world.changed();
        this.world.onNextStep = () => {
            this.world.onNextStep = () => {
                // silly dance - we need to wait for one extra tick before drawing again
                this.inkManager.getStrokes().forEach((stroke) => {
                    renderStroke(stroke,
                                 colorToCSS(stroke.drawingAttributes.color),
                                 stroke.drawingAttributes.size.width,
                                 this.inkContext);
                });
            };
        };

        function renderStroke(stroke, color, width, ctx) {
            ctx.save();
            ctx.beginPath();
            ctx.strokeStyle = color;
            ctx.lineWidth = width;
            var first = true;
            stroke.getRenderingSegments().forEach((segment) => {
                if (first) {
                    ctx.moveTo(segment.position.x, segment.position.y);
                    first = false;
                } else {
                    ctx.bezierCurveTo(segment.bezierControlPoint1.x, segment.bezierControlPoint1.y,
                                        segment.bezierControlPoint2.x, segment.bezierControlPoint2.y,
                                        segment.position.x, segment.position.y);
                }
            });
            ctx.stroke();
            ctx.closePath();
            ctx.restore();
        }
    }

    StrokeManager.prototype.getStrokeBounds = function(strokes) {
        var x1 = this.inkCanvas.width, y1 = this.inkCanvas.height, x2 = 0, y2 = 0;
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

    StrokeManager.prototype.deleteStrokes = function(strokes) {
        strokes.forEach((stroke) => { stroke.selected = true });
        this.inkManager.deleteSelected();
        this.changed();
    }

    var colorToCSS = function(color) {
        return "#" + byteHex(color.r) + byteHex(color.g) + byteHex(color.b);
        function byteHex(num) {
            var hex = num.toString(16);
            if (hex.length === 1) {
                hex = "0" + hex;
            }
            return hex;
        }
    }

    var fromNameOrHex = function(color) {
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
})(this);