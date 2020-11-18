/* ================================================================ */
/*                         GLOBAL VARIABLES                         */
/* ================================================================ */
var map;
var no_countries_mode = 1;
var country_colours = {"hover": "#72de78", "active": " #4bc551", "normal": "#aaa"}

// holds the current active countries
var active_countries = ["",""];
var attendance_data = [];
var empty_attendance = [-1,-1,-1,-1,-1,-1,-1,-1,-1,-1];
var current_attendance = [empty_attendance,empty_attendance,empty_attendance,empty_attendance]

/* ================================================================ */
/*                              SCALES                              */
/* ================================================================ */
// colour scale; to be changed when country gets selected
var colours = d3.scaleLinear()
    .domain([-1, 0, 0, 1])
    .range(['#666', '#666', 'white', 'hsl(123, 100%, 25%)']);

/* ================================================================ */
/*                               CODE                               */
/* ================================================================ */
// what to do when the page loads
$(window).on("load", function() {
    loadMapStuff();
    resizeBody($(this));
    resizeMap();
    createStadium();
    resizeStadium();

    bindCountryHover();
    bindCountryUnhover();
    bindCountryClick();
});

// what to  do on window resize
$(window).on("resize", function() {
    resizeBody($(this));
    resizeMap();
    resizeStadium();
});

// keeps the body element at 16:9
function resizeBody(win) {
    var w_height = win.height();
    var w_width = win.width();
    var new_height = w_width * 9/16;
    var new_width = w_height * 16/9;

    if (new_height <= w_height) $("body").width(w_width).height(new_height);
    else $("body").width(new_width).height(w_height);
}

// make the map always fit its container
function resizeMap() {
    var map_container = map.parent();
    map.attr("height", map_container.height() + 2);
    map.attr("width", (map_container.height() + 2) * 1.45);

    $("ul#country-pick").css("width", map_container.width() - map.width());
}

// makes the stadium always fit its container
function resizeStadium() {
    var stadium_container = $("svg#stadium").parent();
    var c_height = stadium_container.height();
    var c_width = stadium_container.width();
    var new_height = c_width * 10/9;
    var new_width = c_height * 9/10;

    if (new_height <= c_height) $("svg#stadium").attr({"width": c_width, "height": new_height});
    else $("svg#stadium").attr({"width": new_width, "height": c_height});
}

// loads the SVG map and the country list from countries-svg.json
function loadMapStuff() {
    map = $("svg#map-svg");
    var list_ul = $("#country-pick");
    var country_list = [];
    var new_path, title;

    $.ajax({
        async: false,
        url: "data/countries-svg.json",
        success: function (json) {
            json.forEach(function (item) {
                // adds each country to the SVG; needs to be done in pure JS because jQuery doesn't handle SVG
                new_path = document.createElementNS("http://www.w3.org/2000/svg", "path");
                new_path.setAttributeNS(null, "d", item.d);
                new_path.setAttributeNS(null, "fill", item.country == "" ? "#666" : "#aaa");
                new_path.setAttributeNS(null, "stroke", "#404040");
                new_path.setAttributeNS(null, "stroke-width", item.strokewidth == "" ? "7.6394" : item.strokewidth);
                new_path.setAttributeNS(null, "transform", item.transform);

                // add title and data-country if country is usable
                if (item.country != "") {
                    // event the title inside the "path" needs to be from SVG namespace...
                    title = document.createElementNS("http://www.w3.org/2000/svg", "title");
                    title.innerHTML = item.country;

                    new_path.setAttributeNS(null, "data-country", item.country);
                    new_path.appendChild(title);
                    if (!country_list.includes(item.country)) country_list.push(item.country);
                }

                else new_path.classList.add("greyed-out");

                map[0].appendChild(new_path);
            });

            // add countries to list; must be here because getJSON is asynchronous
            country_list.sort().forEach(function (item) {
                list_ul.append($(
                    "<li id=\"li-" + item + "\" data-country=\"" + item + "\">\
                        <i class=\"flag-icon flag-" + item + "\" style=\"background-image: url('images/flags/flag-" + item + ".png');\"></i><span>" + item.replaceAll("-"," ") + "</span>\
                    </li>"
                ));
            });
        }
    });
}

