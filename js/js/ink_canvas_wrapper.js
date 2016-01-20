(function (exports) {
    "use strict";

    exports.InkCanvasWrapper = function (canvas) {
        this.strokeManager = new StrokeManager();
        this.drawTest = null;
        this.redrawCallback = (cb) => {
            this.inkCanvas.clearRect(0, 0, this.inkCanvas.width, this.inkCanvas.height);
            cb();
        };

        this.inkCanvas = canvas;
        this.inkCanvas.addEventListener("pointerdown", this.handlePointerDown.bind(this), false);
        this.inkCanvas.addEventListener("pointerup", this.handlePointerUp.bind(this), false);
        this.inkCanvas.addEventListener("pointermove", this.handlePointerMove.bind(this), false);
        this.inkCanvas.addEventListener("pointerout", this.handlePointerUp.bind(this), false); // same as pointer up
        this.inkContext = this.inkCanvas.getContext("2d");
        this.inkContext.lineWidth = 2;
        this.inkContext.lineCap = "round";
        this.inkContext.lineJoin = "round";

        this.savedDrawingMode = {};
        this.penId = -1;

        this.strokeManager.setLineWidth(2);

        this.inkMode();
    }

    InkCanvasWrapper.prototype.inkMode = function() {
        this.strokeManager.setStrokeStyle(this.inkContext.strokeStyle = "blue");
        this.strokeManager.setMode("inking");
        this.inkCanvas.style.cursor = "default";
    }

    InkCanvasWrapper.prototype.eraserMode = function() {
        this.inkContext.strokeStyle = "rgba(255,255,255,0.5)";
        this.strokeManager.setMode("erasing");
        this.inkCanvas.style.cursor = "url(images/erase.cur), auto";
    }

    InkCanvasWrapper.prototype.handlePointerDown = function(evt) {
        if (evt.pointerType === "pen") {
            if (this.drawTest && !this.drawTest(evt)) return;

            if (evt.currentPoint.properties.isEraser) {
                this.eraserMode();
            } else {
                this.inkMode();
            }

            this.inkContext.beginPath();
            this.inkContext.moveTo(evt.currentPoint.rawPosition.x, evt.currentPoint.rawPosition.y);
            this.strokeManager.processPointerDown(evt.currentPoint);
            this.penID = evt.pointerId;
            evt.preventDefault();
            return false;
        }
    }

    InkCanvasWrapper.prototype.handlePointerMove = function(evt) {
        if (evt.pointerId === this.penID) {
            this.inkContext.lineTo(evt.currentPoint.rawPosition.x, evt.currentPoint.rawPosition.y);
            this.inkContext.stroke();
            // Get all the points we missed and feed them to strokeManager for later.
            // The array pts has the oldest point in position length-1; the most recent point is in position 0.
            // Actually, the point in position 0 is the same as the point in pt above (returned by evt.currentPoint).
            var pts = evt.intermediatePoints;
            for (var i = pts.length - 1; i >= 0 ; i--) {
                this.strokeManager.processPointerUpdate(pts[i]);
            }
            evt.preventDefault();
            return false;
        }
    }

    InkCanvasWrapper.prototype.handlePointerUp = function(evt) {
        if (evt.pointerId === this.penID) {
            this.penID = -1;
            this.inkContext.lineTo(evt.currentPoint.rawPosition.x, evt.currentPoint.rawPosition.y);
            this.inkContext.stroke();
            this.inkContext.closePath();
            this.strokeManager.processPointerUp(evt.currentPoint);
            evt.preventDefault();
            this.changed();
            return false;
        }
    }

    InkCanvasWrapper.prototype.changed = function () {
        this.inkMode();
        this.redrawCallback(() => {
            this.strokeManager.getStrokes().forEach((stroke) => {
                renderStroke(stroke, stroke.color, stroke.size, this.inkContext);
            });
        });

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

    InkCanvasWrapper.prototype.deleteStrokes = function (strokes) {
        this.strokeManager.deleteStrokes(strokes);
        this.changed();
    }

    InkCanvasWrapper.prototype.recognize = function () {
        return this.strokeManager.recognize();
    }
})(this);