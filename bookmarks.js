function htmlEscape (str) {
	"use strict";
	return String(str)
		.replace(/&/g, '&amp;').replace(/"/g, '&quot;')
		.replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function clone (data) {
	"use strict";
	return JSON.parse(JSON.stringify(data));
}

function dataToQuery (data) {
	"use strict";
	return Object.keys(data).map(function (key) {
		var val = data[key];
		if (Array.isArray(val)) {
			val = val.join('\n');
		}
		return val ? key + '=' + encodeURIComponent(val) : '';
	}).filter(function (entry) {
		return entry;
	}).join('&');
}

var autoContent =
(function () {
"use strict";

var extraLinksHandler = {}, autoTagsHandler = {}, internalCallbacks = {};

function testStartsWith (needle, haystack) {
	if (haystack.slice(0, needle.length) === needle) {
		return [haystack, haystack.slice(needle.length)];
	}
}

function testMatchesRe (re, haystack) {
	re = new RegExp(re);
	return re.exec(haystack);
}

function fillPlaceholders (template, data) {
	return template.replace(/\$(\$|\d+)/g, function (all, n) {
		if (n === '$' || n >= data.length) {
			return n;
		}
		return data[n];
	});
}

function makeCallback (data) {
	var fn = data.shift();
	switch (fn) {
	case 'urlStartsWith':
		return function (entry) {
			var i;
			for (i = 0; i < data.length; i++) {
				if (testStartsWith(data[i], entry.url)) {
					return true;
				}
			}
			return false;
		};
	case 'replaceIfStartsWith':
		return function (url) {
			var result = testStartsWith(data[0], url);
			if (result) {
				return fillPlaceholders(data[1], result);
			}
		};
	case 'replaceIfMatches':
		return function (url) {
			var result = testMatchesRe(data[0], url);
			if (result) {
				return fillPlaceholders(data[1], result);
			}
		};
	case 'addParam':
		return function (url) {
			//TODO allow hash?
			var base = data[0], param = data[1], value = data[2],
				pv = param + '=' + value, parts, added;
			if (url === base) {
				return url + '?' + pv;
			}
			if (url.slice(0, base.length + 1) === base + '?') {
				parts = url.split(/(\?|&)/);
				if (parts.indexOf(pv) === -1) {
					parts = parts.map(function (entry) {
						if (entry.slice(0, param.length + 1) === param + '=') {
							added = true;
							return pv;
						}
						return entry;
					});
					if (!added) {
						parts.push('&' + pv);
					}
					return parts.join('');
				}
			}
		};
	case 'internal': //currently not in use
		if (internalCallbacks[data[0]]) {
			return internalCallbacks[data[0]];
		}
		throw new Error('Unknown internal function "' + data[0] + '"');
	case 'disabled': return function () {};
	default: throw new Error('Unknown function "' + fn + '"');
	}
}

function registerExtraLinkHandler (label, callback) {
	extraLinksHandler[label] = callback;
}

function registerExtraLinks (data) {
	Object.keys(data).forEach(function (tag) {
		registerExtraLinkHandler(tag, makeCallback(data[tag]));
	});
}

function getExtraLinks (url) {
	var extra = {};
	Object.keys(extraLinksHandler).forEach(function (label) {
		var extraUrl = extraLinksHandler[label](url);
		if (extraUrl) {
			extra[label] = extraUrl;
		}
	});
	return extra;
}

function registerAutoTagHandler (tag, callback) {
	autoTagsHandler[tag] = callback;
}

function registerAutoTags (data) {
	Object.keys(data).forEach(function (tag) {
		registerAutoTagHandler(tag, makeCallback(data[tag]));
	});
}

function getAutoTags () {
	return Object.keys(autoTagsHandler);
}

function getExtraTags (entry) {
	if (!entry.url) {
		return [];
	}
	return getAutoTags().filter(function (tag) {
		return autoTagsHandler[tag](entry);
	});
}

function getTags (entry) {
	var tags = entry.tags ? entry.tags.slice() : [];
	getExtraTags(entry).forEach(function (tag) {
		if (tags.indexOf(tag) === -1) {
			tags.push(tag);
		}
	});
	return tags;
}

return {
	registerExtraLinks: registerExtraLinks,
	getExtraLinks: getExtraLinks,
	registerAutoTags: registerAutoTags,
	getAutoTags: getAutoTags,
	getExtraTags: getExtraTags,
	getTags: getTags
};

})();

var dataManager =
(function () {
"use strict";

var data = {
	meta: {title: ''},
	data: []
}, usesFieldCache, undoData0, undoData1;

function init (input) {
	if (!input) {
		try {
			data = JSON.parse(sessionStorage.getItem('bookmark-data') || 'x');
		} catch (e) {
		}
	} else {
		data = input;
		save();
	}
	undoData0 = clone(data);
	undoData1 = clone(data);
	usesFieldCache = {};
}

function save () {
	try {
		sessionStorage.setItem('bookmark-data', JSON.stringify(data));
	} catch (e) {
	}
	undoData0 = undoData1;
	undoData1 = clone(data);
	usesFieldCache = {};
}

function get (inclMeta) {
	return inclMeta ? data : data.data;
}

function getIndexByUrl (url) {
	var i;
	for (i = 0; i < data.data.length; i++) {
		if (data.data[i].url === url) {
			return i;
		}
	}
	return -1;
}

function getByUrl (url) {
	return data.data[getIndexByUrl(url)];
}

function undo () {
	data = undoData0;
	save();
}

function remove (url) {
	data.data = data.data.filter(function (entry) {
		return entry.url !== url;
	});
	save();
}

function update (entry, url) {
	var i = getIndexByUrl(url || entry.url);
	if (i === -1) {
		data.data.push(entry);
	} else {
		data.data[i] = entry;
	}
	save();
}

function swap (url0, url1) {
	var i0, i1, o0, o1;
	i0 = getIndexByUrl(url0);
	i1 = getIndexByUrl(url1);
	if (i0 === -1 || i1 === -1) {
		return;
	}
	o0 = data.data[i0];
	o1 = data.data[i1];
	data.data[i0] = o1;
	data.data[i1] = o0;
	save();
}

function group (url, urls) {
	var pre = [], med = [], post = [], isPre = true;
	data.data.forEach(function (entry) {
		if (urls.indexOf(entry.url) > -1) {
			if (entry.url === url) {
				isPre = false;
			}
			med.push(entry);
		} else if (isPre) {
			pre.push(entry);
		} else {
			post.push(entry);
		}
	});
	data.data = pre.concat(med, post);
	save();
}

function usesField (field) {
	var i;
	if (field in usesFieldCache) {
		return usesFieldCache[field];
	}
	if (
		(field === 'tags' && data.meta.autotags) ||
		(field === 'extraLinks' && data.meta.extralinks)
	) {
		usesFieldCache[field] = true;
		return true;
	}
	for (i = 0; i < data.data.length; i++) {
		if (data.data[i][field]) {
			usesFieldCache[field] = true;
			return true;
		}
	}
	usesFieldCache[field] = false;
	return false;
}

return {
	init: init,
	get: get,
	getIndexByUrl: getIndexByUrl,
	getByUrl: getByUrl,
	undo: undo,
	remove: remove,
	update: update,
	swap: swap,
	group: group,
	usesField: usesField
};

})();

var formatList =
(function () {
"use strict";

//based on code from QUnit
function getColor (text) {
	/*jshint bitwise: false*/
	var hex, i, hash = 0;

	for (i = 0; i < text.length; i++) {
		hash = ((hash << 5) - hash) + text.charCodeAt(i);
		hash |= 0;
	}

	hex = '00000' + (0x100000000 + hash).toString(16);
	return '#' + hex.slice(-6);
}

function makeLink (url, label) {
	return '<a href="' + htmlEscape(url) + '" rel="noopener" target="_blank">' + htmlEscape(label || url) + '</a>';
}

function formatDesc (desc) {
	return '<p>' + htmlEscape(desc).replace(/\n\n+/g, '</p><p>').replace(/\n/g, '<br>') + '</p>';
}

function formatExtraLinks (url, extra) {
	var links = autoContent.getExtraLinks(url), html = [];
	Object.keys(extra).forEach(function (link) {
		html.push('<li>' + makeLink(extra[link], link) + '</li>');
	});
	Object.keys(links).forEach(function (link) {
		html.push('<li>' + makeLink(links[link], link) + '</li>');
	});
	return '<ul>' + html.join('') + '</ul>';
}

function formatStars (stars) {
	var full = '★', empty = '☆', i, html = [];
	if (!stars) {
		return '';
	}
	for (i = 1; i <= 5; i++) {
		html.push(i <= stars ? full : empty);
	}
	return '<p><data value="' + stars + '/5" class="stars">' + html.join('') + '</data></p>';
}

function formatTagCloud (tags) {
	return '<ul class="tag-cloud">' + tags.map(function (tag) {
		return '<li style="border-color: ' + getColor(tag) + ';" data-tag="' + htmlEscape(tag) + '">' + htmlEscape(tag) + '</li>';
	}).join('') + '</ul>';
}

function formatEntry (entry, move, urls) {
	var button;
	if (move) {
		button = '<span class="button-group">';
		button += '<button class="move-button" ';
		if (move[0]) {
			button += 'data-url0="' + htmlEscape(entry.url) + '" data-url1="' + htmlEscape(move[0].url) + '"';
		} else {
			button += 'disabled';
		}
		button += '>←</button>';
		button += '<button class="group-button" data-url="' + htmlEscape(entry.url) + '" data-urls="' + htmlEscape(urls) + '">↓</button>';
		button += '<button class="move-button" ';
		if (move[1]) {
			button += 'data-url0="' + htmlEscape(entry.url) + '" data-url1="' + htmlEscape(move[1].url) + '"';
		} else {
			button += 'disabled';
		}
		button += '>→</button>';
		button += '</span>';
	} else {
		button = '<button class="edit-button" data-url="' + htmlEscape(entry.url) + '">✎</button>';
	}
	return '<li class="entry">' +
		button +
		'<h2>' + makeLink(entry.url, entry.title) + '</h2>' +
		(entry.img ? '<img src="' + htmlEscape(entry.img) + '">' : '') +
		(entry.desc ? formatDesc(entry.desc) : '') +
		(entry.duration ? '<p>' + htmlEscape(entry.duration) + '</p>' : '') +
		formatExtraLinks(entry.url, entry.extraLinks || {}) +
		formatStars(entry.stars) +
		formatTagCloud(autoContent.getTags(entry)) +
		(entry.updated ? '<p><time>' + entry.updated + '</time></p>' : '') + '</li>';
}

function formatList (list, move) {
	var urls;
	if (move) {
		urls = list.map(function (entry) {
			return entry.url;
		}).join('\n');
	}
	return '<ul class="list">' + list.map(function (entry, i) {
		return formatEntry(entry, move ? [list[i - 1], list[i + 1]] : false, urls);
	}).join('') + '</ul>';
}

return formatList;
})();

var formatPage =
(function () {
"use strict";

function testFilter (entry, filter) {
	var all, i, found;

	function testMinMaxFilter (value, min, max) {
		if (min) {
			if (!value || value < min) {
				return false;
			}
		}
		if (max) {
			if (!value || value > max) {
				return false;
			}
		}
		return true;
	}

	if (filter.text) {
		all = [
			entry.url,
			entry.title,
			entry.desc || ''
		].join('\n') + '\n' +
		autoContent.getTags(entry).join('\n');
		if (filter.text.toLowerCase() === filter.text) {
			all = all.toLowerCase();
		}
		if (all.indexOf(filter.text) === -1) {
			return false;
		}
	}
	if (filter.img) {
		if (filter.img > 0 && !entry.img) {
			return false;
		}
		if (filter.img < 0 && entry.img) {
			return false;
		}
	}
	if (!testMinMaxFilter(entry.duration, filter.minDuration, filter.maxDuration)) {
		return false;
	}
	if (!testMinMaxFilter(entry.stars, filter.minStars, filter.maxStars)) {
		return false;
	}
	if (filter.includeTags) {
		all = autoContent.getTags(entry);
		for (i = 0; i < filter.includeTags.length; i++) {
			if (all.indexOf(filter.includeTags[i]) === -1) {
				return false;
			}
		}
	}
	if (filter.anyTags) {
		all = autoContent.getTags(entry);
		found = false;
		for (i = 0; i < filter.anyTags.length; i++) {
			if (all.indexOf(filter.anyTags[i]) !== -1) {
				found = true;
				break;
			}
		}
		if (!found) {
			return false;
		}
	}
	if (filter.excludeTags) {
		all = autoContent.getTags(entry);
		for (i = 0; i < filter.excludeTags.length; i++) {
			if (all.indexOf(filter.excludeTags[i]) !== -1) {
				return false;
			}
		}
	}
	if (!testMinMaxFilter(entry.updated, filter.minUpdated, filter.maxUpdated)) {
		return false;
	}
	return true;
}

function filterList (list, filter) {
	return filter ? list.filter(function (entry) {
		return testFilter(entry, filter);
	}) : list;
}

function filterExplain (filter) {
	var texts = [];

	function addTextsForMinMaxFilter (label, min, max) {
		if (min && max) {
			if (min === max) {
				texts.push(label + ': ' + min);
			} else {
				texts.push(label + ' ' + min + '–' + max);
			}
		} else if (min) {
			texts.push(label + ' ≥' + min);
		} else if (max) {
			texts.push(label + ' ≤' + max);
		}
	}

	if (filter.text) {
		texts.push('Search for “' + filter.text + '”');
	}
	if (filter.img > 0) {
		texts.push('With image');
	} else if (filter.img < 0) {
		texts.push('Without image');
	}
	addTextsForMinMaxFilter('Duration', filter.minDuration, filter.maxDuration);
	addTextsForMinMaxFilter('Stars', filter.minStars, filter.maxStars);
	if (filter.includeTags && filter.includeTags.length) {
		texts.push('Tags: ' + filter.includeTags.join(', '));
	}
	if (filter.anyTags && filter.anyTags.length) {
		texts.push('Any tags: ' + filter.anyTags.join(', '));
	}
	if (filter.excludeTags && filter.excludeTags.length) {
		texts.push('Excluded tags: ' + filter.excludeTags.join(', '));
	}
	addTextsForMinMaxFilter('Updated', filter.minUpdated, filter.maxUpdated);
	return texts.join('; ') || 'No filter';
}

function makeCompare (order) {
	var key = order.replace(/-.*/, ''), comp = order.indexOf('-desc') > -1 ? 1 : -1;

	return function (a, b) {
		a = String(a[key] || '').toLowerCase();
		b = String(b[key] || '').toLowerCase();
		if (a === b) {
			return 0;
		}
		if (a < b) {
			return comp;
		}
		return -comp;
	};
}

function sortList (list, order) {
	if (!order || order === 'reorder') {
		return list;
	}
	if (order === 'random') {
		list.forEach(function (entry) {
			entry.random = Math.random();
		});
	}
	list.sort(makeCompare(order));
	if (order === 'random') {
		list.forEach(function (entry) {
			delete entry.random;
		});
	}
	return list;
}

function formatStats (list, ignoreTags) {
	var duration = {sum: 0, count: 0},
		stars = {sum: 0, count: 0},
		updated = {sum: 0, count: 0},
		tags = {},
		tagList,
		stats = [];

	function addMinMaxStat (value, data) {
		if (data.count === 0) {
			data.min = value;
			data.max = value;
		} else {
			data.min = Math.min(data.min, value);
			data.max = Math.max(data.max, value);
		}
		data.sum += value;
		data.count++;
	}

	function formatMinMaxStat (label, data, formatter) {
		return label + ' (' + data.count + '): Min.: ' + formatter(data.min) + '; Avg.: ' + formatter(data.sum / data.count) + '; Max.: ' + formatter(data.max);
	}

	list.forEach(function (entry) {
		var d;
		if (entry.duration) {
			d = entry.duration.split(':');
			d = d[0] * 60 + Number(d[1]);
			addMinMaxStat(d, duration);
		}
		if (entry.stars) {
			addMinMaxStat(entry.stars, stars);
		}
		if (entry.updated) {
			d = Math.round(((new Date((new Date()).toISOString().slice(0, 10))) - (new Date(entry.updated))) / 86400000);
			addMinMaxStat(d, updated);
		}
		autoContent.getTags(entry).forEach(function (tag) {
			if (ignoreTags.indexOf(tag) === -1) {
				tags[tag] = (tags[tag] || 0) + 1;
			}
		});
	});
	if (duration.count) {
		stats.push(formatMinMaxStat('Duration', duration, function (s) {
			return Math.floor(s / 60) + ':' + String(Math.round(s % 60) + 100).slice(-2);
		}));
	}
	if (stars.count) {
		stats.push(formatMinMaxStat('Stars', stars, function (s) {
			return Math.round(10 * s) / 10;
		}));
	}
	if (updated.count) {
		stats.push(formatMinMaxStat('Updated x days ago', updated, function (d) {
			return Math.round(d);
		}));
	}
	tagList = Object.keys(tags).filter(function (tag) {
		return tags[tag] > 1;
	});
	tagList.sort(function (a, b) {
		return tags[b] - tags[a];
	});
	if (tagList.length > 5) {
		tagList.length = 5;
	}
	if (tagList.length) {
		stats.push('Tags: ' + tagList.map(function (tag) {
			return htmlEscape(tag) + ' (' + tags[tag] + ', ' + Math.round(100 * tags[tag] / list.length) + ' %)';
		}).join(', '));
	}
	return stats.length ? '<p>' + stats.join('<br>') + '</p>' : '';
}

function formatSort (order) {
	function makeOption (label, value) {
		return '<option value="' + value + '"' + (order === value ? ' selected' : '') + '>' + label + '</option>';
	}
	return '<label>Sort by: <select id="sort-select">' +
		makeOption('none', '') +
		makeOption('Random', 'random') +
		makeOption('Title', 'title') +
		(dataManager.usesField('duration') ? makeOption('Duration', 'duration') +
		makeOption('Duration (desc.)', 'duration-desc') : '') +
		(dataManager.usesField('stars') ? makeOption('Stars', 'stars') +
		makeOption('Stars (desc.)', 'stars-desc') : '') +
		(dataManager.usesField('updated') ? makeOption('Updated', 'updated') +
		makeOption('Updated (desc.)', 'updated-desc') : '') +
		(dataManager.usesField('tags') ? makeOption('Tags', 'tags') : '') +
		makeOption('Reorder', 'reorder') +
		'</select></label>';
}

function formatFilter (filter) {
	var addCustom, options;
	function makeOption (label, value) {
		if (filter === value) {
			addCustom = false;
		}
		return '<option value="' + value + '"' + (filter === value ? ' selected' : '') + '>' + label + '</option>';
	}

	addCustom = true;
	options = dataManager.get(true).meta.filter;
	if (!options) {
		return '';
	}
	filter = dataToQuery(filter);

	return '<label>Filter: <select id="filter-select">' +
		Object.keys(options).map(function (label) {
			return makeOption(label, options[label]);
		}).join('') +
		(addCustom ? makeOption('custom', filter) : '') +
		'</select></label>';
}

function formatPanel (filter, count, order) {
	return '<p id="panel">' + htmlEscape(filterExplain(filter || {})) + ' (' + count + ') ' +
		formatSort(order) + ' ' +
		formatFilter(filter) +
		(Object.keys(filter).length ? '<button id="clear-filter-button">Clear filters</button> ' : '') +
		'<button id="filter-button">Apply filter</button> ' +
		'<button id="add-button">Add</button> ' +
		'<button id="undo-button">Undo</button> ' +
		'<button id="export-button">Export</button></p>';
}

function formatPage (data, filter, order) {
	var list = sortList(filterList(data, filter), order);
	return formatPanel(filter, list.length, order) + formatStats(list, filter.includeTags || []) + formatList(list, order === 'reorder');
}

return formatPage;
})();

var formatFilter =
(function () {
"use strict";

function formatImageSelect (value) {
	var html = [];
	html.push('<p><label>Image: <select name="img">');
	html.push('<option value="">all</option>');
	html.push('<option value="1"' + (value > 0 ? ' selected' : '') + '>with image</option>');
	html.push('<option value="-1"' + (value < 0 ? ' selected' : '') + '>without image</option>');
	html.push('</select></label></p>');
	return html.join('');
}

function getAllTags (data) {
	var tags = [];
	data.forEach(function (entry) {
		var i;
		if (entry.tags) {
			for (i = 0; i < entry.tags.length; i++) {
				if (tags.indexOf(entry.tags[i]) === -1) {
					tags.push(entry.tags[i]);
				}
			}
		}
	});
	autoContent.getAutoTags().forEach(function (tag) {
		if (tags.indexOf(tag) === -1) {
			tags.push(tag);
		}
	});
	tags.sort();
	return tags;
}

function formatTagSelect (tags, selectedTags, mode) {
	var label = {include: 'Tags', any: 'Any tags', exclude: 'Excluded tags'}[mode],
		name = mode + 'Tags';
	return '<p><label>' + label + ': <select name="' + name + '" multiple>' +
		tags.map(function (tag) {
			return '<option' + (selectedTags.indexOf(tag) > -1 ? ' selected' : '') + '>' + htmlEscape(tag) + '</option>';
		}).join('') +
		'</select></label></p>';
}

function formatFilter (data, filter) {
	var tags = getAllTags(data);
	return '<form id="filter-form">' +
		'<p><label>Search: <input name="text" value="' + htmlEscape(filter.text || '') + '"></label></p>' +
		(dataManager.usesField('img') ? formatImageSelect(filter.img) : '') +
		(dataManager.usesField('duration') ? '<p><label>Min. duration: <input name="minDuration" value="' + htmlEscape(filter.minDuration || '') + '"></label> ' +
		'<label>Max. duration: <input name="maxDuration" value="' + htmlEscape(filter.maxDuration || '') + '"></label></p>' : '') +
		(dataManager.usesField('stars') ? '<p><label>Min. stars: <input name="minStars" type="number" min="1" max="5" value="' + htmlEscape(filter.minStars || '') + '"></label> ' +
		'<label>Max. stars: <input name="maxStars" type="number" min="1" max="5" value="' + htmlEscape(filter.maxStars || '') + '"></label></p>' : '') +
		(dataManager.usesField('updated') ? '<p><label>Min. updated: <input name="minUpdated" type="date" value="' + htmlEscape(filter.minUpdated || '') + '"></label> ' +
		'<label>Max. updated: <input name="maxUpdated" type="date" value="' + htmlEscape(filter.maxUpdated || '') + '"></label></p>' : '') +
		(dataManager.usesField('tags') ? formatTagSelect(tags, filter.includeTags || [], 'include') +
		formatTagSelect(tags, filter.anyTags || [], 'any') +
		formatTagSelect(tags, filter.excludeTags || [], 'exclude') : '') +
		'<p><button>Update</button> ' +
		'<button type="button" class="cancel">Cancel</button></p>' +
		'</form>';
}

return formatFilter;
})();

var blobToImgUrl =
(function () {
"use strict";

function makeImgUrl (img) {
	var canvas = document.createElement('canvas'),
		context = canvas.getContext('2d'),
		WIDTH = 128, HEIGHT = 128, s;
	canvas.width = WIDTH;
	canvas.height = HEIGHT;
	s = Math.min(1, WIDTH / img.width, HEIGHT / img.height);
	context.fillStyle = '#fff';
	context.fillRect(0, 0, WIDTH, HEIGHT);
	context.drawImage(img, 0, 0, s * img.width, s * img.height);
	return canvas.toDataURL('image/jpeg', 0.8);
}

function blobToImgUrl (blob, callback, noScale) {
	var img = new Image(), reader = new FileReader();
	img.addEventListener('load', function () {
		callback(makeImgUrl(img));
	});
	reader.addEventListener('load', function () {
		if (noScale) {
			callback(reader.result);
		} else {
			img.src = reader.result;
		}
	});
	reader.readAsDataURL(blob);
}

return blobToImgUrl;
})();

function formatEdit (entry) {
	"use strict";
	var extraTags = autoContent.getExtraTags(entry);
	if (extraTags.length) {
		extraTags = '<br>Auto tags: ' + htmlEscape(extraTags.join(', '));
	} else {
		extraTags = '';
	}
	return '<form id="edit-form">' +
		'<input type="hidden" name="oldUrl" value="' + htmlEscape(entry.url || '') + '">' +
		'<p><label>URL: <input type="url" required name="url" value="' + htmlEscape(entry.url || '') + '"></label></p>' +
		'<p><label>Title: <input name="title" required value="' + htmlEscape(entry.title || '') + '"></label></p>' +
		'<p><label>Description: <textarea name="desc">' + htmlEscape(entry.desc || '') + '\n</textarea></label></p>' +
		'<input type="hidden" name="img" value="' + htmlEscape(entry.img || '') + '">' +
		'<p><div id="img-drop"><img id="img" src="' + htmlEscape(entry.img || '') + '"></div>' +
		'<button type="button" id="img-load-button">Load image</button> <button type="button" id="img-remove-button">Remove image</button></p>' +
		'<p><label>Extra links (one per line, optionally followed by a title after a space):' +
		'<textarea name="links">' + htmlEscape(Object.keys(entry.extraLinks || {}).map(function (title) {
			var link = entry.extraLinks[title];
			return link + (title !== link ? ' ' + title : '');
		}).join('\n')) + '\n</textarea></label></p>' +
		'<p><label>Duration: <input name="duration" value="' + htmlEscape(entry.duration || '') + '"></label></p>' +
		'<p><label>Stars: <input name="stars" type="number" min="1" max="5" value="' + htmlEscape(entry.stars || '') + '"></label></p>' +
		'<input type="hidden" name="updated" value="' + htmlEscape(entry.updated || '') + '">' +
		'<p><label><input type="checkbox" name="updateUpdated"' + (entry.updated ? ' checked' : '') + '> Include time of last update</label></p>' +
		'<p><label>Tags (one per line):' +
		'<textarea name="tags">' + htmlEscape((entry.tags || []).join('\n') + '\n') + '</textarea></label>' + extraTags + '</p>' +
		'<p><button>Save</button> ' +
		(entry.url ? '<button type="button" id="remove-button">Remove</button> ' : '') +
		'<button type="button" class="cancel">Cancel</button></p>' +
		'</form>';
}

var unsavedData =
(function () {
"use strict";

var savedUnloadHandler,
	hasUnsavedData = false;

function confirmClose () {
	window.onbeforeunload = function () {
		savedUnloadHandler = window.onbeforeunload;
		window.onbeforeunload = null;
		setTimeout(function () {
			window.onbeforeunload = savedUnloadHandler;
		}, 1);
		return 'There are unsaved changes! Leave anyway?';
	};
}

function noConfirmClose () {
	window.onbeforeunload = null;
}

function setUnsaved () {
	if (!hasUnsavedData) {
		hasUnsavedData = true;
		document.title = '* ' + document.title;
		confirmClose();
	}
}

function setSaved () {
	if (hasUnsavedData) {
		hasUnsavedData = false;
		document.title = document.title.slice(2);
		noConfirmClose();
	}
}

window.addEventListener('pageshow', function () {
	if (!window.onbeforeunload && savedUnloadHandler) {
		window.onbeforeunload = savedUnloadHandler;
	}
});

return function (unsaved) {
	if (unsaved) {
		setUnsaved();
	} else {
		setSaved();
	}
};
})();

var init =
(function () {
"use strict";

function getUrlParam (key) {
	var re = new RegExp('^[^#]*[&?]' + key + '=([^&#]*)'),
		m = re.exec(location.href);

	if (m) {
		return decodeURIComponent(m[1].replace(/\+/g, '%20'));
	}
	return null;
}

function getFilter () {
	var filter = {};

	function add (key, array) {
		var val = getUrlParam(key);
		if (val) {
			filter[key] = array ? val.split('\n') : val;
		}
	}

	add('text');
	add('img');
	add('minDuration');
	add('maxDuration');
	add('minStars');
	add('maxStars');
	add('minUpdated');
	add('maxUpdated');
	add('includeTags', true);
	add('anyTags', true);
	add('excludeTags', true);
	return filter;
}

function getSort () {
	return getUrlParam('sort');
}

function getEntry () {
	var url = getUrlParam('url'), oldEntry;
	if (!url) {
		return {};
	}
	oldEntry = dataManager.getByUrl(url) || {};
	return {
		url: url,
		title: getUrlParam('title') || oldEntry.title,
		desc: getUrlParam('desc') || oldEntry.desc,
		img: getUrlParam('img') || oldEntry.img,
		extraLinks: oldEntry.extraLinks,
		duration: getUrlParam('duration') || oldEntry.duration,
		stars: getUrlParam('stars') || oldEntry.stars,
		updated: getUrlParam('updated') || oldEntry.updated,
		tags: (getUrlParam('tags') || (oldEntry.tags || []).join('\n')).split('\n')
	};
}

function showList () {
	document.body.innerHTML = formatPage(dataManager.get(), getFilter(), getSort());
}

function showFilter () {
	document.body.innerHTML = formatFilter(dataManager.get(), getFilter());
}

function showEdit () {
	document.body.innerHTML = formatEdit(getEntry());
}

function showExport () {
	var data = dataManager.get(true);
	updateUrl({data: JSON.stringify(data)}, true);
	document.body.innerHTML = '<p class="no-select"><button class="cancel">Back</button></p><pre>' + htmlEscape(JSON.stringify(data, null, '\t')) + '</pre>';
	unsavedData(false);
}

function show () {
	switch (getUrlParam('action') || 'list') {
	case 'list': showList(); break;
	case 'filter': showFilter(); break;
	case 'edit': showEdit(); break;
	}
}

function updateUrl (data, noShow) {
	var search = typeof data === 'string' ? data : dataToQuery(data);
	history.pushState('', '', search ? '?' + search : String(location.href).replace(/\?.*/, ''));
	if (!noShow) {
		show();
	}
}

function serializeForm (form) {
	var data = {}, elements = form.querySelectorAll('[name]'), i;

	function getValue (element) {
		var value, options, i;
		if (element.type === 'select-multiple') {
			value = [];
			options = element.getElementsByTagName('option');
			for (i = 0; i < options.length; i++) {
				if (options[i].selected) {
					value.push(options[i].value);
				}
			}
			return value.join('\n');
		}
		if (element.type === 'checkbox') {
			return element.checked;
		}
		return element.value.trim();
	}

	for (i = 0; i < elements.length; i++) {
		data[elements[i].name] = getValue(elements[i]);
	}
	return data;
}

function getDefaultParams () {
	var data = getFilter();
	data.sort = getSort();
	return data;
}

function openFile (callback) {
	var pick = document.createElement('input');
	pick.type = 'file';
	pick.style.display = 'none';
	document.getElementsByTagName('body')[0].appendChild(pick);
	pick.addEventListener('change', function () {
		if (pick.files[0]) {
			callback(pick.files[0]);
		}
		document.getElementsByTagName('body')[0].removeChild(pick);
	});
	pick.click();
}

function tagClick (e, tag, data) {
	if (e.shiftKey) {
		if (data.includeTags && data.includeTags.indexOf(tag) > -1) {
			data.includeTags = data.includeTags.filter(function (included) {
				return included !== tag;
			});
		}
		if (data.anyTags && data.anyTags.indexOf(tag) > -1) {
			data.anyTags = data.anyTags.filter(function (included) {
				return included !== tag;
			});
		}
		if (!data.excludeTags) {
			data.excludeTags = [];
		}
		data.excludeTags.push(tag);
	} else if (e.ctrlKey) {
		if (!data.includeTags) {
			data.includeTags = [];
		}
		data.includeTags.push(tag);
	} else {
		data.includeTags = [tag];
		delete data.anyTags;
		delete data.excludeTags;
	}
	updateUrl(data);
}

function setImgUrl (url) {
	document.getElementById('img').src = url;
	document.querySelector('[name="img"]').value = url;
}

function init () {
	var data = getUrlParam('data'), meta;
	if (data) {
		try {
			dataManager.init(JSON.parse(data));
		} catch (e) {
			dataManager.init();
		}
	} else {
		dataManager.init();
	}
	meta = dataManager.get(true).meta;
	if (meta.title) {
		document.title = meta.title;
	}
	if (meta.autotags) {
		autoContent.registerAutoTags(clone(meta.autotags));
	}
	if (meta.extralinks) {
		autoContent.registerExtraLinks(clone(meta.extralinks));
	}
	if (meta.defaultquery) {
		updateUrl(meta.defaultquery);
	} else {
		show();
	}
	window.addEventListener('popstate', show);
	document.addEventListener('click', function (e) {
		var target = e.target, data = getDefaultParams(), form;
		if (target.id === 'filter-button') {
			data.action = 'filter';
			updateUrl(data);
		} else if (target.id === 'add-button') {
			data.action = 'edit';
			updateUrl(data);
		} else if (target.id === 'undo-button') {
			dataManager.undo();
			unsavedData(true);
			show();
		} else if (target.id === 'export-button') {
			showExport();
		} else if (target.id === 'clear-filter-button') {
			updateUrl(data.sort ? {sort: data.sort} : {});
		} else if (target.id === 'remove-button') {
			form = serializeForm(document.getElementById('edit-form'));
			if (form.oldUrl === form.url && window.confirm('Really remove "' + form.title + '"?')) {
				dataManager.remove(form.url);
				unsavedData(true);
			}
			updateUrl(data);
		} else if (target.id === 'img-load-button') {
			openFile(function (file) {
				blobToImgUrl(file, function (url) {
					setImgUrl(url);
				});
			});
		} else if (target.id === 'img-remove-button') {
			setImgUrl('');
		} else if (target.className === 'edit-button') {
			data.url = target.dataset.url;
			data.action = 'edit';
			updateUrl(data);
		} else if (target.className === 'move-button') {
			dataManager.swap(target.dataset.url0, target.dataset.url1);
			unsavedData(true);
			show();
		} else if (target.className === 'group-button') {
			dataManager.group(target.dataset.url, target.dataset.urls.split('\n'));
			unsavedData(true);
		} else if (target.className === 'cancel') {
			updateUrl(data);
		} else if (target.dataset.tag) {
			tagClick(e, target.dataset.tag, data);
		}
	});
	document.addEventListener('dragover', function (e) {
		if (e.target.id === 'img-drop') {
			e.preventDefault();
		}
	});
	document.addEventListener('drop', function (e) {
		if (e.target.id === 'img-drop') {
			var file;
			e.preventDefault();
			file = e.dataTransfer.files[0];
			if (file) {
				blobToImgUrl(file, function (url) {
					setImgUrl(url);
				});
			}
			//TODO try url from e.dataTransfer.getData('text/plain')
		}
	});
	document.addEventListener('submit', function (e) {
		var form = serializeForm(e.target), entry, data;
		if (e.target.id === 'edit-form') {
			entry = {};
			entry.url = form.url;
			entry.title = form.title;
			if (form.desc) {
				entry.desc = form.desc;
			}
			if (form.img) {
				entry.img = form.img;
			}
			if (form.duration) {
				entry.duration = form.duration;
			}
			if (form.stars) {
				entry.stars = Number(form.stars);
			}
			if (form.updateUpdated) {
				entry.updated = (new Date()).toISOString().slice(0, 10);
			} else if (form.updated) {
				entry.updated = form.updated;
			}
			if (form.links) {
				entry.extraLinks = {};
				form.links.split('\n').forEach(function (line) {
					var space, link, title, i;
					if (!line) {
						return;
					}
					space = line.indexOf(' ');
					if (space === -1) {
						link = line;
						title = line;
					} else {
						link = line.slice(0, space);
						title = line.slice(space + 1);
					}
					if (entry.extraLinks[title]) {
						i = 1;
						while (entry.extraLinks[title + ' (' + i + ')']) {
							i++;
						}
						title += ' (' + i + ')';
					}
					entry.extraLinks[title] = link;
				});
			}
			if (form.tags) {
				entry.tags = form.tags.split('\n').filter(function (tag) {
					return tag;
				});
			}
			dataManager.update(entry, form.oldUrl);
			unsavedData(true);
			data = getDefaultParams();
		} else if (e.target.id === 'filter-form') {
			data = form;
			data.sort = getSort();
		}
		e.preventDefault();
		updateUrl(data);
	});
	document.addEventListener('change', function (e) {
		var data, sort;
		if (e.target.id === 'sort-select') {
			data = getFilter();
			data.sort = e.target.value;
			updateUrl(data);
		} else if (e.target.id === 'filter-select') {
			data = e.target.value;
			sort = getSort();
			if (data && sort) {
				data = data + '&sort=' + sort;
			} else if (sort) {
				data = 'sort=' + sort;
			}
			updateUrl(data);
		}
	});
}

return init;
})();

init();