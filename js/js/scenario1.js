(function (exports) {
    WinJS.UI.Pages.define("/html/scenario1.html", {
        ready: function (element, options) {
            var worldCanvas = document.getElementById('world'),
                world = new WorldMorph(worldCanvas, true),
                inkCanvasWrapper = new InkCanvasWrapper(world.worldCanvas),
                assistant = new Assistant(world, inkCanvasWrapper);

            // morphic specific draw test and redraw logic
            inkCanvasWrapper.drawTest = (evt) => {
                return world.topMorphAt(new Point(evt.x, evt.y)).allowsDrawingOver();
            }
            inkCanvasWrapper.redrawCallback = (cb) => {
                world.changed();
                world.onNextStep = () => { world.onNextStep = cb };
            }

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
            world.add(hint2);

            loop();

            function loop() {
                requestAnimationFrame(loop);
                world.doOneCycle();
                inkCanvasWrapper.recognize().then((results) => {
                    results.forEach((result) => {
                        assistant.showStrokeRecognitions(result);
                    });
                });
            }
        }
    });
})(this);