# GeoGebra extension for Numbas

An extension for Numbas which integrates [GeoGebra](https://www.geogebra.org) materials. 

To use this extension in a question, tick the "GeoGebra" option on the _Extensions and Scripts_ tab.

All the GeoGebra resources are loaded from [geogebra.org](https://geogebra.org), so this extension *WILL NOT* work offline, or in environments where that domain is blocked or otherwise inaccessible.

**Warning: At the moment, there's no way for this code to detect when the GeoGebra embedding fails, either due to an incorrect ID or a network issue. If you just get "geogebra applet loading..." for a long time, check your browser's console.**

## JME functions

### `geogebra_applet(id or URL, [object definitions], [tool-part links])` → HTML

*Load a GeoGebra material, and return the HTML element containing it.*

The first parameter is either the material's ID (e.g. `jJ3zQ29z` - it's the random-looking bit in the material's URL), or the URL of the material, such as `https://www.geogebra.org/material/edit/id/jJ3zQ29z` or `http://ggbm.at/jJ3zQ29z`.

The optional second parameter is a list of definitions (or re-definitions) of objects, in the form `[name,definition]`. The definition can be:

* a number;
* a vector, which produces a point in the GeoGebra applet;
* a string, which is interpreted as a [GeoGebra command](https://www.geogebra.org/manual/en/Commands);
* a list of any of the above types of value.

If the object with the given name is already defined in the applet, then it is updated with the new definition you give. So you can set up your whole worksheet in the GeoGebra editor with placeholder values, and then replace them with the values generated by your question when it runs.

The optional third parameter is a list of links between GeoGebra exercises and Numbas "extension" parts, in the format `[exercise name,part id]`. The latest version of GeoGebra (5.0, I think, only available at [beta.geogebra.org](http://beta.geogebra.org) as of July 2016) allows you to report a pass/fail result based on whether the student has performed a given construction in the applet.

To assign the result of the exercise called `Exercise1` to the first gap in Numbas part *a*, pass `[ ['Exercise1','p0g0'] ]` as the third parameter. The part or gap must be an "extension" type part.

[Tutorial on creating exercises in GeoGebra](https://www.geogebra.org/m/wz9qvboS)

#### Example usage

```
geogebra_applet('https://www.geogebra.org/m/jJ3zQ29z',[['A',vector(ax,ay)],['B',vector(bx,by)],['C',vector(cx,cy)]])
```

Loads the given worksheet, and moves points A,B and C to the given positions.

### `geogebra_base64(base64,width,height)` → HTML

*Create a GeoGebra applet from the given base64-encoded .ggb file, with the given width and height in pixels, and return the HTML element containing it.*

If you have the base64-encoded version of a .ggb file, this function will create a GeoGebra applet with the given dimensions and load the given worksheet in it.

This is provided mainly because I'm wary of relying on the GeoGebra Materials site to load applets. One way of obtaining the base 64 string for a GeoGebra applet is to run `ggbApplet.getBase64()` on a page containing the applet. **Note:** the variable won't always be called `ggbApplet` - on geogebra.org, for example, a unique string of digits is appended to the variable name.

## JavaScript functions

### `createGeogebraApplet(options)`

`options` is a dictionary of [GeoGebra applet parameters](https://www.geogebra.org/manual/en/Reference:Applet_Parameters). This function returns a [Promise](https://developer.mozilla.org/en/docs/Web/JavaScript/Reference/Global_Objects/Promise) object which resolves to an object `{app: <GeoGebra applet>, element: <HTML element containing the applet>}`.

You could use this function to load an applet and then manipulate it with the [GeoGebra JavaScript API](https://www.geogebra.org/manual/en/Reference:JavaScript) before embedding it in the page.

Note that because this function returns a promise, the applet will not have finished loading at the time the question is displayed to the student. You'll have to insert the applet in the page yourself once the promise resolves.
