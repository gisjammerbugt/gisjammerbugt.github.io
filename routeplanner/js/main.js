(function () {
    "use strict";
    var map, directionsDisplay, directionsService, list = [], autocomplete, bar, modal, specArr = [], markers = [], homeMarker, geoCoder, bounds, startAdress;

    function search(origin) {
        var i = 0, l, cclass, arr = [], marker, infowindow, ll, homeHoldeplads;
        bounds = new google.maps.LatLngBounds();

        // Filter and sort the destinations
        $.each(gc2dest.features, function (index, value) {
            if ($("#speciel-input").val() === value.properties.speciale) {
                arr.push(value);
            }
        });
        l = arr.length;

        // Clean up the map
        $.each(markers, function (index, value) {
            value.setMap(null);
        });
        markers = [];
        if (directionsDisplay !== undefined) {
            directionsDisplay.setMap(null);
        }
        if (homeMarker !== undefined) {
            homeMarker.setMap(null);
        }

        // Set home marker from address
        geoCoder = new google.maps.Geocoder();
        geoCoder.geocode({'address': origin}, function (results, status) {
            if (status === google.maps.GeocoderStatus.OK) {
		            startAdress = results[0].formatted_address;
                homeMarker = new google.maps.Marker({
                    map: map,
                    position: results[0].geometry.location
                });
                bounds.extend(results[0].geometry.location);
                // Get takstzone
                $.ajax({
                    dataType: 'json',
                    url: "http://eu1.mapcentia.com/cgi/proxy.cgi?url=" + encodeURIComponent(config.rejseplanenAPI + "/stopsNearby?coordX=" + results[0].geometry.location.lat() + "&coordY=" + results[0].geometry.location.lng() + "&maxNumber=1&format=json"),
                    //url: "http://geo.oiorest.dk/holdepladser/" + results[0].geometry.location.lat()/1000000 + "," + results[0].geometry.location.lng() + ".json",
                    success: function (response) {
                        $("#homeTakst").empty();
                        $("#homeTakst").append("<span>Holdeplads: " + response.LocationList.StopLocation.name + "</span>")
                        homeHoldeplads = response.LocationList.StopLocation.name;
                    }
                });
            } else {
                alert('Kunne ikke finde adresse: ' + status);
            }
        });

        // Setup direction service
        directionsService = new google.maps.DirectionsService();
        directionsDisplay = new google.maps.DirectionsRenderer();
        directionsDisplay.setMap(map);
        directionsDisplay.setOptions({suppressMarkers: true});

        // Clean up the list
        $('#tweetContainer').empty();
        $("#search-progress").empty();

        // Start iterations
        (function iterator() {
            var request = {
                    origin: origin,
                    destination: arr[i].properties.samlet_adresse,
                    travelMode: google.maps.TravelMode.DRIVING,
                    provideRouteAlternatives: true
                },
                custom = {
                    gid: arr[i].properties.gid,
                    navn: arr[i].properties.navn,
                    speciale: arr[i].properties.speciale
                };
            directionsService.route(request, function (response, status) {
                if (response === null || status === google.maps.DirectionsStatus.ZERO_RESULTS) {
                    $('#tweetContainer').empty();
                    $("#search-progress").empty();
                    bar.removeClass('animate');
                    modal.modal('hide');
                    alert("En eller flere rutevejledninger mislykkedes. Prøv at lave søgningen igen");
                    return;
                }
                if (status === google.maps.DirectionsStatus.OK) {
                    var temp, leg;
                    $.each(response.routes, function (i,v) {
                        if (temp === undefined || temp > v.legs[0].distance.value){
                            temp = v.legs[0].distance.value;
                            leg = v.legs[0];
                        }
                    });

                    //var leg = response.routes[0].legs[0];
                    list.push({
                        distance: leg.distance.value,
                        request: request,
                        leg: leg,
                        custom: custom
                    });
                    $("#search-progress").append("<p>" + request.destination + "</p>");
                    if (++i < l) {
                        setTimeout(iterator, 500);
                    }
                }
            });
        }());
        (function pollForIterator() {
            if (i === l) {
                bar.removeClass('animate');
                modal.modal('hide');
                list.sort(function (a, b) {
                    if (a.distance < b.distance)
                        return -1;
                    if (a.distance > b.distance)
                        return 1;
                    return 0;
                });
                $.each(list, function (index, value) {
                    if (index === 0) {
                        cclass = "green";
                    } else if (value.leg.distance.value > 50000) {
                        cclass = "red";
                    } else {
                        cclass = "";
                    }
                    $('#tweetContainer').append(
                        '<section><a href="javascript:void(0)" class="list-group-item ' + cclass + '" data-id=\"' +
                        value.custom.gid +
                        '">' +
                        '<div class="number">' + (index + 1) + '</div>' +
                        '<h4 class="list-group-item-heading">' +
                        value.leg.distance.text + 
                        ' (Google)    - ' +
                        '<span class="" id="krak_dist' + index + '"></span>' +
                        ' (KRAK)' +
                        '</h4>' +
                        '<p class="list-group-item-text">' +
                        value.custom.speciale +
                        '<br>' +
                        value.custom.navn +
                        '<br>' +
                        value.request.destination +
                       '<br>' +
                       '<br>' +
                        'Befordringspris 2017, Google Maps: ' + parseFloat(Math.round(config.befording._2017 * (value.leg.distance.value / 1000) * 100) / 100).toFixed(2).toString().replace(".", ",") + ' kr.' +
                       '   - KRAK: <span class="" id="krak_sidst' + index + '"></span>' +
                       '<br>' +
                        'Befordringspris 2018, Google Maps: ' + parseFloat(Math.round(config.befording._2018 * (value.leg.distance.value / 1000) * 100) / 100).toFixed(2).toString().replace(".", ",") + ' kr.' +
                       '   - KRAK: <span class="" id="krak_nu' + index + '"></span>' +
                        '<br><br>' +
                        'Der betales fuld bustakst i tidsrummene 7.00-10.59 samt 13.00-17.59' +
                        '<br>' +
                        '<div class="rejseplan-link" id="takst' + index + '"></div>' +
                        '</p>' +
                        '</a></section>'
                    );
                    // Get takstzone
                    $.ajax({
                        dataType: 'json',
                        url: "http://eu1.mapcentia.com/cgi/proxy.cgi?url=" + encodeURIComponent(config.rejseplanenAPI + "/stopsNearby?coordX=" + value.leg.end_location.lat() + "&coordY=" + value.leg.end_location.lng() + "&maxNumber=1&format=json"),
                        //url: "http://geo.oiorest.dk/holdepladser/" + value.leg.end_location.lat() + "," + value.leg.end_location.lng() + ".json",
                        success: function (response) {
                            $("#takst" + index).append("<span><a target='_blank' href='https://www.rejseplanen.dk/webapp/index.html?language=da_DA&#!S|" + startAdress + "!Z|" + value.request.destination +"!timeSel|depart!time|07:30#!start|1'>Rejseplan til " + value.request.destination + "</a></span>")
                        }
                    });
                    // Get Krak link
                    $.ajax({
                        dataType: 'json',
                        url: "https://route.enirocdn.com/route/route.json?&waypoints=" + homeMarker.getPosition().lng() +"%2C" + homeMarker.getPosition().lat() +"%3B" + value.leg.end_location.lng() + "%2C" + value.leg.end_location.lat() + "&pref=SHORTEST&instr=true&res=4",
                        //url: "http://geo.oiorest.dk/holdepladser/" + value.leg.end_location.lat() + "," + value.leg.end_location.lng() + ".json",
                        success: function (response) {
                            $("#KRAKKort" + index).append("<span><a target='_blank' href='https://route.enirocdn.com/route/route.json?&waypoints=" + homeMarker.getPosition().lng() +"%2C" + homeMarker.getPosition().lat() +"%3B" + value.leg.end_location.lng() + "%2C" + value.leg.end_location.lat() + "&pref=SHORTEST&instr=true&res=4'>KRAK-kort til " + value.request.destination + "</a></span>")
                        }
		    });
                    });
                    // Get Krak distance
                    $.ajax({
                        dataType: 'json',
                        url: "https://route.enirocdn.com/route/route.json?&waypoints=" + homeMarker.getPosition().lng() +"%2C" + homeMarker.getPosition().lat() +"%3B" + value.leg.end_location.lng() + "%2C" + value.leg.end_location.lat() + "&pref=SHORTEST&instr=true&res=4",
                        //url: "http://geo.oiorest.dk/holdepladser/" + value.leg.end_location.lat() + "," + value.leg.end_location.lng() + ".json",
                        success: function (response) {
                          console.log(response["route-geometries"].features[0].properties.length);
                            $("#krak_dist" + index).append((((response["route-geometries"].features[0].properties.length / 100) * 10) / 100).toFixed(1).toString().replace(".", ",") + ' km')
                        }
		    });
                    // Get Krak-sidste år pris
                    $.ajax({
                        dataType: 'json',
                        url: "https://route.enirocdn.com/route/route.json?&waypoints=" + homeMarker.getPosition().lng() +"%2C" + homeMarker.getPosition().lat() +"%3B" + value.leg.end_location.lng() + "%2C" + value.leg.end_location.lat() + "&pref=SHORTEST&instr=true&res=4",
                        //url: "http://geo.oiorest.dk/holdepladser/" + value.leg.end_location.lat() + "," + value.leg.end_location.lng() + ".json",
                        success: function (response) {
                          console.log(response["route-geometries"].features[0].properties.length);
                            $("#krak_sidst" + index).append(parseFloat(Math.round(config.befording._2017 * (response["route-geometries"].features[0].properties.length / 1000) * 100) / 100).toFixed(2).toString().replace(".", ",") + ' kr.')
                        }
		    });
                    // Get Krak-dette år pris
                    $.ajax({
                        dataType: 'json',
                        url: "https://route.enirocdn.com/route/route.json?&waypoints=" + homeMarker.getPosition().lng() +"%2C" + homeMarker.getPosition().lat() +"%3B" + value.leg.end_location.lng() + "%2C" + value.leg.end_location.lat() + "&pref=SHORTEST&instr=true&res=4",
                        //url: "http://geo.oiorest.dk/holdepladser/" + value.leg.end_location.lat() + "," + value.leg.end_location.lng() + ".json",
                        success: function (response) {
                          console.log(response["route-geometries"].features[0].properties.length);
                            $("#krak_nu" + index).append(parseFloat(Math.round(config.befording._2018 * (response["route-geometries"].features[0].properties.length / 1000) * 100) / 100).toFixed(2).toString().replace(".", ",") + ' kr.')
                        }
					});

                    // Add markers
                    ll = new google.maps.LatLng(value.leg.end_location.lat(), value.leg.end_location.lng());
                    marker = new google.maps.Marker({
                        position: ll,
                        map: map,
                        icon: "http://chart.apis.google.com/chart?chst=d_map_pin_letter&chld=" + (index + 1) + "|FF0000|000000"
                    });
                    infowindow = new google.maps.InfoWindow({
                        content: "<div>" +
                        value.leg.distance.text + "<br>" +
                        value.custom.speciale + "<br>" +
                        value.custom.navn + "<br>" +
                        value.request.destination + "<br>" +
                        "</div>"
                    });

                    google.maps.event.addListener(marker, 'click', (function (marker, infowindow) {
                        return function () {
                            infowindow.open(map, marker);
                        };
                    }(marker, infowindow)));
                    bounds.extend(ll);
                    markers.push(marker);
                });
                map.fitBounds(bounds);
                $('a.list-group-item').on("click", function (e) {
                    var id = $(this).data('id');
                    $(".list-group-item").addClass("unselected");
                    $(this).removeClass("unselected");
                    $(this).addClass("selected");
                    showRoute(id, origin)
                });

                list = [];
            } else {
                setTimeout(pollForIterator, 10);
            }
        }());
    }

    function showRoute(id, origin) {
        $.each(gc2dest.features, function (index, value) {
            if (id === value.properties.gid) {
                directionsService.route({
                    origin: origin,
                    destination: value.properties.samlet_adresse,
                    travelMode: google.maps.TravelMode.DRIVING,
                    provideRouteAlternatives: true
                }, function (response, status) {
                    var temp;
                    if (status === google.maps.DirectionsStatus.OK) {
                        directionsDisplay.setDirections(response);
                    }
                    $.each(response.routes, function (i,v) {
                        if (temp === undefined || temp > v.legs[0].distance.value){
                            temp = v.legs[0].distance.value;
                            directionsDisplay.setRouteIndex(i);
                        }
                    });
                });

            }
        });
    }

    function init() {
        var mapOptions = {
            zoom: 8,
            center: new google.maps.LatLng(57, 9)
        };
        map = new google.maps.Map(document.getElementById('map-canvas'), mapOptions);
        autocomplete = new google.maps.places.Autocomplete(document.getElementById('search-input'));
        google.maps.event.addListener(autocomplete, 'place_changed', function () {
            var place = autocomplete.getPlace();
            search(place.formatted_address);
            modal = $('.js-loading-bar');
            bar = modal.find('.progress-bar');
            modal.modal('show');
            bar.addClass('animate');
        });
        $('.js-loading-bar').modal({
            backdrop: 'static',
            show: false
        });
        // Sort the destinations
        gc2dest.features.sort(function (a, b) {
            var nameA = a.properties.speciale.toLowerCase(), nameB = b.properties.speciale.toLowerCase();
            if (nameA < nameB) {
                return -1;
            }
            if (nameA > nameB) {
                return 1;
            }
            return 0;
        });
        $.each(gc2dest.features, function (index, value) {
            if (specArr.indexOf(value.properties.speciale) === -1) {
                specArr.push(value.properties.speciale);
                $("#speciel-input").append("<option value='" + value.properties.speciale + "'>" + value.properties.speciale + "</option>")
            }
        });
    }

    google.maps.event.addDomListener(window, 'load', init);
}());
