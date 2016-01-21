(function () {
    "use strict";
    
    PDollarRecognizer.prototype.setupShapes = function () {
        this.PointClouds = [];
        this.PointClouds.push(new PDollarRecognizer.PointCloud("destroy", new Array( // shape of X
            new PDollarRecognizer.Point(30, 146, 1), new PDollarRecognizer.Point(106, 222, 1),
            new PDollarRecognizer.Point(30, 225, 2), new PDollarRecognizer.Point(106, 146, 2)
        )));
        this.PointClouds.push(new PDollarRecognizer.PointCloud("clone", new Array( // shape of C
            new PDollarRecognizer.Point(100, 100, 1), new PDollarRecognizer.Point(80, 100, 1),
            new PDollarRecognizer.Point(80, 100, 2), new PDollarRecognizer.Point(70, 120, 2), new PDollarRecognizer.Point(60, 130, 2), new PDollarRecognizer.Point(50, 140, 2), new PDollarRecognizer.Point(45, 150, 2),
            new PDollarRecognizer.Point(45, 150, 3), new PDollarRecognizer.Point(50, 160, 3), new PDollarRecognizer.Point(60, 170, 3), new PDollarRecognizer.Point(80, 180, 3), new PDollarRecognizer.Point(90, 190, 3),
            new PDollarRecognizer.Point(90, 190, 4), new PDollarRecognizer.Point(110, 190, 4)
        )));
        this.PointClouds.push(new PDollarRecognizer.PointCloud("makeRectangle", new Array( // shape of square
            new PDollarRecognizer.Point(30, 100, 1), new PDollarRecognizer.Point(170, 100, 1),
            new PDollarRecognizer.Point(170, 100, 2), new PDollarRecognizer.Point(170, 200, 2),
            new PDollarRecognizer.Point(170, 200, 3), new PDollarRecognizer.Point(30, 200, 3),
            new PDollarRecognizer.Point(30, 200, 4), new PDollarRecognizer.Point(30, 100, 4)
        )));
    }
}).call(this);