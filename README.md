# Bookmarks
This is a simple yet quite effective script to manage a large number of bookmarks. By now I have used it for several years with a few different collections of bookmarks with different needs, and it has grown to its current state and proved to be very useful to me. As it might also be useful for others, I’m sharing it here. Note that the repository is managed as described in https://xkcd.com/1597/.

## Init
Copy `empty.html` (you can adapt the URL to a local copy if you want). You can also edit the `"meta"` section, see the documentation below for details. Then open your copy and use the edit function to add your bookmarks. Once you are done click the export button and replace the old data with the new JSON. Alternatively you can just bookmark the URL that is used on export, this also contains all data (but makes manual editing much harder).

## Usage
Most usage should be self-explanatory. Your bookmarks are shown with the data you entered. Links will always open in a new tab. At the top some statistics about the current items are shown.

### Sorting
By default the order will be as you added the items, use the dropdown to sort the bookmarks according to some criteria or randomly.

### Filtering
There are three ways to filter your bookmarks to only show a selection matching some criteria:

* You can define some default filters in the meta data. These can be enabled via a dropdown menu.
* Click on a tag to only show bookmarks with that tag. When you press the <kbd>Ctrl</kbd> key other tag filters are kept, when you press the <kbd>Shift</kbd> key bookmarks with that tag will be hidden.
* Click the filter button to select an arbitrary filter.

### Editing
To edit or remove a bookmark, click the edit button of the bookmark, to add a new bookmark, click the add button.

To re-order your bookmarks select that option from the order dropdown, then use the buttons on the items to re-order them. The left and the right arrow changes place with the next item, the down arrow groups all visible items together (this only makes sense when not all bookmarks are shown).

You can undo the last action.

After editing you have to export your data and save it in the same way you did during initialization. You can also manually edit the JSON, which is especially necessary for the metadata, and may be easier for mass edits to many items.

## Metadata

The `"meta"` section of the data can (currently) only be edited manually. The following keys exist, all are optional:
* `"title"`: a string to set a title for your collection of bookmarks
* `"defaultquery"`: a string to set a default query (without the `?`), which can be used to start with a non-default order or a filter
* `"filter"`: an object to define default filters, the keys are the labels, the values the query strings (it should include an entry like `"all": ""` for the empty filter)
* `"autotags"`: an object to automatically add tags to bookmarks, the keys of this object are the labels of the tags, the values define the functions which check whether to add the tag to a bookmark
* `"extralinks"`: an object to automatically add extra links to bookmarks, the keys of this object are the labels of the links, the values define the functions which generate the links for a bookmark

The functions for `autotags` and `extralinks` are given as arrays, the first entry is the name of the function, the other entries the parameters. The following functions exist:

For `"autotags"`:
* `"urlStartsWith"`: adds the tag if the URL starts with any of the following parameters

For `"extralinks"`:
* `"replaceIfStartsWith"`: add an extra link if the URL starts with the first parameter, the new link is the second parameter, which can contain placeholders `$0` for the whole original URL and `$1` for the part after the initial string
* `"replaceIfMatches"`: add an extra link if the URL matches the regular expression given as string in the first parameter, the new link is in the second parameter, which can contain placeholders `$0` for the whole original URL, and `$1` etc. for captured groups
* `"addParam"`: add an extra link if the URL has as path the first parameter, adding or changing a parameter in the query, where the name of the parameter is given in the second parameter and its (new) value in the third

For both:
* `"disabled"`: ignores any parameters and never adds the tag or an extra link, meant to disable an entry without deleting it

### Examples

The following code contains many examples to the above documentation, which you can adapt to your situation.

```json
"meta": {
	"autotags": {
		"Some Site": [
			"urlStartsWith",
			"https://some-site.example/"
		]
	},
	"extralinks": {
		"alternative site": [
			"replaceIfStartsWith",
			"https://some-site.example/",
			"https://alternative-site.example/$1"
		],
		"edit item": [
			"replaceIfMatches",
			"^https://some-site.example/view.php\\?id=(\\w+)$",
			"http://some-site.example/edit.php?id=$1"
		],
		"recently added": [
			"addParam",
			"https://some-site.example/search.php",
			"sort",
			"-addeddate"
		]
	},
	"defaultquery": "sort=stars-desc",
	"filter": {
		"all": "",
		"Some Site": "includeTags=Some%20Site",
		"4+ stars": "minStars=4"
	}
}
```