(function () {
    "use strict";

    this.LiteralRecognizer = LiteralRecognizer;
    this.CurrentLiteralStrokeData = [];

    function LiteralRecognizer() { }

    LiteralRecognizer.prototype.recognizeInk = function (inkpoints, strokes) {
        return new Promise((resolve, reject) => {
            // XXX: Global State
            CurrentLiteralStrokeData = [strokes, inkpoints];
            resolve(["Make shape into Morph"]);
        });
    }

}).call(this);