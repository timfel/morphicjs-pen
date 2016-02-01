(function () {
    "use strict";

    var Point = PDollarRecognizer.Point,
        PointCloud = PDollarRecognizer.PointCloud;
    
    PDollarRecognizer.prototype.setupShapes = function () {
        this.PointClouds = [];
        this.PointClouds.push(new PointCloud("destroy", new Array( // shape of X
            new Point(30, 146, 1), new Point(106, 222, 1),
            new Point(30, 225, 2), new Point(106, 146, 2)
        )));
        this.PointClouds.push(new PointCloud("clone", new Array( // shape of C
            new Point(100, 100, 1), new Point(80, 100, 1),
            new Point(80, 100, 2), new Point(70, 120, 2), new Point(60, 130, 2), new Point(50, 140, 2), new Point(45, 150, 2),
            new Point(45, 150, 3), new Point(50, 160, 3), new Point(60, 170, 3), new Point(80, 180, 3), new Point(90, 190, 3),
            new Point(90, 190, 4), new Point(110, 190, 4)
        )));
        this.PointClouds.push(new PointCloud("rectangle", new Array( // shape of square
            new Point(30, 100, 1), new Point(170, 100, 1),
            new Point(170, 100, 2), new Point(170, 200, 2),
            new Point(170, 200, 3), new Point(30, 200, 3),
            new Point(30, 200, 4), new Point(30, 100, 4)
        )));
        this.PointClouds.push(new PointCloud("tickmark", new Array( // shape of \/
            new Point(50, 100, 1), new Point(100, 150, 1),
		    new Point(100, 150, 2), new Point(0, 200, 2)
        )));
    }
}).call(this);