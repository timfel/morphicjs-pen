//// Copyright (c) Microsoft Corporation. All rights reserved

// Sample app demonstrating the use of Ink and Reco APIs for Windows Store apps.
// We are using Windows.UI.Input.Inking.InkManager.

(function () {
    "use strict";
    function displayStatus(message) {
        WinJS.log && WinJS.log(message, "sample", "status");
    }

    function displayError(message) {
        WinJS.log && WinJS.log(message, "sample", "error");
    }

    // Functions to convert from and to the 32-bit int used to represent color in Windows.UI.Input.Inking.InkManager.

    // Convenience function used by color converters.
    // Assumes arg num is a number (0..255); we convert it into a 2-digit hex string.

    function byteHex(num) {
        var hex = num.toString(16);
        if (hex.length === 1) {
            hex = "0" + hex;
        }
        return hex;
    }

    // Convert from Windows.UI.Input.Inking's color code to html's color hex string.

    function toColorString(color) {
        return "#" + byteHex(color.r) + byteHex(color.g) + byteHex(color.b);
    }

    // Convert from the few color names used in this app to Windows.UI.Input.Inking's color code.
    // If it isn't one of those, then decode the hex string.  Otherwise return gray.
    // The alpha component is always set to full (255).
    function toColorStruct(color) {
        switch (color)
        {
        // Ink colors
        case "Black":
            return Windows.UI.Colors.black;
        case "Blue":
            return Windows.UI.Colors.blue;
        case "Red":
            return Windows.UI.Colors.red;
        case "Green":
            return Windows.UI.Colors.green;

        // Highlighting colors
        case "Yellow":
            return Windows.UI.Colors.yellow;
        case "Aqua":
            return Windows.UI.Colors.aqua;
        case "Lime":
            return Windows.UI.Colors.lime;

        // Select colors
        case "Gold":
            return Windows.UI.Colors.gold;

        case "White":
            return Windows.UI.Colors.white;
        }

        if ((color.length === 7) && (color.charAt(0) === "#")) {
            var r = parseInt(color.substr(1, 2), 16);
            var g = parseInt(color.substr(3, 2), 16);
            var b = parseInt(color.substr(5, 2), 16);
            return Windows.UI.ColorHelper.fromArgb(255, r, g, b);
        }

        return Windows.UI.Colors.gray;
    }

    // Global variable representing the application.
    var app;

    // Global variables representing the ink interface.
    // The usage of a global variable for drawingAttributes is not completely necessary,
    // just a convenience.  One could always re-fetch the current drawingAttributes
    // from the inkManager.
    var inkManager = new Windows.UI.Input.Inking.InkManager();
    var drawingAttributes = new Windows.UI.Input.Inking.InkDrawingAttributes();
    drawingAttributes.fitToCurve = true;
    inkManager.setDefaultDrawingAttributes(drawingAttributes);

    // These are the global canvases (and their 2D contexts) for highlighting, for drawing ink,
    // and for lassoing (and erasing).
    var inkCanvas;
    var inkContext;
    var world;
    
    // The "mode" of whether we are highlighting, inking, lassoing, or erasing is controlled by this global variable,
    // which should be pointing to either hlContext, inkContext, or selContext.
    // In lassoing mode (when context points to selContext), we might also be in erasing mode;
    // the state of lassoing vs. erasing is kept inside the ink manager, in attribute "mode", which will
    // have a value from enum Windows.UI.Input.Inking.InkManipulationMode, one of either "selecting"
    // or "erasing" (the other value being "inking" but in that case context will be pointing to one of the other
    // 2 canvases).
    var context;

    // Three functions to save and restore the current mode, and to clear this state.

    // Note that we can get into erasing mode in one of two ways: there is a eraser button in the toolbar,
    // and some pens have an active back end that is meant to represent erasing.  If we get into erasing
    // mode via the button, we stay in that mode until another button is pushed.  If we get into erasing
    // mode via the eraser end of the stylus, we should switch out of it when the user switches to the ink
    // end of the stylus.  And we want to return to the mode we were in before this happened.  Thus we
    // maintain a shallow stack (depth 1) of "mode" info.

    var savedContext = null;
    var savedStyle = null;
    var savedCursor = null;
    var savedMode = null;

    function clearMode() {
        savedContext = null;
        savedStyle = null;
        savedCursor = null;
        savedMode = null;
    }

    function saveMode() {
        if (!savedContext) {
            savedStyle = context.strokeStyle;
            savedContext = context;
            savedCursor = inkCanvas.style.cursor;
            savedMode = inkManager.mode;
        }
    }

    function restoreMode() {
        if (savedContext) {
            context = savedContext;
            context.strokeStyle = savedStyle;
            inkManager.mode = savedMode;
            inkCanvas.style.cursor = savedCursor;
            clearMode();
        }
    }

    // Note that we cannot just set the width in stroke.drawingAttributes.size.width,
    // or the color in stroke.drawingAttributes.color.
    // The stroke API supports get and put operations for drawingAttributes,
    // but we must execute those operations separately, and change any values
    // inside drawingAttributes between those operations.

    // Change the color and width in the default (used for new strokes) to the values
    // currently set in the current context.
    function setDefaults() {
        var strokeSize = drawingAttributes.size;
        strokeSize.width = strokeSize.height = context.lineWidth;
        drawingAttributes.size = strokeSize;
        drawingAttributes.color = toColorStruct(context.strokeStyle);
        drawingAttributes.drawAsHighlighter = false;
        inkManager.setDefaultDrawingAttributes(drawingAttributes);
    }

    function inkMode() {
        clearMode();
        context = inkContext;
        inkManager.mode = Windows.UI.Input.Inking.InkManipulationMode.inking;
        setDefaults();
        inkCanvas.style.cursor = "default";
    }

    function eraseMode() {
        clearMode();
        inkContext.strokeStyle = "rgba(255,255,255,0.0)";
        context = inkContext;
        inkManager.mode = Windows.UI.Input.Inking.InkManipulationMode.erasing;
        inkCanvas.style.cursor = "url(images/erase.cur), auto";
    }

    function tempEraseMode() {
        saveMode();
        inkContext.strokeStyle = "rgba(255,255,255,0.0)";
        context = inkContext;
        inkManager.mode = inkManager.mode = Windows.UI.Input.Inking.InkManipulationMode.erasing;
        inkCanvas.style.cursor = "url(images/erase.cur), auto";
    }

    // Global memory of the current pointID (for pen, and, separately, for touch).
    // We ignore handlePointerMove() and handlePointerUp() calls that don't use the same
    // pointID as the most recent handlePointerDown() call.  This is because the user sometimes
    // accidentally nudges the mouse while inking or touching.  This can cause move events
    // for that mouse that have different x,y coordinates than the ink trace or touch path
    // we are currently handling.

    // 'Pointer*' events maintain this pointId so that one can track individual fingers,
    // the pen, and the mouse.

    // Note that when the pen fails to leave the area where it can be sensed, it does NOT
    // get a new ID; so it is possible for 2 or more consecutive strokes to have the same ID.

    var penID = -1;

    // We will accept pen down or mouse left down as the start of a stroke.
    // We will accept touch down or mouse right down as the start of a touch.
    function handlePointerDown(evt) {
        if (evt.pointerType === "pen") {
            // Anchor and clear any current selection.
            var pt = {x:0.0, y:0.0};
            inkManager.selectWithLine(pt, pt);

            pt = evt.currentPoint;

            if (pt.properties.isEraser) { // The back side of a pen, which we treat as an eraser
                tempEraseMode();
            } else {
                restoreMode();
            }

            context.beginPath();
            context.moveTo(pt.rawPosition.x, pt.rawPosition.y);

            inkManager.processPointerDown(pt);
            penID = evt.pointerId;
            evt.preventDefault();
            return false;
        }
    }

    function handlePointerMove(evt) {
        if (evt.pointerId === penID) {
            var pt = evt.currentPoint;
            context.lineTo(pt.rawPosition.x, pt.rawPosition.y);
            context.stroke();
            // Get all the points we missed and feed them to inkManager.
            // The array pts has the oldest point in position length-1; the most recent point is in position 0.
            // Actually, the point in position 0 is the same as the point in pt above (returned by evt.currentPoint).
            var pts = evt.intermediatePoints;
            for (var i = pts.length - 1; i >= 0 ; i--) {
                inkManager.processPointerUpdate(pts[i]);
            }
            evt.preventDefault();
            return false;
        }

        // No need to process touch events - selCanvas.gestureObject takes care of them and triggers MSGesture* events.
    }

    function handlePointerUp(evt) {
        if (evt.pointerId === penID) {
            penID = -1;
            var pt = evt.currentPoint;
            context.lineTo(pt.rawPosition.x, pt.rawPosition.y);
            context.stroke();
            context.closePath();

            var rect = inkManager.processPointerUp(pt);
            if (inkManager.mode === Windows.UI.Input.Inking.InkManipulationMode.selecting) {
                detachSelection(rect);
            }
            evt.preventDefault();
            renderAllStrokes();
            return false;
        }
    }

    // We treat the event of the pen leaving the canvas as the same as the pen lifting;
    // it completes the stroke.
    function handlePointerOut(evt) {
        if (evt.pointerId === penID) {
            var pt = evt.currentPoint;
            context.lineTo(pt.rawPosition.x, pt.rawPosition.y);
            context.stroke();
            context.closePath();
            inkManager.processPointerUp(pt);
            penID = -1;
            renderAllStrokes();
        }
    }

    // Draws a single stroke into a specified canvas 2D context, with a specified color and width.
    function renderStroke(stroke, color, width, ctx) {
        ctx.save();

        ctx.beginPath();
        ctx.strokeStyle = color;
        ctx.lineWidth = width;

        var first = true;
        stroke.getRenderingSegments().forEach(function (segment) {
            if (first) {
                ctx.moveTo(segment.position.x, segment.position.y);
                first = false;
            } else {
                ctx.bezierCurveTo(segment.bezierControlPoint1.x, segment.bezierControlPoint1.y,
                                    segment.bezierControlPoint2.x, segment.bezierControlPoint2.y,
                                    segment.position.x,            segment.position.y);
            }
        });

        ctx.stroke(); 
        ctx.closePath();

        ctx.restore();
    }

    // Redraws (from the beginning) all strokes in the canvases.  All canvases are erased,
    // then the paper is drawn, then all the strokes are drawn.
    function renderAllStrokes() {
        world.changed();
        world.onNextStep = function () {
            world.onNextStep = function () {
                // silly dance - we need to wait for the update before doing this
                inkManager.getStrokes().forEach(function (stroke) {
                    var att = stroke.drawingAttributes;
                    var color = toColorString(att.color);
                    var strokeSize = att.size;
                    var width = strokeSize.width;
                    var hl = stroke.drawingAttributes.drawAsHighlighter;
                    var ctx = inkContext;
                    if (stroke.selected) {
                        renderStroke(stroke, color, width * 2, ctx);
                        var stripe = hl ? "Azure" : "White";
                        var w = width - (hl ? 3 : 1);
                        renderStroke(stroke, stripe, w, ctx);
                    } else {
                        renderStroke(stroke, color, width, ctx);
                    }
                });
            }
        }
    }

    function clear() {
        if (anySelected()) {
            inkManager.deleteSelected();
        } else {
            selectAll();
            inkManager.deleteSelected();
            inkMode();
        }

        renderAllStrokes();
        displayStatus("");
        displayError("");
    }

    // A generic function for use for any async error function (the second arg to a then() method).
    function asyncError(e) {
        displayError("Async error: " + e.toString());
    }

    function refresh() {
        renderAllStrokes();
    }

    // Finds a specific recognizer, and sets the inkManager's default to that recognizer.
    // Returns true if successful.
    function setRecognizerByName(recoName) {
        // 'recognizers' is a normal JavaScript array
        var recognizers = inkManager.getRecognizers();
        for (var i = 0, len = recognizers.length; i < len; i++) {
            if (recoName === recognizers[i].name) {
                inkManager.setDefaultRecognizer(recognizers[i]);
                return true;
            }
        }
        return false;
    }

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
        if (recognizeOperationRunning) {
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

    // A button click handler for recognition results buttons in the "reco" Flyout.
    // The flyout shows the top 5 recognition results for a specific word, and
    // is invoked by tapping (with finger) on a word (after recognition has been run).
    // We fetch the recognition result (the innerHTML of the button, a string) and
    // copy it to the clipboard.
    function recoClipboard(evt) {
        recoFlyout.winControl.hide();
        var alt = evt.currentTarget.winControl.label;
        
        var dataPackage = new Windows.ApplicationModel.DataTransfer.DataPackage();
        dataPackage.setText(alt);
        Windows.ApplicationModel.DataTransfer.Clipboard.setContent(dataPackage);
        displayStatus("To clipboard: " + alt);
    }

    // Tag the event handlers of the ToolBar so that they can be used in a declarative context.
    // For security reasons WinJS.UI.processAll and WinJS.Binding.processAll (and related) functions allow only
    // functions that are marked as being usable declaratively to be invoked through declarative processing.
    WinJS.UI.eventHandler(eraseMode);
    WinJS.UI.eventHandler(clear);
    WinJS.UI.eventHandler(refresh);
    WinJS.UI.eventHandler(recognize);
    WinJS.Namespace.define("Ink", {
        eraseMode: eraseMode,
        clear: clear,
        refresh: refresh,
        recognize: recognize
    });

    var originalMorphicEventListeners = WorldMorph.prototype.initEventListeners;
    WorldMorph.prototype.initEventListeners = function () {
        originalMorphicEventListeners.call(this);

        WinJS.UI.processAll().then(
            function () {
                inkCanvas = this.worldCanvas;
                inkContext = inkCanvas.getContext("2d");
                inkContext.lineWidth = 2;
                inkContext.strokeStyle = "Black";
                inkContext.lineCap = "round";
                inkContext.lineJoin = "round";
                inkCanvas.addEventListener("pointerdown", handlePointerDown, false);
                inkCanvas.addEventListener("pointerup", handlePointerUp, false);
                inkCanvas.addEventListener("pointermove", handlePointerMove, false);
                inkCanvas.addEventListener("pointerout", handlePointerOut, false);

                if (!setRecognizerByName("Microsoft English (US) Handwriting Recognizer")) {
                    displayStatus("Failed to find English (US) recognizer");
                } else {
                    displayStatus("Verba volant, Scripta manet");
                }

                inkMode();
            }.bind(this)).done(
            function () {
            },
            function (e) {
                displayError("inkInitialize " + e.toString());
            }
        );
    };

    var page = WinJS.UI.Pages.define("/html/scenario1.html", {
        ready: function (element, options) {
            var worldCanvas = document.getElementById('world');
            world = new WorldMorph(worldCanvas, false);
            world.isDevMode = true;

            var hi = new StringMorph('Hello, World!', 48, 'serif');
            hi.isDraggable = true;
            hi.isEditable = true;
            hi.setPosition(new Point(275, 200));
            world.add(hi);

            var hint1 = new StringMorph('right click...', 20, 'serif');
            hint1.isDraggable = true;
            hint1.isEditable = true;
            hint1.setPosition(new Point(350, 270));
            world.add(hint1);

            var hint2 = new StringMorph('(or double touch)', 10, 'sans-serif');
            hint2.isDraggable = true;
            hint2.isEditable = true;
            hint2.setPosition(hint1.bottomLeft());
            world.add(hint2);

            var runBtn = new TriggerMorph();
            runBtn.labelString = 'run ink';
            runBtn.action = function () {
                recognize(function (results) {
                    results.forEach(function (result) {
                        var m = false;
                        var strokes = result.getStrokes();
                        var texts = result.getTextCandidates();

                        var target = world.topMorphAt(new Point(strokes[0].boundingRect.x, strokes[0].boundingRect.y));
                        if (target === world) {
                            texts.filter(function (ea) {
                                switch (ea) {
                                    case "rectangle":
                                        m = new Morph();
                                        break;
                                    case "box":
                                        m = new BoxMorph();
                                        break;
                                    case "circle":
                                        m = new CircleBoxMorph();
                                        break;
                                    case "slider":
                                        m = new SliderMorph();
                                        break;
                                    case "string":
                                        m = new StringMorph();
                                        m.isEditable = true;
                                        break;
                                }
                            });

                            if (m) {
                                var x1 = world.width(), y1 = world.height(), x2 = 0, y2 = 0;
                                strokes.forEach(function (stroke) {
                                    stroke.selected = true;

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
                                inkManager.deleteSelected();
                                m.isDraggable = true;
                                m.setPosition(new Point(x1, y1));
                                m.setExtent(new Point(x2, y2).subtract(new Point(x1, y1)));
                                world.add(m);
                            } else {
                                // do nothing, leave the stroke where it is
                            }
                        } else {
                            var code = texts[0];
                            if (!(code.endsWith("()") || code.endsWith(";"))) {
                                code = code + "()"
                            }
                            strokes.forEach(function (stroke) {
                                stroke.selected = true;
                            });
                            inkManager.deleteSelected();
                            displayStatus("sending " + code);
                            try {
                                eval("target." + code);
                            } catch (e) {
                                displayStatus("error while sending " + code + ". " + e);
                            }
                        }
                    });
                    renderAllStrokes();
                });
            };
            runBtn.setPosition(world.bottomRight().subtract(new Point(runBtn.width(), runBtn.height())))
            world.add(runBtn);

            loop();

            function loop() {
                requestAnimationFrame(loop);
                world.doOneCycle();
            }
        }
    });
})();