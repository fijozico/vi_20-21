/* ================================================================ */
/*                         GLOBAL VARIABLES                         */
/* ================================================================ */
var map;
var no_countries_mode = 0;
var country_colours = {"hover": ["#72de78", "#a873de"], "active": ["#4bc551", "#874ac4"], "normal": "#aaa"}

// holds the current active countries
var active_countries = ["",""];
var attendance_data = [];
var empty_attendance = [-1,-1,-1,-1,-1,-1,-1,-1,-1,-1];
var current_attendance = [empty_attendance,empty_attendance,empty_attendance,empty_attendance]
var players_compact_data = [];

// players
var players_compact_data = [];

/* ================================================================ */
/*                              SCALES                              */
/* ================================================================ */
// colour scale; to be changed when country gets selected
var colours = [
    d3.scaleLinear()
        .domain([-1, 0, 0, 1])
        .range(["#666", "#666", "white", "#00ff0e"]),
    d3.scaleLinear()
        .domain([-1, 0, 0, 1])
        .range(["#666", "#666", "white", "#7f00ff"])
];

/* ================================================================ */
/*                        INITIAL GENERATION                        */
/* ================================================================ */
// what to do when the page loads
$(window).on("load", function() {
    resizeBody($(this));
    createMap();
    resizeMap();
    createStadium();
    resizeStadium();
    createPlayersBarChart();
    createScatterPlot();
    resizeScatterplot();

    bindCountryHover();
    bindCountryUnhover();
    bindCountryClick();
});

// what to  do on window resize
$(window).on("resize", function() {
    resizeBody($(this));
    resizeMap();
    resizeStadium();
    resizeScatterplot();
});

/* ================================================================ */
/*                             RESIZING                             */
/* ================================================================ */
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
    var new_height = c_width * 5/4;
    var new_width = c_height * 4/5;

    if (new_height <= c_height) $("svg#stadium").attr({"width": c_width, "height": new_height});
    else $("svg#stadium").attr({"width": new_width, "height": c_height});
}

// make the player scatterplot fit the container
function resizeScatterplot() {
    var scatter = $("#gpm_scatterplot");
    var dim = Math.min(scatter.parent().height(), scatter.parent().width()) - 28;
    scatter.attr({"height": dim, "width": dim});
}

/* ================================================================ */
/*                     (1) COUNTRY LIST AND MAP                     */
/* ================================================================ */
// loads the SVG map and the country list from countries-svg.json
function createMap() {
    map = $("svg#map-svg");
    var list_ul = $("#country-pick");
    var country_list = [];
    var new_path, title;

    $.ajax({
        async: false,
        url: "data/countries-svg.json",
        success: function (json) {
            json.forEach(function (item) {
                // adds each country to the SVG; needs to be done in pure JS because jQuery doesn"t handle SVG
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
                        <i class=\"flag-icon flag-" + item + "\" style=\"background-image: url(images/flags/flag-" + item + ".png);\"></i><span>" + item.replaceAll("-"," ") + "</span>\
                    </li>"
                ));
            });
        }
    });
}

// what happens when we hover a country
function bindCountryHover() {
    $("svg#map-svg path:not(.greyed-out), ul#country-pick li").on("mouseover", function () {
        // this way, it deals with all the country"s paths, along with the list item
        $("svg#map-svg path[data-country=" + this.dataset.country + "], ul#country-pick li#li-" + this.dataset.country).each(function () {
            // if it"s the path, just changes its color
            if (this.localName == "path" && $(this).attr("fill") == country_colours.normal)
                $(this).attr("fill", country_colours.hover[no_countries_mode]);

            // if it"s the list item, only "hovers" it if item not active
            // important because list item may be "hovered" (temporary highlight) or "active" (permanent highlight)
            else if (this.localName == "li" && (this.dataset.active === undefined || this.dataset.active === "-1"))
                $(this).css({
                    "background-color": country_colours.hover[no_countries_mode],
                    "color": textColour(country_colours.hover[no_countries_mode])
                })[0].dataset.hovered = no_countries_mode;
        });
    });
}

// what happens when we unhover a country
function bindCountryUnhover() {
    $("svg#map-svg path:not(.greyed-out), ul#country-pick li").on("mouseout", function () {
        if (this.dataset.active === no_countries_mode.toString());

        else $("svg#map-svg path[data-country=" + this.dataset.country + "], ul#country-pick li#li-" + this.dataset.country).each(function () {
            if (this.localName == "path" && (this.dataset.active === undefined || this.dataset.active === "-1"))
                $(this).attr("fill", country_colours.normal);

            else if (this.dataset.active === undefined || this.dataset.active === "-1")
                $(this).attr("style", "")[0].dataset.hovered = -1;
        });
    });
}