// what happens when we hover a country
function bindCountryHover() {
    $("svg#map-svg path:not(.greyed-out), ul#country-pick li").on("mouseover", function () {
        // this way, it deals with all the country's paths, along with the list item
        $("svg#map-svg path[data-country=" + this.dataset.country + "], ul#country-pick li#li-" + this.dataset.country).each(function () {
            // if it's the path, just changes its color
            if (this.localName == "path" && $(this).attr("fill") != country_colours.active)
                $(this).attr("fill", country_colours.hover);

            // if it's the list item, only "hovers" it if item not active
            // important because list item may be "hovered" (temporary highlight) or "active" (permanent highlight)
            else if (this.localName == "li" && (!this.dataset.active || this.dataset.active === "false"))
                this.dataset.hovered = true;
        });
    });
}

// what happens when we unhover a country
function bindCountryUnhover() {
    $("svg#map-svg path:not(.greyed-out), ul#country-pick li").on("mouseout", function () {
        if (this.dataset.active === "true");

        else $("svg#map-svg path[data-country=" + this.dataset.country + "], ul#country-pick li#li-" + this.dataset.country).each(function () {
            if (this.localName == "path")
                $(this).attr("fill", country_colours.normal);

            else
                this.dataset.hovered = false;
        });
    });
}

// clicking on the country (map or list)
function bindCountryClick() {
    $("svg#map-svg path:not(.greyed-out), ul#country-pick li").on("click", function () {
        // there can only be one country selected
        if (no_countries_mode == 1) {
            // deselect active country
            $("svg#map-svg path:not(.greyed-out)[data-active=true]").each(function () {
                $(this).attr("fill", country_colours.normal)[0].dataset.active = false;
                $("li#li-" + this.dataset.country)[0].dataset.active = false;
            });

            // puts flag and name in the first country slot
            $("#country-title-1 > .flag-div > img").attr("src", "images/flags/flag-" + this.dataset.country + ".png").show();
            $("#country-title-1 > .country-name").html(this.dataset.country.replaceAll("-"," "));
            $("#country-title-1 > .close-country")
                .attr("title", "Remove " + this.dataset.country.replaceAll("-"," ") + " from selected countries")
                .attr("onclick", "closeCountry(\"" + this.dataset.country + "\")")
                .show();

            // stores country name as first one selected
            active_countries[0] = this.dataset.country;

            // adds country to stadium chart
            current_attendance[0] = attendance_data.find(
                x => (x.country === this.dataset.country && x.occ_type === "league")
            ).years;

            current_attendance[1] = attendance_data.find(
                x => (x.country === this.dataset.country && x.occ_type === "national")
            ).years;

            udpateStadium();
        }

        // there can be two countries selected
        else if (no_countries_mode == 2) {

        }

        // permanently select clicked country
        $("svg#map-svg path[data-country=" + this.dataset.country + "], ul#country-pick li#li-" + this.dataset.country).each(function () {
            $(this).attr("fill", country_colours.active)[0].dataset.active = true;
            $("li#li-" + this.dataset.country)[0].dataset.active = true;
            $("li#li-" + this.dataset.country)[0].dataset.hovered = false;
        });
    });
}

function closeCountry(country) {
    // deselect country on map and list
    $("svg#map-svg path[data-country=" + country + "], ul#country-pick li#li-" + country).each(function () {
        $(this).attr("fill", country_colours.normal)[0].dataset.active = false;
        $("li#li-" + country)[0].dataset.active = false;
    });

    // remove from selected country bar
    var index = active_countries.indexOf(country) + 1;
    active_countries[index - 1] = "";
    $("#country-title-" + index).replaceWith(
        "<div class=\"country-title\" id=\"country-title-" + index + "\">\
        <div class=\"flag-div\"><img src=\"\" height=\"36\" style=\"display:none;\"></div>\
        <span class=\"country-name\"></span>\
        <span class=\"close-country\" title=\"\" style=\"display:none;\">❌</span>\
        </div>"
    );

    // remove from stadium chart
    current_attendance[2*(index - 1)] = empty_attendance;
    current_attendance[2*(index - 1) + 1] = empty_attendance;
    udpateStadium();
}

