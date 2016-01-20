(function () {
    "use strict";

    Morph.prototype.allowsDrawingOver = function () {
        return true;
    }

    MenuMorph.prototype.allowsDrawingOver = function () {
        return false;
    }

    MenuItemMorph.prototype.allowsDrawingOver = function () {
        return false;
    }
})();