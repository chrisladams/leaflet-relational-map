function relationalMap(map_id) {

	// CHECK AND ALERT FOR DEPENDENCIES
	if (typeof L === 'undefined') {
	    console.log('Relational Map requires LeafletJS & Cluster Plugin');
	}
	if (typeof _ === 'undefined') {
	    console.log('Relational Map requires Lodash');
	}
	if (typeof jQuery === 'undefined') {
	    console.log('Relational Map requires jQuery');
	}

	var that = this;

	// OPTIONS / SETUP
	that.map = null;
	that.map_id = map_id;
	that.map_center = [38.0000,-97.0000];
	that.map_marker_layer = null;
	that.markers = [];
	that.objects = {};
	that.objects_mapped = [];
	that.object_html = '<img class="rel-map-img" src="{{image}}" />';
	that.view_text = 'View Profile';
	that.map_tile = 'http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
	that.map_tile_params = {
        maxZoom: 19,
        attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    };

    // USE DIV's INSTEAD OF UL/LI's
    that.useLists = true;

    // ADD OBJECT TYPE TO ARRAY
    that.addOjectType = function(key, color, objects) {
    	that.objects[key] = { color: color, objects: objects }
    	that.mapRelationships(that.objects);
    }

	that.createMap = function(withThumbnails) {
		if (typeof L !== 'undefined' && typeof jQuery !== 'undefined') {
			jQuery( "#" + that.map_id ).wrap( '<div class="relational-map-container"></div>' );
			jQuery( "#" + that.map_id ).wrap( '<div class="relational-map-wrapper"></div>' );
			that.map = L.map(that.map_id, { center: that.map_center, zoom: 5, scrollWheelZoom: false, zoomAnimation: true, fadeAnimation: true });
			L.tileLayer(that.map_tile, that.map_tile_params).addTo(that.map);
			that.createMarkers();
			if(withThumbnails !== undefined && withThumbnails){
				that.createThumbnailBars();
			}
		}
	}

	that.setTile = function(url,params) {
		that.map_tile = url;
		that.map_tile_params = params;
	}

	// MAP OBJECT DATA RELATIONSHIPS
	that.mapRelationships = function(objects_tmp) {
		var keys = Object.keys(objects_tmp);
		that.objects_mapped = {};
		jQuery.map(objects_tmp, function(obj,index){
			obj.objects = jQuery.map(obj.objects, function(o){
				o.related = {};
				for(i in keys) {
					if(o[keys[i]] !== undefined) {
						o.related[keys[i]] = _.filter(objects_tmp[keys[i]].objects,function(filter_obj){ return o[keys[i]].indexOf(filter_obj.id) !== -1; });
					}
				}
				return o;
			});
			that.objects_mapped[index] = obj;
		});
	}

	// CHECK MAP / MARKER BOUNDS
	that.checkMarkersInBounds = function() {
		that.map.on('moveend', function(e) {
			jQuery.each(that.markers,function(i, m) {
				var latLng = m.getLatLng();
				var mapWrap = jQuery( "#" + that.map_id ).closest('.relational-map-container');
				
				if(that.inBounds(latLng.lat,latLng.lng)){
					mapWrap.find('li.related-item[data-marker="'+i+'"]').removeClass('faded');
				} else {
					mapWrap.find('li.related-item[data-marker="'+i+'"]').addClass('faded');
				}
			});
		});
	}

	that.inBounds = function(lat,lng) {
		var bounds = that.map.getBounds();
		return bounds._southWest.lat <= lat && bounds._southWest.lng <= lng && bounds._northEast.lat >= lat && bounds._northEast.lng >= lng;
	}


	// POP UPS
	that.setObjectHtml = function(html) {
		that.object_html = html;
	}
	that.getObjectHtml = function(obj) {
		var output = that.object_html;
		output = output.replace(/{{link}}/g, obj.link);
		output = output.replace(/{{name}}/g, obj.name);
		output = output.replace(/{{image}}/g, obj.image);
		return output;
	}

	that.createMarkers = function(markerObjects) {
		var m = jQuery( "#" + that.map_id ).closest('.relational-map-container');
		var bounds = [];
		if(that.map_marker_layer !== null)
			that.map_marker_layer.clearLayers();
		that.map_marker_layer = new L.MarkerClusterGroup({ 
			showCoverageOnHover: false,
			iconCreateFunction: function(cluster) {
				var childCount = cluster.getChildCount();
				var children = cluster.getAllChildMarkers();

				var types = _.map(children, function(m){ return m._markerKey; });
				types = _.uniq(types);

				var c = ' ' + types.join(' ');// + ' marker-cluster-small';
				var cSize;
				if (childCount < 10) {
					cSize = new L.Point(40, 40);
				} else if (childCount < 15) {
					cSize = new L.Point(70, 70);
				} else {
					cSize = new L.Point(100, 100);
				}
				return new L.DivIcon({ html: '<div><span>' + childCount + '</span></div>', className: 'marker-cluster' + c, iconSize: cSize });
			}
		});

		if(markerObjects == undefined) {
			markerObjects = jQuery.extend({}, that.objects_mapped);
		}

		that.markers = [];
		jQuery.each(markerObjects,function(key, section) {
			jQuery.each(section.objects,function(obj_key, obj) {

				for(var loc_index = 0; loc_index < obj.locations.length; loc_index++) {
					bounds.push([ obj.locations[loc_index][0], obj.locations[loc_index][1] ]);

					var relListItemMarker = L.circleMarker([ obj.locations[loc_index][0], obj.locations[loc_index][1] ], {
					    color: section.color,
					    fillColor: section.color,
					    opacity: 0.8,
					    fillOpacity: 0.5
					});
					relListItemMarker._markerKey = key;
					relListItemMarker._markerData = obj;
					relListItemMarker.on('click', that.markerClickHandler);

					that.markers[that.markers.length] = relListItemMarker;
					that.map_marker_layer.addLayer(relListItemMarker).addTo(that.map);
				}
			});
		});

		that.map.fitBounds(bounds, {padding: [100,100], maxZoom: 4});
	}
	that.markerClickHandler = function(e){
		that.openRelationalPopup(e.target._markerData, e.target._markerKey);
	}

	// THUMBNAIL BAR
	that.createThumbnailBars = function() {
		var m = jQuery( "#" + that.map_id ).closest('.relational-map-container');

		m.find('ul.related-items-list').remove();

		jQuery.each(that.objects_mapped,function(key, section) {
			var relList = jQuery('<' + (that.useLists ? 'ul' : 'div') + ' />', {class: 'related-items-list '+key });
			m.append(relList);

			jQuery.each(section.objects,function(obj_key, obj) {
				var relListItem = jQuery('<' + (that.useLists ? 'li' : 'div') + ' />', {
					'class': 'related-item '+key, 
					'data-type': key,
					'data-id': obj.id
				}).html(that.getObjectHtml(obj));
				relList.append(relListItem);
			});
		});

		m.find('.related-item').unbind( "click" ).on('click', $.proxy(that.thumbnailClickHandler,this));
		that.checkMarkersInBounds();
	}
	that.thumbnailClickHandler = function(e){
		var type = jQuery(e.currentTarget).data('type');
		var id = jQuery(e.currentTarget).data('id');
		var obj = _.find(that.objects_mapped[type].objects, function(o){return o.id == id});
		that.openRelationalPopup(obj, type);
	}

	that.closeRelationalPopup = function(e) {
		e.preventDefault();
		var mapWrap = jQuery( "#" + that.map_id ).closest('.relational-map-wrapper');
		mapWrap.removeClass('pop-up-open');
		mapWrap.find('.content-pop-out').remove();
		that.createMarkers(that.objects_mapped);
	}

	that.openRelationalPopup = function(obj, key){
		var mapWrap = jQuery( "#" + that.map_id ).closest('.relational-map-wrapper');
		mapWrap.addClass('pop-up-open');

		var relatedOutput = '';
		jQuery.each(obj.related, function(i,v){
			relatedOutput += '<' + (that.useLists ? 'ul' : 'div') + ' class="popup-related '+i+'">';
			jQuery.each(v, function(i2,v2){
				relatedOutput += '<' + (that.useLists ? 'li' : 'div') + '><a class="popup-item '+i+'" href="'+v2.link+'">'+that.getObjectHtml(v2)+'</a></' + (that.useLists ? 'li' : 'div') + '>';
			});
			relatedOutput += '</' + (that.useLists ? 'ul' : 'div') + '>';
		});

		mapWrap.find('.content-pop-out').remove();

		var popOutClose = '<a href="#" class="content-pop-out-close">Close</a>';
		var popOutContent = '<a class="popup-selected popup-item '+key+'" href="'+obj.link+'">'+that.getObjectHtml(obj)+'</a>'+
			'<a class="popup-view-profile-link '+key+'" href="'+obj.link+'">'+that.view_text+'</a>';

		var popOutContent = jQuery('<div />', {
			'class': 'content-pop-out'
		}).html( popOutClose + popOutContent + relatedOutput );
		mapWrap.append(popOutContent);

		var tmp = jQuery.extend({}, obj);
		relatedObjects = {};
		relatedObjects[key] = {
			color: that.objects[key].color,
			objects: [tmp]
		};
		for(rel_key in tmp.related) {
			relatedObjects[rel_key] = {
				color: that.objects[rel_key].color,
				objects: tmp.related[rel_key]
			};
		}

		that.createMarkers(relatedObjects);
		jQuery('.content-pop-out-close').on('click',that.closeRelationalPopup);
	}

};