// creating the stadium visualization
function createStadium() {
    var indexes = [3,2,0,1,0]; // needed to have the interior circles with lower section number
    var stadium = d3.select("#stadium");
    var center = {"x":450,"y":600};
    var angle_step = (-1) * Math.PI / 5; // we'll be having steps of 36 degrees
    var start_angle = Math.PI / 2; // starting at 90 degrees south
    var point_1, point_2, d, g, i, j;

    // radiuses of each ellipsis drawn
    var radius = [
        {"x": 375, "y": 500},
        {"x": 315, "y": 420},
        {"x": 255, "y": 340},
        {"x": 235, "y": 320},
        {"x": 175, "y": 240},
        {"x": 115, "y": 160}
    ];

    // load attendances data
    $.ajax({
        async: false,
        type: "GET",  
        url: "data/attendances.csv",
        dataType: "text",       
        success: function (response) {
            $.csv.toObjects(response).forEach(function (item) {
                item.years = [];
                for (var y = 2011; y <= 2020; y++) {
                    item.years.push(item[y]);
                    delete item[y];
                }
                attendance_data.push(item);
            });
        }   
    });

    // actually creating the stadium
    for (i = 0; i < 5; i++) {
        // ignore inner padding circle
        if (i == 2) continue;

        // create ten sectors for each section
        for (j = 0; j < 10; j++) {
            point_1 = polarToCartesian(center.x, center.y, radius[i].x, radius[i].y, start_angle + j * angle_step);
            point_2 = polarToCartesian(center.x, center.y, radius[i].x, radius[i].y, start_angle + (j + 1) * angle_step);
            point_3 = polarToCartesian(center.x, center.y, radius[i+1].x, radius[i+1].y, start_angle + (j + 1) * angle_step);
            point_4 = polarToCartesian(center.x, center.y, radius[i+1].x, radius[i+1].y, start_angle + j * angle_step);

            // generate path string
            d = [
                "M", point_1.x, point_1.y,
                "A", radius[i].x, radius[i].y, 0, 0, 0, point_2.x, point_2.y,
                "L", point_3.x, point_3.y,
                "A", radius[i+1].x, radius[i+1].y, 0, 0, 1, point_4.x, point_4.y,
                "Z"
            ].join(" ")

            g = stadium.append("g")
                .attr("class", "slice")
                .attr("data-sector", j)
                .attr("data-section", indexes[i]);

            // add filled slice
            g.append("path")
                .attr("class", "inside")
                .attr("d", d);

            // add stroke, always on top
            g.append("path")
                .attr("class", "border")
                .attr("d", d)
                .attr("fill", "transparent")
                .attr("stroke", "rgb(30,30,30)")
                .attr("stroke-width", "7px");

            // adds the possibility of having a tooltip displaying the percentage
            g.append("title");
        }

    }
    // bind data to filled 
    udpateStadium();

    // addin year labels
    // 'baseline' needed to position them correctly
    var baseline = ["hanging","hanging","middle","baseline","baseline","baseline","baseline","middle","hanging","hanging"];
    start_angle = 2 * Math.PI / 5;

    for (i = 0; i < 10; i++) {
        point_1 = polarToCartesian(center.x, center.y, radius[0].x + 15, radius[0].y + 15, start_angle + i * angle_step);
        stadium.append("text")
            .text(2011 + i)
            .attr("text-anchor", i > 4 ? "end" : "start")
            .attr("alignment-baseline", baseline[i])
            .attr("x", point_1.x)
            .attr("y", point_1.y);
    }
}

// gets cartesian coordinates given a center point, radiuses and angle
function polarToCartesian(center_x, center_y, radius_x, radius_y, angle) {
    return {
        x: center_x + (radius_x * Math.cos(angle)),
        y: center_y + (radius_y * Math.sin(angle))
    };
}

// called when a stadium data should be updated
function udpateStadium() {
    for (var i = 0; i < 4; i++) {
        // update colours
        d3.selectAll($("g.slice[data-section=" + i + "]").toArray())
            .data(current_attendance[i])
            .join("g")
            .attr("fill", d => `${colours(d)}`);

        // update tooltip with the percentages
        d3.selectAll($("g.slice[data-section=" + i + "] title").toArray())
            .data(current_attendance[i])
            .join("g")
            .text(function (d) { return d >= 0 ? Math.round(d * 100) + "%" : ""; });
    }
}