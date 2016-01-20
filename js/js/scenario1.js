(function (exports) {
    WinJS.UI.Pages.define("/html/scenario1.html", {
        ready: function (element, options) {
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
            var inkCanvasWrapper = new InkCanvasWrapper(world.worldCanvas, [pDollarRecognizer]),
                assistant = new Assistant(world, inkCanvasWrapper),
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

            // start running
            loop();
            function loop() {
                requestAnimationFrame(loop);
                world.doOneCycle();
                if (assistantEnabled) {
                    inkCanvasWrapper.recognize().then((results, wrapper) => {
                        results.forEach((result) => {
                            assistant.showHelp(result, wrapper);
                        });
                    });
                } else {
                    assistant.deleteHelp();
                }
            }
        }
    });
})(this);