// clicking on the country (map or list)
function bindCountryClick() {
    $("svg#map-svg path:not(.greyed-out), ul#country-pick li").on("click", function () {
        if (this.dataset.active !== undefined && this.dataset.active !== "-1") return;
        // deselect active country
        $("svg#map-svg path:not(.greyed-out)[data-active=" + no_countries_mode + "]").each(function () {
            $(this).attr("fill", country_colours.normal)[0].dataset.active = -1;
            $("li#li-" + this.dataset.country).attr("style", "")[0].dataset.active = -1;
        });

        // puts flag and name in the first country slot
        $("#country-title-" + (no_countries_mode+1)).empty().append(insertCountryBar(
            "images/flags/flag-" + this.dataset.country + ".png", // image source
            this.dataset.country.replaceAll("-"," "), // country name with spaces
            this.dataset.country // country name with dashes
        ));

        // stores country name as first one selected
        active_countries[no_countries_mode] = this.dataset.country;

        // adds country to stadium chart
        current_attendance[2*no_countries_mode] = attendance_data.find(
            x => (x.country === this.dataset.country && x.occ_type === "league")
        ).years;

        current_attendance[2*no_countries_mode+1] = attendance_data.find(
            x => (x.country === this.dataset.country && x.occ_type === "national")
        ).years;

        udpateStadium();

        // permanently select clicked country
        $("svg#map-svg path[data-country=" + this.dataset.country + "], ul#country-pick li#li-" + this.dataset.country).each(function () {
            $(this).attr("fill", country_colours.active[no_countries_mode])[0].dataset.active = no_countries_mode;
            $("li#li-" + this.dataset.country)[0].dataset.active = no_countries_mode;
            $("li#li-" + this.dataset.country).css({
                "background-color": country_colours.active[no_countries_mode],
                "color": textColour(country_colours.active[no_countries_mode])
            })[0].dataset.hovered = -1;
        });

        // needed so people may add a second country
        if (no_countries_mode === 0) $("#country-title-2").empty().append("<span class=\"add-country\" onclick=\"switchCountryState(2)\">+ add country</span>");

        // place colours on legend
        changeStadiumLegend("", this.dataset.country.replaceAll("-"," "));

        // puts the players on the bar chart
        formChange();

        // updates the player scatter plot
        updateScatterplot();
    });
}

// what happens when you click the cross next to the country name
function closeCountry(country) {
    // deselect country on map and list
    $("svg#map-svg path[data-country=" + country + "], ul#country-pick li#li-" + country).each(function () {
        if (this.localName == "path") $(this).attr("fill", country_colours.normal)[0].dataset.active = -1;
        else $(this).attr("style", "")[0].dataset.active = -1;
    });

    var index = active_countries.indexOf(country);

    // if it was the second, simply removes it
    if (index === 1) {
        active_countries[1] = "";
        $("#country-title-2").empty().append("<span class=\"add-country\" onclick=\"switchCountryState(2)\">+ add country</span>");

        // remove from stadium chart
        current_attendance[2] = current_attendance[3] = empty_attendance;

        // remove stadium legend
        changeStadiumLegend("delete");
        no_countries_mode = 0;

        // fetches current form state and updates bar chart
        formChange();
    }

    // if it's the first, and the second's defined, moves the second to its place
    else if (index === 0 && $("#country-title-2").children().length > 1) {
        $("#pc-left-top [data-country=" + active_countries[1] + "]").each(function () {
            if (this.localName == "path")
                $(this).attr({
                    "fill": country_colours.active[0],
                    "data-active": 0
                });

            else
                $(this).attr("data-active", 0).css({
                    "background-color": country_colours.active[0],
                    "color": textColour(country_colours.active[0])
                });
        });
        active_countries = active_countries.slice(1,2).concat([""]);
        $("#country-title-1").empty().append($("#country-title-2").children());
        $("#country-title-2").empty().append("<span class=\"add-country\" onclick=\"switchCountryState(2)\">+ add country</span>");

        // remove from stadium chart
        current_attendance = current_attendance.slice(2,4).concat([empty_attendance,empty_attendance]);

        // remove legend
        changeStadiumLegend("delete");
        no_countries_mode = 0;
        changeStadiumLegend("", active_countries[0]);

        // fetches current form state and updates bar chart
        formChange();
    }

    // if it's the first and only, removes it
    else {
        active_countries[0] = "";
        $("#country-title-1").empty().append("<span class=\"suggestion\">Select a country above...</span>");
        $("#country-title-2").empty();

        // remove from stadium chart
        current_attendance[0] = current_attendance[1] = empty_attendance;

        // remove legend
        changeStadiumLegend("delete");
        $("#stadium #legend").hide();
        no_countries_mode = 0;

        // remove bar chart
        updatePlayersBarChart("total-gpm", "delete");
    }

    udpateStadium();
    updateScatterplot();
}

