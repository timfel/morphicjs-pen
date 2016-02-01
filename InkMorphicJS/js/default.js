// For an introduction to the Blank template, see the following documentation:
// http://go.microsoft.com/fwlink/?LinkId=232509
(function () {
	"use strict";

	var app = WinJS.Application;
	var activation = Windows.ApplicationModel.Activation;

	app.onactivated = function (args) {
		if (args.detail.kind === activation.ActivationKind.launch) {
			if (args.detail.previousExecutionState !== activation.ApplicationExecutionState.terminated) {
				// TODO: This application has been newly launched. Initialize your application here.
			} else {
				// TODO: This application was suspended and then terminated.
				// To create a smooth user experience, restore application state here so that it looks like the app never stopped running.
			}
			args.setPromise(WinJS.UI.processAll());
		}
	};

	app.onloaded = function () {
	    var worldCanvas = document.getElementById('world'),
                world = new WorldMorph(worldCanvas, true);

	    // setup morphic world
	    world.isDevMode = true;
	    world.togglePreferences();

	    var hi = new StringMorph('Hello, World!', 48, 'serif');
	    hi.isDraggable = true;
	    hi.isEditable = true;
	    hi.setPosition(new Point(275, 200));
	    world.add(hi);

	    var hint1 = new StringMorph('(right click for world menu)', 20, 'serif');
	    hint1.isDraggable = true;
	    hint1.isEditable = true;
	    hint1.setPosition(new Point(350, 270));
	    world.add(hint1);

	    var hint2 = new TextMorph("\nUse the pen to draw morphs onto the world,\n" +
                                  "or to write messages onto objects.", 10, 'sans-serif');
	    hint2.isDraggable = true;
	    hint2.isEditable = true;
	    hint2.setPosition(hint1.bottomLeft());
	    world.add(hint2)

	    // setup recognition and ink
	    var pDollarRecognizer = new PDollarRecognizer();
	    pDollarRecognizer.setupShapes();
	    var inkCanvasWrapper = new InkCanvasWrapper(world.worldCanvas, [pDollarRecognizer, new LiteralRecognizer()]),
            assistantEnabled = false;

	    // morphic specific draw test and redraw logic
	    inkCanvasWrapper.onDrawStart = (evt) => {
	        return world.topMorphAt(new Point(evt.x, evt.y)).allowsDrawingOver();
	    }
	    inkCanvasWrapper.onDrawEnd = (evt) => {
	        assistantEnabled = true;
	    }
	    inkCanvasWrapper.onDelete = (evt) => {
	        assistantEnabled = false;
	    }
	    inkCanvasWrapper.onRedraw = (cb) => {
	        world.changed();
	        world.onNextStep = () => { world.onNextStep = cb };
	    }

	    var executionHistory = new ScrollFrameMorph();
	    executionHistory.setWidth(300);
	    executionHistory.setHeight(world.height());
	    executionHistory.setPosition(world.topRight().subtract(new Point(300, 0)));
	    executionHistory.setColor(new Color(255, 255, 255));
	    world.add(executionHistory);
	    world.sidePane = executionHistory.contents;

	    // start running
	    loop();
	    function loop() {
	        requestAnimationFrame(loop);
	        world.doOneCycle();
	        if (assistantEnabled) {
	            assistantEnabled = false;
	            inkCanvasWrapper.recognize().then((results, wrapper) => {
	                results.forEach((result) => {
	                    var strokes = result.strokes,
                            target = world.topMorphAt(new Point(strokes[0].boundingRect.x, strokes[0].boundingRect.y));
	                    target.respondToPossibleText(result.textCandidates, getStrokeBounds(strokes), () => {
	                        inkCanvasWrapper.deleteStrokes(strokes);
	                    });
	                });
	            });
	        } else {
	        }
	    }

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

	app.start();
})();
