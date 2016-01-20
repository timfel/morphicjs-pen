(function (exports) {
    "use strict";

    exports.InkCanvasManager = function (morphicWorld, strokeManager) {
        this.strokeManager = strokeManager;
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

        this.savedDrawingMode = {};
        this.penId = -1;

        this.strokeManager.setLineWidth(2);

        this.inkMode();
    }

    InkCanvasManager.prototype.inkMode = function() {
        this.strokeManager.setStrokeStyle(this.inkContext.strokeStyle = "blue");
        this.strokeManager.setMode("inking");
        this.inkCanvas.style.cursor = "default";
    }

    InkCanvasManager.prototype.eraserMode = function() {
        this.inkContext.strokeStyle = "rgba(255,255,255,0.5)";
        this.strokeManager.setMode("erasing");
        this.inkCanvas.style.cursor = "url(images/erase.cur), auto";
    }

    InkCanvasManager.prototype.handlePointerDown = function(evt) {
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
            this.strokeManager.processPointerDown(evt.currentPoint);
            this.penID = evt.pointerId;
            evt.preventDefault();
            return false;
        }
    }

    InkCanvasManager.prototype.handlePointerMove = function(evt) {
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

    InkCanvasManager.prototype.handlePointerUp = function(evt) {
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

    InkCanvasManager.prototype.changed = function () {
        this.inkMode();
        this.world.changed();
        this.world.onNextStep = () => {
            this.world.onNextStep = () => {
                // silly dance - we need to wait for one extra tick before drawing again
                this.strokeManager.getStrokes().forEach((stroke) => {
                    renderStroke(stroke, stroke.color, stroke.size, this.inkContext);
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

    InkCanvasManager.prototype.deleteStrokes = function (strokes) {
        this.strokeManager.deleteStrokes(strokes);
        this.changed();
    }
})(this);