// generates the element for inside the country bar
function insertCountryBar(src, name_s, name_d) {
    return $(
        `<img src=\"${src}\">
        <span class=\"country-name\">${name_s}</span>
        <span class=\"close-country\" onclick=\"closeCountry('${name_d}')\" title=\"Remove ${name_s} from selected countries\">❌</span>`
    );
}

/* ================================================================ */
/*                     (4) STADIUM VISUALIZATION                    */
/* ================================================================ */
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

    // add ridge between 2020 an 2011
    stadium.append("path")
        .attr("d", ["M", center.x, center.y + radius[0].y - 2, "L", center.x, center.y + radius[2].y, "Z"].join(" "))
        .attr("fill", "transparent")
        .attr("stroke", "rgb(30,30,30)")
        .attr("stroke-width", "20px");
    stadium.append("path")
        .attr("d", ["M", center.x, center.y + radius[3].y - 2, "L", center.x, center.y + radius[5].y, "Z"].join(" "))
        .attr("fill", "transparent")
        .attr("stroke", "rgb(30,30,30)")
        .attr("stroke-width", "20px");

    // add "Club" and "NT" markers
    stadium.append("text").attr("class", "cnt-label").text("Club").attr("text-anchor", "middle").attr("alignment-baseline", "middle").attr("x", center.x).attr("y", 2 + center.y + (radius[4].y + radius[5].y) / 2);
    stadium.append("text").attr("class", "cnt-label").text("NT").attr("text-anchor", "middle").attr("alignment-baseline", "middle").attr("x", center.x).attr("y", 2 + center.y + (radius[3].y + radius[4].y) / 2);
    stadium.append("text").attr("class", "cnt-label").text("Club").attr("text-anchor", "middle").attr("alignment-baseline", "middle").attr("x", center.x).attr("y", 2 + center.y + (radius[1].y + radius[2].y) / 2);
    stadium.append("text").attr("class", "cnt-label").text("NT").attr("text-anchor", "middle").attr("alignment-baseline", "middle").attr("x", center.x).attr("y", 2 + center.y + (radius[0].y + radius[1].y) / 2);

    // bind data to filled 
    udpateStadium();

    // adding year labels
    // "baseline" needed to position them correctly
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
            .attr("fill", d => `${colours[parseInt(i/2)](d)}`);

        // update tooltip with the percentages
        d3.selectAll($("g.slice[data-section=" + i + "] title").toArray())
            .data(current_attendance[i])
            .join("g")
            .text(function (d) { return d >= 0 ? Math.round(d * 100) + "%" : ""; });
    }
}

// change legend
function changeStadiumLegend(mode, country = "") {
    // if a delete was requested, removes the line
    if (mode === "delete") {
        $("#stadium #legend-line-" + (no_countries_mode+1)).hide(); return;
    }

    // otherwise changes the legend line according to 'no_countries_mode'
    $("#stadium #legend").show()
        .children("#legend-line-" + (no_countries_mode+1)).show()
        .children("circle").attr("fill", function (index) {
            return colours[no_countries_mode]([0,0.5,1][index]);
        });

    $("#stadium #legend-line-" + (no_countries_mode+1) + " text").html(country);
}

/* ================================================================ */
/*                      (6) PLAYER SCATTER PLOT                     */
/* ================================================================ */

function createScatterPlot() {
    var margin = {top: 14, right: 14, bottom: 14, left: 14},
    width = 495 - margin.left - margin.right,
    height = 495 - margin.top - margin.bottom;

    var svg = d3.select("#pc-right-bottom")
        .append("svg")
        .attr("width", width)
        .attr("height", height)
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("id", "gpm_scatterplot");
}

