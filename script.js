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
var players_data = [];

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
    //resizePlayersBarChart();
    //createPlayerStats();
    createScatterPlot();
    resizeScatterplot();

    bindCountryHover();
    bindCountryUnhover();
    bindCountryClick();

    // to always have a country selcted
    $("#map-svg path[data-country=Austria]").trigger("click");
});

// what to  do on window resize
$(window).on("resize", function() {
    resizeBody($(this));
    resizeMap();
    resizeStadium();
    //resizePlayersBarChart();
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
    var new_height = c_width * 10/10.5;
    var new_width = c_height * 10.5/10;

    if (new_height <= c_height) $("svg#stadium").attr({"width": c_width, "height": new_height});
    else $("svg#stadium").attr({"width": new_width, "height": c_height});
}

// make the player scatterplot fit the container
function resizeScatterplot() {
    var scatter = $("#gpm_scatterplot");
    var dim = Math.min(scatter.parent().height(), scatter.parent().width()) - 28;
    scatter.attr({"height": dim, "width": dim});
}

// 
function resizePlayersBarChart() {
    var axis = $("#players-bar-chart-axis");
    var axis_dim = { "width": axis.width(), "height": axis.height() };
    console.log(axis_dim);
    var chart = $("#players-bar-chart");
    var chart_dim = { "width": chart.width(), "height": chart.height() };
    console.log(chart_dim);
    var parent = $("#gpm-bar-container");
    var parent_dim = { "width": parent.width(), "height": parent.height() };
    console.log(parent_dim);

    // resize axis
    axis.attr({
        "width": parent_dim.width,
        "height": parent_dim.width * (axis_dim.height / axis_dim.width)
    });

    chart.attr({
        "width": parent_dim.width,
        "height": parent_dim.width * (chart_dim.height / chart_dim.width)
    });
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
        current_attendance[2*no_countries_mode+1] = attendance_data.find(
            x => (x.country === this.dataset.country && x.occ_type === "national")
        ).years;

        current_attendance[2*no_countries_mode] = attendance_data.find(
            x => (x.country === this.dataset.country && x.occ_type === "league")
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
        country_colours.hover.reverse();
        country_colours.active.reverse();
        colours.reverse();

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
        $("#country-title-2").empty().append("<span class=\"suggestion inactive\">+ add country</span>");

        // remove from stadium chart
        current_attendance[0] = current_attendance[1] = empty_attendance;

        // remove legend
        changeStadiumLegend("delete");
        $("#stadium #legend").hide();
        no_countries_mode = 0;

        // remove bar chart
        updatePlayersBarChart("total-gpm", "delete");

        // to always have a country selcted
        country_colours = {"hover": ["#72de78", "#a873de"], "active": ["#4bc551", "#874ac4"], "normal": "#aaa"}
        colours = [d3.scaleLinear().domain([-1,0,0,1]).range(["#666", "#666", "white", "#00ff0e"]),d3.scaleLinear().domain([-1,0,0,1]).range(["#666", "#666", "white", "#7f00ff"])];
        $("#map-svg path[data-country=Austria]").trigger("click");
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
    var indexes = [0,0,1,0,2,0,3]; // needed to have the interior circles with lower section number
    var stadium = d3.select("#stadium");
    var center = {"x":450,"y":500};
    var angle_step = (-1) * Math.PI / 10; // we'll be having steps of 36 degrees
    var start_angle = - Math.PI / 2; // starting at 90 degrees south
    var point_1, point_2, d, g, i, j;

    // radiuses of each ellipsis drawn
    var radius = [
        {"x": 285, "y": 380},
        {"x": 210, "y": 280},
        {"x": 190, "y": 260},
        {"x": 115, "y": 160},
        {"x": 285, "y": 380},
        {"x": 210, "y": 280},
        {"x": 190, "y": 260},
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
    for (i = 0; i < 7; i++) {
        // ignore inner padding circle
        if ([1,5].includes(i)) continue;

        // create ten sectors for each section
        for (j = 0; j < 10; j++) {
            point_1 = polarToCartesian(center.x, center.y, radius[i].x, radius[i].y, start_angle + j * (i > 3 ? -1 : 1) * angle_step);
            point_2 = polarToCartesian(center.x, center.y, radius[i].x, radius[i].y, start_angle + (j + 1) * (i > 3 ? -1 : 1) * angle_step);
            point_3 = polarToCartesian(center.x, center.y, radius[i+1].x, radius[i+1].y, start_angle + (j + 1) * (i > 3 ? -1 : 1) * angle_step);
            point_4 = polarToCartesian(center.x, center.y, radius[i+1].x, radius[i+1].y, start_angle + j * (i > 3 ? -1 : 1) * angle_step);

            // generate path string
            d = [
                "M", point_1.x, point_1.y,
                "A", radius[i].x, radius[i].y, 0, 0, i > 3 ? 1 : 0, point_2.x, point_2.y,
                "L", point_3.x, point_3.y,
                "A", radius[i+1].x, radius[i+1].y, 0, 0, (i < 3 ? 1 : 0), point_4.x, point_4.y,
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

    // add ridge between countries
    for (i = 0; i < 3; i++) {
        if (i == 1) continue;

        for (j = -1; j <= 1; j += 2) {
            stadium.append("path")
                .attr("d", ["M", center.x, center.y + j * radius[i].y - 2, "L", center.x, center.y + j * radius[i+1].y, "Z"].join(" "))
                .attr("fill", "transparent")
                .attr("stroke", "rgb(30,30,30)")
                .attr("stroke-width", "20px");
        }
    } 

    // add "Club" and "NT" markers
    stadium.append("text").attr("class", "cnt-label").text("League").attr("text-anchor", "middle").attr("alignment-baseline", "middle").attr("x", center.x).attr("y", 2 + center.y - (radius[0].y + radius[1].y) / 2);
    stadium.append("text").attr("class", "cnt-label").text("NT").attr("text-anchor", "middle").attr("alignment-baseline", "middle").attr("x", center.x).attr("y", 2 + center.y - (radius[2].y + radius[3].y) / 2);

    // bind data to filled 
    udpateStadium();

    // adding year labels
    for (i = 0; i < 2; i++) {
        start_angle = - (i > 0 ? 11 : 9) * Math.PI / 20;
        for (j = 0; j < 10; j++) {
            point_1 = polarToCartesian(center.x, center.y, radius[0].x + 15, radius[0].y + 15, start_angle + j * (i > 0 ? 1 : -1) * angle_step);
            stadium.append("text")
                .text(2011 + j)
                .attr("text-anchor", i > 0 ? "end" : "start")
                .attr("alignment-baseline", j > 4 ? "hanging" : "baseline")
                .attr("x", point_1.x)
                .attr("y", point_1.y);
        }
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
/*                           (5) PLAYER ID                          */
/* ================================================================ */
function createPlayerStats(){
    $.ajax({
        async: false,
        type: "GET",  
        url: "data/players_gpm.csv",
        dataType: "text",       
        success: function (response) {
            $.csv.toObjects(response).forEach(function (item) {
                item.years = [];
                for (var y = 2011; y <= 2020; y++) {
                    item.years.push(item[y]);
                    delete item[y];
                }
                players_data.push(item);
            });
            console.log(players_data);
        }   
    });
}
function updatePlayerStats(playerID){
    height = 150;
    corner_round = 0;

    var player_club = players_data.filter(
        x => (x.id === playerID && x.type === "club")
    )

    var player_nt = players_data.filter(
        x => (x.id === playerID && x.type === "nt")
    )
    console.log(player_club);
    var gpm_nat = d3.scaleLinear()
                .domain([0, 1])
                .range([0, height]);

    var gpm_club = d3.scaleLinear()
                .domain([0, 1])
                .range([0, height]);

    underscore = 0;

    //IMAGE
    $("#player-id").show();
    $("#player-id .image").attr("src", "images/players/" + playerID + ".png")

    //INFO
    var age = new Date(Date.now() - Date.parse(player_club[0].dob)).getFullYear() - 1970
    $("#player-name").html("<b>Name: </b>"+ player_club[0].full_name);
    $("#player-birth").html("<b>Date of Birth: </b>"+ player_club[0].dob + " (" + age + " years)");
    $("#player-years-active").html("<b>Years Active: </b>"+ player_club[0].years_active);

    //GPM-NT
    d3.select("#player-bar-nt-gpm")
        .append("rect")
        .attr("x", 1)
        .attr("y", height + 1 - gpm_nat)
        .attr("rx", corner_round)
        .attr("fill", "red") //change to color of country
        .attr("height", gpm_nat)
        .attr("width", 28);

    //GPM-CLUB
    d3.select("#player-bar-club-gpm")
        .append("rect")
        .attr("x", 1)
        .attr("y", height + 1 - gpm_club)
        .attr("rx", corner_round)
        .attr("fill", "red") //change to color of country
        .attr("height", gpm_club)
        .attr("width", 28);

    //Underscoreability
    d3.select("#player-bar-underscore")
        .append("rect")
        .attr("x", 1)
        .attr("y", height + 1 - underscore)
        .attr("rx", corner_round)
        .attr("fill", "red") //change to color of country
        .attr("height", underscore)
        .attr("width", 28);
    
    //GPM LINE CHART
    var margin = {top: 14, right: 14, bottom: 14, left: 14},
    width = 475 - margin.left - margin.right,
    height = 250 - margin.top - margin.bottom;

    var svg = d3.select("#player-line-gpm")
                .attr("width", width + margin.left + margin.right)
                .attr("height", height + margin.top + margin.bottom)
                .append("g")
                .attr("transform", "translate(" + margin.left + "," + margin.top + ")");
    
    // Add X axis --> it is a date format
    var x = d3.scaleBand()
                .domain([2011,2012,2013,2014,2015,2016,2017,2018,2019,2020])
                .range([margin.left, width - margin.right]);

    svg.append("g")
        .attr("transform", "translate(0," + (height - margin.top) + ")")        
        .attr("color", "white")
        .call(d3.axisBottom(x));
  
    // Add Y axis
    var y = d3.scaleLinear()
                .domain([0, 1.5])
                .range([height - margin.top, margin.bottom]);

    svg.append("g")
        .attr("transform", "translate(" + margin.left + ",0)")
        .attr("color", "white")
        .call(d3.axisLeft(y));
    
}

/* ================================================================ */
/*                      (6) PLAYER SCATTER PLOT                     */
/* ================================================================ */

function createScatterPlot() {
    var margin = {top: 14, right: 14, bottom: 14, left: 14},
    width = 495 - margin.left - margin.right,
    height = 495 - margin.top - margin.bottom;

    var svg = d3.select("#gpm_scatterplot")
        .attr("width", width)
        .attr("height", height)
        .attr("viewBox", `0 0 ${width} ${height}`);
}

function updateScatterplot() {

    var margin = {top: 14, right: 14, bottom: 14, left: 14},
    width = 495 - margin.left - margin.right,
    height = 495 - margin.top - margin.bottom;

    var players = players_compact_data.filter(
        x => (active_countries.includes(x.country))
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

    svg.selectAll(".player-circle")
        .data(players)
        .join("circle")
        .attr("class", "player-circle")
        .attr("data-playerid", function (d) { return d.id; })
        .attr("cx", function (d) { return x(d.club_avg); } )
        .attr("cy", function (d) { return y(d.nt_avg); } )
        .attr("r", 8)
        .attr("fill", function (d) { return country_colours.active[active_countries.indexOf(d.country)]; })
        .attr("style", "opacity: 0.85")
        /*.append("title")
        .text(function (d) {
            return (d.first_name !== "" ? `${d.first_name[0]}. ` : "") + `${d.last_name}`;
        })*/;

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

    // guide lines for hover / click
    d3.selectAll(".shl").remove();
    d3.select("#gpm_scatterplot").insert("line", ":first-child").attr("id", "scatter-help-line-hover-x").attr("class", "shl").attr("stroke", "grey");
    d3.select("#gpm_scatterplot").insert("line", ":first-child").attr("id", "scatter-help-line-hover-y").attr("class", "shl").attr("stroke", "grey");
    d3.select("#gpm_scatterplot").insert("line", ":first-child").attr("id", "scatter-help-line-active-x").attr("class", "shl").attr("stroke", "grey");
    d3.select("#gpm_scatterplot").insert("line", ":first-child").attr("id", "scatter-help-line-active-y").attr("class", "shl").attr("stroke", "grey");

    bindPlayerHover();
    bindPlayerUnhover();
    bindPlayerClick();
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
    var max_w = Math.max(
        Math.max.apply(Math, players.map(function(o) { return o.nt_avg; })),
        Math.max.apply(Math, players.map(function(o) { return o.club_avg; }))
    );

    // maximum width tick value
    var max_w_scale = Math.ceil(max_w * 10) / 10;
    var y_scale_data = players.map((p) => p.full_name);

    var svg = d3.select("#players-bar-chart")
        .attr("height", players.length * 40 + 10)
        .attr("viewBox", "0 0 368 " + (players.length * 40 + 10));
    var axis = d3.select("#players-bar-chart-axis");

    // discrete scale for the players axis
    var y_scale = d3.scaleBand()
        .domain(y_scale_data)
        .range([15, players.length * 40]);

    // continuous linear scale for the values
    var w_scale = d3.scaleLinear()
        .domain([0, max_w_scale])
        .range([padding, 215]);

    // adding the nt gpm
    svg.selectAll(".player-bar-rect-nt")
        .data(players)
        .join("rect")
        .attr("class", "player-bar-rect-nt")
        .attr("data-playerid", function (d) { return d.id; })
        .attr("fill", function (d) { return country_colours.active[active_countries.indexOf(d.country)]; })
        .attr("x", padding)
        .attr("y", function (d) { return y_scale(d.full_name); })
        .attr("height", (y_scale.bandwidth() - 15) / 2)
        .attr("width", function (d) { return w_scale(d.nt_avg) - padding; })
        .append("title")
        .text(function (d) { return d.nt_avg; });

    // adding the club gpm
    svg.selectAll(".player-bar-rect-club")
        .data(players)
        .join("rect")
        .attr("class", "player-bar-rect-club")
        .attr("data-playerid", function (d) { return d.id; })
        .attr("fill", function (d) { return country_colours.hover[active_countries.indexOf(d.country)]; })
        .attr("x", padding)
        .attr("y", function (d) { return y_scale(d.full_name) + (y_scale.bandwidth() - 15) / 2; })
        .attr("height", (y_scale.bandwidth() - 15) / 2)
        .attr("width", function (d) { return w_scale(d.club_avg) - padding; })
        .append("title")
        .text(function (d) { return d.club_avg; });

    // adding the red marker for total gpm
    svg.selectAll(".player-bar-rect-avg")
        .data(players)
        .join("path")
        .attr("d", function(d) {
            return [
                "M", w_scale(d.player_avg), y_scale(d.full_name),
                "L", w_scale(d.player_avg) - 5, y_scale(d.full_name) - 5,
                "L", w_scale(d.player_avg) + 5, y_scale(d.full_name) - 5,
            ].join(" ");
        })
        .attr("class", "player-bar-rect-avg")
        .attr("data-playerid", function (d) { return d.id; })
        .attr("fill", "red")
        .append("title")
        .text(function (d) { return d.player_avg; });

    // putting the players' name on the right
    svg.selectAll(".player-bar-text")
        .data(players)
        .join("text")
        .attr("class", "player-bar-text")
        .attr("data-playerid", function (d) { return d.id; })
        .attr("style", "text-anchor: start; alignment-baseline: middle")
        .attr("fill", "white")
        .attr("x", function (d) { return w_scale(Math.max(d.club_avg, d.nt_avg)) + 10; })
        .attr("y", function (d) { return y_scale(d.full_name) + (y_scale.bandwidth() - 12) / 2; })
        .text(function (d) {
            return (d.first_name !== "" ? `${d.first_name[0]}. ` : "") +
                `${d.last_name} - ${d[decode[mode]]}`;
        })
        .attr("textLength", function (d) {
            // checks if compressing the player label is needed
            if (this.getBoundingClientRect().width * 1.15 > 354 - w_scale(Math.max(d.club_avg, d.nt_avg)))
                return 354 - 10 - w_scale(Math.max(d.club_avg, d.nt_avg));
            return 0;
        });

    // remove previous width axis and add new one
    axis.select("#w_axis").remove();
    axis.append("g")
        .attr("transform", "translate(0,40)")
        .attr("id", "w_axis")
        .attr("color", "white")
        .call(d3.axisTop()
            .scale(w_scale)
            .ticks(max_w_scale > 1 ? max_w_scale / 2 : max_w_scale * 10)
        );

    // remove previous width axis label and add new one
    axis.select("#axis-label").remove();
    axis.append("text")
        .attr("id", "axis-label")
        .attr("style", "text-anchor: middle; alignment-baseline: baseline; transform: translate(114px, 12px)")
        .attr("fill", "white")
        .attr("class", "label")
        .text($(`label[for=${mode}]`).text());

    // remove previous height axis and add new one
    svg.select("#y_axis").remove();
    svg.append("g")
        .attr("transform", "translate(14,-1)")
        .attr("id", "y_axis")
        .attr("color", "white")
        .call(d3.axisLeft()
            .scale(d3.scaleBand()
            .range([0, players.length * 40]))
            .tickSize(0)
            .tickValues([])
        );

    // if no country's selected, delete axes
    if (ascdesc === "delete") {
        svg.select("#w_axis").remove();
        svg.select("#axis-label").remove();
        svg.select("#y_axis").remove();
    }

    bindPlayerHover();
    bindPlayerUnhover();
    bindPlayerClick();
}

// binds hovering to a player's bars and dot
function bindPlayerHover() {
    $(".player-bar-rect-nt, .player-bar-rect-club, .player-bar-rect-avg, .player-bar-text, .player-circle").on("mouseover", function () {
        // if the hovered item is active, ignore all this
        if (this.dataset.playeractive === "true") return;

        var circle = $(`.player-circle[data-playerid=${this.dataset.playerid}]`);
        var text = $(`.player-bar-text[data-playerid=${this.dataset.playerid}]`);

        // style the hovered player
        text.css("font-weight", 900);
        circle.css({"stroke": "white", "stroke-width": 3});

        // scroll bar chart if player not in sight
        var top_el = $(`.player-bar-rect-avg[data-playerid=${this.dataset.playerid}]`).position().top;
        var top_dad = $("#bar-chart-div").position().top;
        var height_dad = $("#bar-chart-div").height();

        if (this.localName === "circle")
            if (top_el < top_dad || top_el + 29 > top_dad + height_dad)
                $("#bar-chart-div").animate({
                    scrollTop: top_el - top_dad
                }, 500);

        // set up the hover guide lines
        d3.select("#scatter-help-line-hover-y")
            .attr("x1", circle.attr("cx"))
            .attr("x2", circle.attr("cx"))
            .attr("y1", parseInt(circle.attr("cy")) + parseInt(circle.attr("r")))
            .attr("y2", 427);
        $("#scatter-help-line-hover-y").show();

        d3.select("#scatter-help-line-hover-x")
            .attr("x1", parseInt(circle.attr("cx")) - parseInt(circle.attr("r")))
            .attr("x2", 53)
            .attr("y1", circle.attr("cy"))
            .attr("y2", circle.attr("cy"));
        $("#scatter-help-line-hover-x").show();
    });
}

// binds unhovering to a player's bars and dot
function bindPlayerUnhover() {
    $(".player-bar-rect-nt, .player-bar-rect-club, .player-bar-rect-avg, .player-bar-text, .player-circle").on("mouseout", function () {
        // if the unhovered item is active, ignore all this
        if (this.dataset.playeractive === "true") return;

        // remove the styling from the unhovered player
        $(`.player-bar-text[data-playerid=${this.dataset.playerid}]`).css("font-weight", "normal");
        $(`.player-circle[data-playerid=${this.dataset.playerid}]`).css({"stroke": "none"});

        // hide the hover lines
        $("#scatter-help-line-hover-y").hide();
        $("#scatter-help-line-hover-x").hide();
    });
}

// binds the clicking event to a circle or a bar
function bindPlayerClick() {
    $(".player-bar-rect-nt, .player-bar-rect-club, .player-bar-rect-avg, .player-bar-text, .player-circle").on("click", function () {
        var circle = $(`.player-circle[data-playerid=${this.dataset.playerid}]`);

        // remove the styling from all elements except the one clicked
        $(`.player-bar-text:not([data-playerid=${this.dataset.playerid}])`).css("font-weight", "normal");
        $(`.player-circle:not([data-playerid=${this.dataset.playerid}])`).css({"stroke": "none"});

        // remove the "active" tag from all elements and add it to the one clicked
        $(".player-bar-rect-nt, .player-bar-rect-club, .player-bar-rect-avg, .player-bar-text, .player-circle").attr("data-playeractive", "false");
        $(`[data-playerid=${this.dataset.playerid}]`).attr("data-playeractive", "true");

        // set up the active lines and remove the hover one
        d3.select("#scatter-help-line-active-y")
            .attr("x1", circle.attr("cx"))
            .attr("x2", circle.attr("cx"))
            .attr("y1", parseInt(circle.attr("cy")) + parseInt(circle.attr("r")))
            .attr("y2", 427);
        $("#scatter-help-line-active-y").show();
        $("#scatter-help-line-hover-y").hide();

        d3.select("#scatter-help-line-active-x")
            .attr("x1", parseInt(circle.attr("cx")) - parseInt(circle.attr("r")))
            .attr("x2", 53)
            .attr("y1", circle.attr("cy"))
            .attr("y2", circle.attr("cy"));
        $("#scatter-help-line-active-x").show();
        $("#scatter-help-line-hover-x").hide();

        //updatePlayerStats(this.dataset.playerid);
    });
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
    // in case it's RGB
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
    var form_values = $("form#player-barchart-form").serializeArray().reduce(function(obj, item) {
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
