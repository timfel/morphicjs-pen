(function (exports) {
    "use strict";

    // Takes a canvas to prepare for ink drawing
    // configuration:
    //    onDrawStart - called before drawing begins, return false here to prevent drawing
    //    onDrawEnd   - called when a line is finished
    //    onRedraw    - called when we want the canvas cleared to completely redraw strokes
    //    onDelete    - called when a (set of) strokes is deleted
    exports.InkCanvasWrapper = function (canvas, recognizers) {
        this.strokeManager = new StrokeManager(recognizers);

        this.onDrawStart = null;
        this.onDrawEnd = null;
        this.onRedraw = (cb) => {
            this.inkCanvas.clearRect(0, 0, this.inkCanvas.width, this.inkCanvas.height);
            cb();
        };
        this.onDelete = null;

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

    var erasing = false;
    InkCanvasWrapper.prototype.inkMode = function() {
        this.strokeManager.setStrokeStyle(this.inkContext.strokeStyle = "blue");
        this.strokeManager.setMode("inking");
        erasing = false;
        this.inkCanvas.style.cursor = "default";
    }
    InkCanvasWrapper.prototype.eraserMode = function() {
        this.inkContext.strokeStyle = "rgba(255,255,255,0.5)";
        this.strokeManager.setMode("erasing");
        erasing = true;
        this.inkCanvas.style.cursor = "url(images/erase.cur), auto";
    }

    InkCanvasWrapper.prototype.handlePointerDown = function(evt) {
        if (evt.pointerType === "pen") {
            if (this.onDrawStart && !this.onDrawStart(evt)) return;

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
            if (this.onDrawEnd) this.onDrawEnd(evt);

            this.penID = -1;
            this.inkContext.lineTo(evt.currentPoint.rawPosition.x, evt.currentPoint.rawPosition.y);
            this.inkContext.stroke();
            this.inkContext.closePath();
            this.strokeManager.processPointerUp(evt.currentPoint);
            if (erasing && this.onDelete) {
                this.onDelete();
            }
            evt.preventDefault();
            this.changed();
            return false;
        }
    }

    InkCanvasWrapper.prototype.changed = function () {
        this.inkMode();
        this.onRedraw(() => {
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
        if (this.onDelete) this.onDelete();
    }

    InkCanvasWrapper.prototype.recognize = function () {
        return new Promise((resolve, reject) => {
            this.strokeManager.recognize().then(
                (r) => { resolve(r) },
                (e) => { reject(e) }
            );
        });
    }
})(this);