function updateScatterplot() {

    var margin = {top: 14, right: 14, bottom: 14, left: 14},
    width = 495 - margin.left - margin.right,
    height = 495 - margin.top - margin.bottom;

    var players = players_compact_data.filter(
        x => (x.country === active_countries[no_countries_mode])
    );

    var svg = d3.select("#gpm_scatterplot");

    var max_club = Math.max.apply(Math, players.map(function(o) { return o.club_avg; }));
    var max_nt = Math.max.apply(Math, players.map(function(o) { return o.nt_avg; }));
    var max = Math.max(max_nt, max_club);
    var max_x_scale = Math.ceil(max * 10) / 10;

    var x = d3.scaleLinear()
        .domain([0, max_x_scale])
        .range([ 2 * margin.left + 25, width - 40 ]);
    var y = d3.scaleLinear()
        .domain([0, max_x_scale])
        .range([ height - 40, margin.bottom + 25]);

    svg.select("#x_scale")
        .remove();          
    svg.insert("g", ":first-child")
        .attr("transform", "translate(0," + (height - 40)  + ")")
        .attr("id", "x_scale")
        .attr("color", "white")
        .call(d3.axisBottom(x).ticks(max_x_scale > 1 ? max_x_scale / 2 : max_x_scale * 10));

    svg.select("#y_scale")
       .remove();
    svg.insert("g", ":first-child")
       .attr("transform", "translate(" + (2 * margin.left + 25) + ",0)")
       .attr("id", "y_scale")
       .attr("color", "white")
       .call(d3.axisLeft(y).ticks(max_x_scale > 1 ? max_x_scale / 2 : max_x_scale * 10));


    svg.select("#club_label")
        .remove();
    svg.append("text")
        .attr("id", "club_label")
        .attr("x", width / 2 + 5 )
        .attr("y", height )
        .attr("fill", "white")
        .style("text-anchor", "middle")
        .text("Club GPM");


    svg.select("#nt_label")
        .remove();
    svg.append("text")
        .attr("id", "nt_label")
        .attr("transform", "rotate(-90)")
        .attr("y", - margin.left + 20)
        .attr("x",0 - (height / 2))
        .attr("dy", "1em")
        .attr("fill", "white")
        .style("text-anchor", "middle")
        .style("alignment-baseline", "baseline")
        .text("NT GPM");

    svg.selectAll("circle")
        .data(players)
        .join("circle")
        .attr("cx", function (d) { return x(d.club_avg); } )
        .attr("cy", function (d) { return y(d.nt_avg); } )
        .attr("r", 8)
        .attr("fill", "#72de78aa")

    // creating and inserting before anything else makes it stay below all items
    svg.select("#scatterline")
        .remove();
    svg.insert("line", ":first-child")
        .attr("id", "scatterline")
        .attr("stroke", "red")
        .attr("x1",x(0))
        .attr("x2",x(max_x_scale))
        .attr("y1",y(0))
        .attr("y2",y(max_x_scale));
}

/* ================================================================ */
/*                      (7) PLAYERS' BAR CHART                      */
/* ================================================================ */
// players' bar chart
function createPlayersBarChart() {
    // load compact players data (no need to have a yearly discrimination)
    $.ajax({
        async: false,
        type: "GET",  
        url: "data/players_gpm_compact.csv",
        dataType: "text",       
        success: function (response) {
            players_compact_data = $.csv.toObjects(response);
        }   
    });

    $("#bar-chart-div")[0].appendChild(d3.create("svg")
        .attr("id", "players-bar-chart")
        .attr("width", 368)
        .attr("height", 266)
        .node()
    );
}

// with the SVG created, we now need to call this function to do the
// actual work when we click a country
// if ascdesc == undefined, ascending; if ascdesc != undefined, descending
function updatePlayersBarChart(mode, ascdesc) {
    var decode = {
        "total-gpm": "player_avg",
        "nt-gpm": "nt_avg",
        "club-gpm": "club_avg",
        "under": "under",
        "years-active": "years_active",
    };

    var players = players_compact_data.filter(
        x => (active_countries.includes(x.country))
    ).sort(function(a, b) {
        var keyA = parseFloat(a[decode[mode]]);
        var keyB = parseFloat(b[decode[mode]]);
        if (ascdesc === undefined) {
            if (keyA < keyB) return -1;
            if (keyA > keyB) return 1;
            return 0;
        }
        else {
            if (keyA < keyB) return 1;
            if (keyA > keyB) return -1;
            return 0;
        }
    });

    var padding = 14;

    // maximum width value
    var max_w = Math.max.apply(Math, players.map(function(o) { return o[decode[mode]]; }));

    // maximum width tick value
    var max_w_scale = Math.ceil(max_w * 10) / 10;
    var y_scale_data = players.map((p) => p.full_name);

    var svg = d3.select("#players-bar-chart").attr("height", players.length * 40 + 40);

    // discrete scale for the players axis
    var y_scale = d3.scaleBand()
        .domain(y_scale_data)
        .range([55, players.length * 40 + 55]);

    // continuous linear scale for the values
    var w_scale = d3.scaleLinear()
        .domain([0, max_w_scale])
        .range([padding, 215]);

    // drawing the bars
    svg.selectAll(".player-bar-rect")
        .data(players)
        .join("rect")
        .attr("class", "player-bar-rect")
        .attr("fill", function (d) { return country_colours.hover[active_countries.indexOf(d.country)]; })
        .attr("x", padding)
        .attr("y", function (d) { return y_scale(d.full_name); })
        .attr("height", y_scale.bandwidth() - 15)
        .attr("width", function (d) { return w_scale(d[decode[mode]]) - padding; });

    // putting the players' name on the right
    svg.selectAll(".player-bar-text")
        .data(players)
        .join("text")
        .attr("class", "player-bar-text")
        .attr("style", "text-anchor: start; alignment-baseline: middle")
        .attr("fill", "white")
        .attr("x", function (d) { return w_scale(d[decode[mode]]) + 10; })
        .attr("y", function (d) { return y_scale(d.full_name) + (y_scale.bandwidth() - 12) / 2; })
        .text(function (d) {
            return (d.first_name !== "" ? `${d.first_name[0]}. ` : "") +
                `${d.last_name} - ${d[decode[mode]]}`;
        })
        .attr("textLength", function (d) {
            // checks if compressing the player label is needed
            if (this.getBoundingClientRect().width > 354 - w_scale(d[decode[mode]]))
                return 354 - 10 - w_scale(d[decode[mode]]);
            return 0;
        });

    // remove previous width axis and add new one
    svg.select("#w_axis").remove();
    svg.append("g")
        .attr("transform", "translate(0,40)")
        .attr("id", "w_axis")
        .attr("color", "white")
        .call(d3.axisTop()
            .scale(w_scale)
            .ticks(max_w_scale > 1 ? max_w_scale / 2 : max_w_scale * 10)
        );

    // remove previous width axis label and add new one
    svg.select("#axis-label").remove();
    svg.append("text")
        .attr("id", "axis-label")
        .attr("style", "text-anchor: middle; alignment-baseline: baseline; transform: translate(114px, 12px)")
        .attr("fill", "white")
        .attr("class", "label")
        .text($(`label[for=${mode}]`).text());

    // remove previous height axis and add new one
    svg.select("#y_axis").remove();
    svg.append("g")
        .attr("transform", "translate(14,-15)")
        .attr("id", "y_axis")
        .attr("color", "white")
        .call(d3.axisLeft()
            .scale(y_scale)
            .tickSize(0)
            .tickValues([])
        );

    // if no country's selected, delete axes
    if (ascdesc === "delete") {
        svg.select("#w_axis").remove();
        svg.select("#axis-label").remove();
        svg.select("#y_axis").remove();
    }
}

/* ================================================================ */
/*                         GENERAL FUNCTIONS                        */
/* ================================================================ */
// calculate text colour depending on background
function textColour(colour) {
    // convert from HEX to RGB if necessary
    if (colour[0] === "#") {
        var value = {"r": 0, "g": 0, "b": 0};
        value.r = parseInt(colour.substring(1,3), 16);
        value.g = parseInt(colour.substring(3,5), 16);
        value.b = parseInt(colour.substring(5,7), 16);
    }
    // in case it"s RGB
    else value = colour.replace(/[^\d,]/g, "").split(",");

    return 1 - (0.299 * value.r + 0.587 * value.g + 0.114 * value.b) / 255 < 0.5 ? "black" : "white";
}

// change country state
function switchCountryState(no) {
    no_countries_mode = no - 1;
}

// function called when form receives a change
function formChange() {
    if (active_countries[0] === "") return;
    var form_values = $('form#player-barchart-form').serializeArray().reduce(function(obj, item) {
        obj[item.name] = item.value;
        return obj;
    }, {});
    updatePlayersBarChart(form_values.order, form_values.ascdesc);
}

// change legend
function changeLegend(mode, country = "") {
    if (mode === "delete") {
        $("#stadium #legend-line-" + (no_countries_mode+1)).hide();
        return;
    }

    $("#stadium #legend").show()
        .children("#legend-line-" + (no_countries_mode+1)).show()
        .children("circle").attr("fill", function (index) {
            return colours[no_countries_mode]([0,0.5,1][index]);
        });

    $("#stadium #legend-line-" + (no_countries_mode+1) + " text").html(country);
}
