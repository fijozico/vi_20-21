/* ================================================================ */
/*                         GLOBAL VARIABLES                         */
/* ================================================================ */
var map;
var no_countries_mode = 0;
var normal_country_color = "#aaa";
var country_colors;

// holds the current active countries
var active_countries = ["",""];
var active_countries_colors = [null,null];
var attendance_data = [];
var empty_attendance = [-1,-1,-1,-1,-1,-1,-1,-1,-1,-1];
var current_attendance = [empty_attendance,empty_attendance,empty_attendance,empty_attendance];
var players_compact_data = [];
var players_data = [];
var country_rank = {};
var country_happiness = {};
var country_gpm = {};
var players;
var players_total_gpm = 0;

// text to display when hovering for help
var help = {
    "map": "Click a country's position or name to select it. Add a second country to compare with by clicking '+ add country' below. Remove countries by closing them with the cross to see global data.",
    "spider": "Brief display of a country's National Team Points, Happiness Index, Stadium Occupancy on National Team games, Stadium Occupancy on National League games and average National Goals per Match.",
    "happiness": "Curve growth correlation between Happiness Index and National Team Points.",
    "stadium": "National Team and League stadium occupancy. The color saturation hints the occupation by year in each section. Hovering over the sections shows the stadium occupancy in percentage",
    "player": "Brief Player Statistics and average GPM. The line chart compares National Team GPM and Club GPM over the years.",
    "scatterplot": "2D GPM plot. Y axis represents National Team GPM and X axis represents Club GPM. Clicking or hovering on the dots, highlights the player in other idioms.",
    "barchart": "Click on the radio buttons to sort the players by different parameters or click on the switch to change the order. Clicking or hovering on the bars, highlights the player in other idioms. ",
    "underscore": "National Team Proficiency represents how much better a player is on the national team compared to their club, based on the average goals scored. Clicking or hovering on the dots, highlights the player in other idioms."
};

/* ================================================================ */
/*                        INITIAL GENERATION                        */
/* ================================================================ */
// what to do when the page loads
$(window).on("load", function () {
    loadDatabases();    

    resizeBody($(this));
    createMap();
    resizeMap();
    createStadium();
    resizeStadium();
    createGauge();
    resizeGauge();
    createScatterPlot();
    resizeScatterplot();
    createPlayersBarChart();
    resizePlayersBarChart();
    createPlayerStats();
    resizePlayerStats();
    createHappinessChart();
    resizeHappinessChart();
    createSpiderChart();
    resizeSpiderChart();

    bindCountryHover();
    bindCountryUnhover();
    bindCountryClick();
    bindHelpHover();
});

// what to do on window resize
$(window).on("resize", function () {
    resizeBody($(this));
    resizeMap();
    resizeStadium();
    resizePlayersBarChart();
    resizePlayerStats();
    resizeHappinessChart();
    resizeGauge();
    resizeScatterplot();
    resizeSpiderChart();
});

// loads all necessary files
function loadDatabases(){
    // load country colors
    $.ajax({
        async: false,
        url: "data/country_colors.json",
        success: function (json) {
            country_colors = json;
            Object.keys(country_colors).forEach(function (country) {
                country_colors[country].scale = []

                // for each country, add the two color scales
                for (var i = 0; i < 2; i++) {
                    var hue = country_colors[country].active[i].replace(/[^\d,]/g, "").split(",")[0];
                    country_colors[country].active[i] = HSLtoRGB(country_colors[country].active[i]);
                    country_colors[country].hover[i] = HSLtoRGB(country_colors[country].hover[i]);
                    country_colors[country].scale[i] = d3
                        .scaleLinear()
                        .domain([-1, 0, 0, 1])
                        .range(["rgb(102,102,102)", "rgb(102,102,102)", "white",
                            hue !== "69" ? HSLtoRGB(`hsl(${hue},100%,50%)`) : HSLtoRGB(`hsl(${hue},0%,0%)`)
                        ]);
                }
            });
        }
    });

    // load compact players data (no need to have a yearly discrimination)
    $.ajax({
        async: false,
        type: "GET",  
        url: "data/players_gpm_compact.csv",
        dataType: "text",       
        success: function (response) {
            players_compact_data = $.csv.toObjects(response);

            for (var i = 0; i < players_compact_data.length; i++)
                players_total_gpm += parseFloat(players_compact_data[i].nt_avg);

            players_total_gpm /= players_compact_data.length;
        }   
    });

    // get compact ranking CSV
    $.ajax({
        async: false,
        type: "GET",  
        url: "data/fifa_national_team_rankings_2008_2018.csv",
        dataType: "text",       
        success: function (response) {
            var x = 2008;
            $.csv.toObjects(response).forEach(function (item) {
                var values = [];
                for (var i = 0; i < 11; i++) {
                    values.push([x + i, item["Dec-" + (x + i).toString().slice(2,4)]]);
                }
                country_rank[item.country] = values;
            });

            var values = [];
            for (var i = 0; i < 11; i++) {
                var value = 0;
                for (country in country_rank) {
                    value += parseInt(country_rank[country][i][1]);
                }
                values.push([2008 + i, value / Object.keys(country_rank).length]);
            }
            country_rank["Overall"] = values;
        }   
    });

    // get compact happiness CSV
    $.ajax({
        async: false,
        type: "GET",  
        url: "data/happiness_index_compact.csv",
        dataType: "text",       
        success: function (response) {
            $.csv.toObjects(response).forEach(function (item) {
                country_happiness[item.country] = [["2008", item[2008]], ["2018", item[2018]]];
                country_gpm[item.country] = item.nt_gpm;
            });

            var values = [];
            for (var i = 0; i < 2; i++) {
                var value = 0;
                for (country in country_happiness) {
                    value += parseInt(country_happiness[country][i][1]);
                }
                values.push([2008 + i * 10, value / Object.keys(country_happiness).length]);
            }
            country_happiness["Overall"] = values;
        }   
    });

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

            var values = [];
            ["league", "national"].forEach(function (item) {
                var value = 0;
                for (var j = 0; j < attendance_data.length; j++)
                    value += attendance_data[j].occ_type === item ? parseFloat(attendance_data[j].occ_avg) : 0;
                values.push({"country": "Overall", "occ_type": item, "occ_avg": value / (attendance_data.length / 2)});
            });
            attendance_data.push(values[0]);
            attendance_data.push(values[1]);
        }   
    });
    
    // load full players dataset
    $.ajax({
        async: false,
        type: "GET",  
        url: "data/players_gpm.csv",
        dataType: "text",       
        success: function (response) {
            $.csv.toObjects(response).forEach(function (item) {
                item.years = [];
                for (var y = 1991; y <= 2020; y++) {
                    item.years.push(item[y]);
                    delete item[y];
                }
                players_data.push(item);
            });
        }   
    });
}

/* ================================================================ */
/*                      RESIZING AND HELP BOXES                     */
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

// resizes spiderchart to fit container
function resizeSpiderChart() {
    var spider = $("#spider_chart");
    var dim = Math.min(spider.parent().height(), spider.parent().width() * (236 / 463));
    spider.attr({"height": dim, "width": dim * (463 / 236)});
}

// resizes happiness vs NT performance line chart
function resizeHappinessChart() {
    var happiness = $("#country-line-chart-svg");
    var dim = Math.min(happiness.parent().height(), happiness.parent().width() * (217 / 385));
    happiness.attr({"height": dim, "width": dim * (385 / 217)});
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

// resizes the player stats' linechart
function resizePlayerStats() {
    // resize bars
    var parent_chart = $("#pc-right-top");
    var parent_chart_dim = { "width": parent_chart.width(), "height": parent_chart.height() };

    $(".player-bar").attr({
        "width": parent_chart_dim.width * (30 / 525),
        "height": parent_chart_dim.height * (152 / 525)
    });

    // resize line chart
    var player_chart = $("#player-line-gpm");
    var dim = Math.min(player_chart.parent().height(), player_chart.parent().width() * (314 / 542));
    player_chart.attr({"height": dim, "width": dim * (542 / 314)});
}

// make the player scatterplot fit the container
function resizeScatterplot() {
    var scatter = $("#gpm_scatterplot");
    var dim = Math.min(scatter.parent().height(), scatter.parent().width()) - 8;
    scatter.attr({"height": dim, "width": dim});
}

// resizes the players' barchart
function resizePlayersBarChart() {
    var axis = $("#players-bar-chart-axis");
    var axis_dim = { "width": axis.width(), "height": axis.height() };
    var parent_axis = $("#gpm-bar-container");
    var parent_axis_dim = { "width": parent_axis.width(), "height": parent_axis.height() };

    var chart = $("#players-bar-chart");
    var chart_dim = { "width": chart.width(), "height": chart.height() };
    var parent_chart = $("#gpm-bar-container");
    var parent_chart_dim = { "width": parent_chart.width(), "height": parent_chart.height() };

    // resize axis
    axis.attr({
        "width": parent_axis_dim.width,
        "height": parent_axis_dim.width * (40 / 382)
    });

    chart.attr({
        "width": parent_chart_dim.width,
        "height": parent_chart_dim.width * (chart_dim.height / chart_dim.width)
    });

    // resize legends
    $("#bar-chart-legend-avg").attr({
        "width": parent_chart_dim.width * (12 / 384),
        "height": parent_chart_dim.height * (12 / 384)
    });

    $("#bar-chart-legend-club, #bar-chart-legend-nt").attr({
        "width": parent_chart_dim.width * (29 / 384),
        "height": parent_chart_dim.height * (12 / 384)
    });
}

// resizes the underscorability gauge
function resizeGauge() {
    var gauge = $(".gauge");
    var dim = Math.min(gauge.parent().height(), gauge.parent().width() * (470 / 380));
    gauge.attr({"height": dim, "width": dim * (380 / 470)});
}

// manipulate help box
function bindHelpHover() {
    $(".info-button").on("mouseover", function () {
        $(".help-box").fadeIn(250).css({
            "left": $(this).offset().left + $(this).outerWidth() + parseInt($(this).css("margin-left").slice(0,-2)),
            "top": $(this).offset().top - 4,
        })
        .children("p").text(help[this.dataset.infoName]);
    })

    $(".info-button").on("mouseout", function () {
        $(".help-box").fadeOut(250);
    })
}

/* ================================================================ */
/*                     (1) COUNTRY LIST AND MAP                     */
/* ================================================================ */
// loads the SVG map and the country list from countries_svg.json
function createMap() {
    map = $("svg#map-svg");
    var list_ul = $("#country-pick");
    var country_list = [];
    var new_path, title;

    // load countries' SVG info and generate map
    $.ajax({
        async: false,
        url: "data/countries_svg.json",
        success: function (json) {
            json.forEach(function (item) {
                // adds each country to the SVG; needs to be done in pure JS because jQuery doesn"t handle SVG
                new_path = document.createElementNS("http://www.w3.org/2000/svg", "path");
                new_path.setAttributeNS(null, "d", item.d);
                new_path.setAttributeNS(null, "style", "fill: " + (item.country == "" ? "#666" : "#aaa"));
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
        var color_no = getCountryColor(this.dataset.country);

        // this way, it deals with all the country"s paths, along with the list item
        $("svg#map-svg path[data-country=" + this.dataset.country + "], ul#country-pick li#li-" + this.dataset.country).each(function () {
            // if it's the path, just changes its color
            if (this.localName == "path" && !["0","1"].includes($(this).attr("data-active")))
                $(this).css("fill", country_colors[this.dataset.country].hover[color_no]);

            // if it's the list item, only "hovers" it if item not active
            // important because list item may be "hovered" (temporary highlight) or "active" (permanent highlight)
            else if (this.localName == "li" && (this.dataset.active === undefined || this.dataset.active === "-1"))
                $(this).css({
                    "background-color": country_colors[this.dataset.country].hover[color_no],
                    "color": textcolor(country_colors[this.dataset.country].hover[color_no])
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
                $(this).css("fill", normal_country_color);

            else if (this.dataset.active === undefined || this.dataset.active === "-1")
                $(this).attr("style", "")[0].dataset.hovered = -1;
        });
    });
}

// clicking on the country (map or list)
function bindCountryClick() {
    $("svg#map-svg path:not(.greyed-out), ul#country-pick li").on("click", function () {
        var color_no = getCountryColor(this.dataset.country);

        if (this.dataset.active !== undefined && this.dataset.active !== "-1") return;
        
        // deselect active country
        $("svg#map-svg path:not(.greyed-out)[data-active=" + no_countries_mode + "]").each(function () {
            $(this).css("fill", normal_country_color)[0].dataset.active = -1;
            $("li#li-" + this.dataset.country).attr("style", "")[0].dataset.active = -1;
        });

        // puts flag and name in the first country slot
        $("#country-title-" + (no_countries_mode+1)).empty().append(insertCountryBar(
            "images/flags/flag-" + this.dataset.country + ".png", // image source
            this.dataset.country.replaceAll("-"," "), // country name with spaces
            this.dataset.country // country name with dashes
        ));

        if (this.localName == "path") {
            // scroll country list if country not in sight
            var top_el = $(`ul#country-pick li#li-${this.dataset.country}`).position().top;
            var top_dad = $("ul#country-pick").position().top;
            var height_dad = $("ul#country-pick").height();
            
            if (top_el < top_dad || top_el > top_dad + height_dad)
                $("ul#country-pick").animate({ scrollTop: top_el - top_dad }, 0);
        }

        // stores country name as first one selected
        active_countries[no_countries_mode] = this.dataset.country;
        active_countries_colors[no_countries_mode] = color_no;

        // adds country to stadium chart
        current_attendance[2 * no_countries_mode + 1] = attendance_data.find(
            x => (x.country === this.dataset.country && x.occ_type === "national")
        ).years;

        current_attendance[2 * no_countries_mode] = attendance_data.find(
            x => (x.country === this.dataset.country && x.occ_type === "league")
        ).years;

        udpateStadium();

        // permanently select clicked country
        $("svg#map-svg path[data-country=" + this.dataset.country + "], ul#country-pick li#li-" + this.dataset.country).each(function () {
            $(this).css("fill", country_colors[this.dataset.country].active[color_no])[0].dataset.active = no_countries_mode;
            $("li#li-" + this.dataset.country)[0].dataset.active = no_countries_mode;
            $("li#li-" + this.dataset.country).css({
                "background-color": country_colors[this.dataset.country].active[color_no],
                "color": textcolor(country_colors[this.dataset.country].active[color_no])
            })[0].dataset.hovered = -1;
        });

        // needed so people may add a second country
        if (no_countries_mode === 0) $("#country-title-2").empty().append("<span class=\"add-country\" onclick=\"switchCountryState(2)\">+ add country</span>");

        // place colors on legend
        changeLegend("", this.dataset.country.replaceAll("-"," "));

        // puts the players on the bar chart
        formChange();

        // updates the player scatterplot
        updateScatterplot();
        updateGauge();
        
        updateHappinessChart();
        updateSpiderChart();
    });
}

// what happens when you click the cross next to the country name
function closeCountry(country) {
    // deselect country on map and list
    $("svg#map-svg path[data-country=" + country + "], ul#country-pick li#li-" + country).each(function () {
        if (this.localName == "path") $(this).css("fill", normal_country_color)[0].dataset.active = -1;
        else $(this).attr("style", "")[0].dataset.active = -1;
    });

    var index = active_countries.indexOf(country);

    // if it was the second, simply removes it
    if (index === 1) {
        active_countries[1] = "";
        active_countries_colors[1] = null;

        $("#country-title-2").empty().append("<span class=\"add-country\" onclick=\"switchCountryState(2)\">+ add country</span>");

        // remove from stadium chart
        current_attendance[2] = current_attendance[3] = empty_attendance;

        // remove stadium legend
        changeLegend("delete");
        no_countries_mode = 0;

        // fetches current form state and updates bar chart
        formChange();
    }

    // if it's the first, and the second's defined, moves the second to its place
    else if (index === 0 && $("#country-title-2").children().length > 1) {
        $("#pc-left-top [data-country=" + active_countries[1] + "]").each(function () {
            if (this.localName == "path")
                $(this).attr("data-active", 0).css("fill", country_colors[active_countries[no_countries_mode]].active[active_countries_colors[1]]);

            else
                $(this).attr("data-active", 0).css({
                    "background-color": country_colors[active_countries[no_countries_mode]].active[active_countries_colors[1]],
                    "color": textcolor(country_colors[active_countries[no_countries_mode]].active[active_countries_colors[1]])
                });
        });
        active_countries = active_countries.slice(1,2).concat([""]);
        active_countries_colors = active_countries_colors.slice(1,2).concat([null]);

        $("#country-title-1").empty().append($("#country-title-2").children());
        $("#country-title-2").empty().append("<span class=\"add-country\" onclick=\"switchCountryState(2)\">+ add country</span>");

        // remove from stadium chart
        current_attendance = current_attendance.slice(2,4).concat([empty_attendance,empty_attendance]);

        // remove legend
        changeLegend("delete");
        no_countries_mode = 0;
        changeLegend("", active_countries[0]);

        // fetches current form state and updates bar chart
        formChange();
    }

    // if it's the first and only, removes it
    else {
        active_countries[0] = "";
        active_countries_colors[0] = null;

        $("#country-title-1").empty().append("<span class=\"suggestion\">Select a country above...</span>");
        $("#country-title-2").empty().append("<span class=\"suggestion inactive\">+ add country</span>");

        // remove from stadium chart
        current_attendance[0] = current_attendance[1] = empty_attendance;

        // remove legend
        changeLegend("delete");
        $("#stadium #legend").fadeOut(500);
        no_countries_mode = 0;

        // remove bar chart
        updatePlayersBarChart("total-gpm", "delete");
    }

    udpateStadium();
    updateScatterplot();
    updateSpiderChart();
    updateHappinessChart();

    setTimeout(function () {
        $(".player-bar-rect-nt:nth-of-type(1)").trigger("mouseover");
        $(".player-bar-rect-nt:nth-of-type(1)").trigger("click");
    }, 500);
    updateGauge();
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
/*                      (2) COUNTRIES' SPIDER CHART                 */
/* ================================================================ */
// creates the quick stats spider chart
function createSpiderChart() {
    var width = 463;
    var height = 258;
    var centerX = width / 2;
    var centerY = (height / 2) - 10;
    var numPoints = 5;

    var pentagon = d3.line()
        .x(function(d) { return d.x; })
        .y(function(d) { return d.y; })
        .curve(d3.curveLinearClosed);

    var svg = d3.select('#spider_chart')
        .attr('width', width)
        .attr('height', height - 22)
        .attr("viewBox", `0 0 ${width} ${height - 22}`);

    // creating 5 pentagons
    for (index = 0; index < 5; index++) {
        var radius = (height / 3) - 17 * index;
    
        var points = d3.range(numPoints).map(i => {
            var angle = i / numPoints * Math.PI * 2 + Math.PI;
            return {
                x: Math.sin(angle) * radius + centerX,
                y: Math.cos(angle) * radius + centerY
            };
        });

        var spokes = points.map(point => ({
            x1: centerX,
            y1: centerY,
            x2: point.x,
            y2: point.y
        }));
    
        var wheelLines = d3.range(numPoints).map(i => ({
            x1: points[i].x,
            y1: points[i].y,
            x2: points[(i + 1) % numPoints].x,
            y2: points[(i + 1) % numPoints].y
        }));
    
        var lines = spokes.concat(wheelLines);
        
        var path = svg.insert('path', ":first-child")
            .attr('d', pentagon(points))
            .attr('stroke', 'white')
            .attr('stroke-width', 1)
            .attr('fill', 'transparent');
    }

    // creating lines connectiong center to edges
    svg.insert('line', ":first-child")
        .style("stroke", "white")
        .style("stroke-width", 1)
        .attr('fill', 'transparent')
        .attr("x1", centerX)
        .attr("y1", centerY)
        .attr("x2", 315)
        .attr("y2", 92);

    svg.insert('line', ":first-child")
        .style("stroke", "white")
        .style("stroke-width", 1)
        .attr('fill', 'transparent')
        .attr("x1", centerX)
        .attr("y1", centerY)
        .attr("x2", 284)
        .attr("y2", 189);

    svg.insert('line', ":first-child")
        .style("stroke", "white")
        .style("stroke-width", 1)
        .attr('fill', 'transparent')
        .attr("x1", centerX)
        .attr("y1", centerY)
        .attr("x2", 182)
        .attr("y2", 189);

    svg.insert('line', ":first-child")
        .style("stroke", "white")
        .style("stroke-width", 1)
        .attr('fill', 'transparent')
        .attr("x1", centerX)
        .attr("y1", centerY)
        .attr("x2", 233)
        .attr("y2", 33);

    svg.insert('line', ":first-child")
        .style("stroke", "white")
        .style("stroke-width", 1)
        .attr('fill', 'transparent')
        .attr("x1", centerX)
        .attr("y1", centerY)
        .attr("x2", 151)
        .attr("y2", 92);

    // inserts initial path in the center (important for animating)
    var path = svg.selectAll('.spider-path').attr('d', [
        "M", centerX, centerY,
        "L", centerX, centerY,
        "L", centerX, centerY,
        "L", centerX, centerY,
        "L", centerX, centerY,
        "Z"
    ].join(" "));

    updateSpiderChart();
}

// updates spiderchart line when needed
function updateSpiderChart() {
    var width = 463;
    var height = 258;
    var centerX = width / 2;
    var centerY = (height / 2) - 10;

    var pentagon = d3.line()
        .x(function(d) { return d[0]; })
        .y(function(d) { return d[1]; })
        .curve(d3.curveLinearClosed);

    // checks if overall is to be used
    if (active_countries[0] === "") this_country = "Overall";
    else this_country = active_countries[no_countries_mode];

    // happiness value
    var happiness1 = country_happiness[this_country][1][1];
    happinessScale = d3.scaleLinear()
        .domain([0, 1000])
        .range([[centerX, centerY], [315, 92]]);
    var happinessPoint1 = happinessScale(happiness1);

    // national attendance
    var attendanceNational1 = attendance_data.find(
        x => (x.country === this_country && x.occ_type === "national")).occ_avg;
    nationalScale = d3.scaleLinear()
        .domain([0, 1])
        .range([[centerX, centerY], [284, 189]]);
    var nationalPoint1 = nationalScale(attendanceNational1);

    // league attendance
    var attendanceLeague1 = attendance_data.find(
        x => (x.country === this_country && x.occ_type === "league")).occ_avg;
    leagueScale = d3.scaleLinear()
        .domain([0, 1])
        .range([[centerX, centerY], [182, 189]]);
    var leaguePoint1 = leagueScale(attendanceLeague1);

    // FIFA points
    var rank1 = country_rank[this_country][10][1];
    rankScale = d3.scaleLinear()
        .domain([0, 2200])
        .range([[centerX, centerY], [233, 33]]);
    var rankPoint1 = rankScale(rank1);

    // average NT GPMs
    gpmScale = d3.scaleLinear()
        .domain([0, 0.5])
        .range([[centerX, centerY], [151, 92]]);
    
    if (active_countries[0] === "") var gpmPoint1 = gpmScale(players_total_gpm);
    else var gpmPoint1 = gpmScale(country_gpm[this_country]);

    var colorNo = function (country) {
        if (active_countries[0] === "") return 0;
        if (country === "Overall") return 0;
        return active_countries_colors[active_countries.indexOf(country)];
    };

    var points = [happinessPoint1, nationalPoint1, leaguePoint1, gpmPoint1, rankPoint1];
    
    var svg = d3.select('#spider_chart')
        .attr('width', width)
        .attr('height', height);

    // creates spiderchart line
    var path = svg.select('#spider-path-' + no_countries_mode)
        .attr('stroke-width', 4)
        .attr('fill-opacity', '0.15')
        .transition().duration(500)
        .attr('d', pentagon(points))
        .attr('stroke', country_colors[this_country].active[colorNo(this_country)])
        .attr('fill', country_colors[this_country].hover[colorNo(this_country)]);

    if (no_countries_mode === 0)
        d3.select('#spider-path-1')
            .transition().duration(500)
            .attr("d", [
                "M", centerX, centerY,
                "L", centerX, centerY,
                "L", centerX, centerY,
                "L", centerX, centerY,
                "L", centerX, centerY,
                "Z"
            ].join(" "))
            .attr("stroke", "transparent")
            .attr("fill", "transparent");

    // handles legends
    $(`#spider-legend-${no_countries_mode + 1}`).fadeIn(500);
    $("#spider-legend-" + (no_countries_mode + 1) + " text").html(
        active_countries[0] === "" ? "Worldwide" : this_country.replaceAll("-", " ")
    );

    d3.selectAll($("#spider-legend-" + (no_countries_mode + 1) + " circle"))
        .transition().duration(500)
        .attr("fill", country_colors[this_country].active[colorNo(this_country)]);

    if (no_countries_mode === 0) $("#spider-legend-2").fadeOut(500);
}

/* ================================================================ */
/*           (3) HAPPINESS VS NT PERFORMANCE VISUALIZATION          */
/* ================================================================ */
// creates the basis of the happiness vs NT performance line chart
function createHappinessChart() {
    var margin = {top: 14, right: 14, bottom: 14, left: 14},
    width = 413 - margin.left - margin.right,
    height = 215 - margin.top - margin.bottom;

    var svg = d3.select("#country-line-chart-svg")
        .attr("width", width)
        .attr("height", height + 30)
        .attr("viewBox", `0 0 ${width} ${height + 30}`)

    // add "Years" label
    svg.append("text")
        .attr("id", "player_years_label")
        .attr("x", width / 2 + 5 )
        .attr("y", height - 15)
        .attr("fill", "white")
        .style("text-anchor", "middle")
        .text("Years");

    // add "Curve Variation" label
    svg.append("text")
        .attr("id", "player_nt_label")
        .attr("transform", "rotate(-90)")
        .attr("y", - margin.left + 20)
        .attr("x", - (height / 2) + 10)
        .attr("dy", "1em")
        .attr("fill", "white")
        .style("text-anchor", "middle")
        .style("alignment-baseline", "baseline")
        .text("Curve Variation");
    
    var x = d3.scaleLinear()
        .domain([2007, 2019])
        .range([2 * margin.left + 25, width]);

    var y = d3.scaleLinear()
        .domain([0, 100])
        .range([height - 50, margin.bottom]);
    
    // add x axis
    svg.insert("g", ":first-child")
        .attr("transform", "translate(0," + (height - 50)  + ")")
        .attr("id", "happiness_x")
        .attr("color", "white")
        .call(d3.axisBottom(x)
            .tickFormat(d3.format("d"))
            .tickSizeOuter(0).ticks(6))
    
    // add y axis
    svg.insert("g", ":first-child")
        .attr("transform", "translate(" + (2 * margin.left + 25) + ",0)")
        .attr("id", "happiness_y")
        .attr("color", "white")
        .call(d3.axisLeft(y))

    // adds initial line for the animation
    d3.select("#country-line-chart-svg")
        .selectChildren("path")
        .attr("stroke", "transparent");

    updateHappinessChart();
}

// updates happiness and NT performance lines when needed
function updateHappinessChart() {
    var margin = {top: 14, right: 14, bottom: 14, left: 14},
    width = 413 - margin.left - margin.right,
    height = 215 - margin.top - margin.bottom;

    var svg = d3.select("#country-line-chart-svg");

    if (active_countries[0] === "") this_country = "Overall";
    else this_country = active_countries[no_countries_mode];

    var x = d3.scaleLinear()
        .domain([2007, 2019])
        .range([ 2 * margin.left + 25, width]);

    var y = d3.scaleLinear()
        .domain([0, 100])
        .range([ height - 50, margin.bottom]);

    // generate lines
    var happiness_line = d3.line()
        .x(function (d) { return x(d[0]) })
        .y(function (d) { return y(d[1]/10) })
        .curve(d3.curveMonotoneX);

    var ranking_line = d3.line()
        .x(function (d) { return x(d[0]) })
        .y(function (d) { return y(d[1] * 100 / 1980) })
        .curve(d3.curveMonotoneX);

    var colorNo = function (country) {
        if (active_countries[0] === "") return 0;
        if (country === "Overall") return 0;
        return active_countries_colors[active_countries.indexOf(country)];
    };
    var color_no = active_countries_colors[no_countries_mode];

    // alter happiness and ranking paths
    svg.select("#path-happiness-" + no_countries_mode)
        .attr("fill", "none")
        .attr("stroke-width", 2.5)
        .transition().duration(500)
        .attr("stroke", country_colors[this_country].active[colorNo(this_country)])
        .attr("d", happiness_line(country_happiness[this_country]));

    svg.select("#path-ranking-" + no_countries_mode)
        .attr("fill", "none")
        .attr("stroke-width", 2.5)
        .transition().duration(500)
        .attr("stroke", country_colors[this_country].hover[colorNo(this_country)])
        .attr("d", ranking_line(country_rank[this_country]));

    if (no_countries_mode === 0) {
        svg.select("#path-ranking-1")
            .transition().duration(500)
            .attr("stroke", "transparent");

        svg.select("#path-happiness-1")
            .transition().duration(500)
            .attr("stroke", "transparent");
    }

    // deal with legends
    d3.select($("#happiness-legend-1 circle")[no_countries_mode])
        .transition().duration(500)
        .attr("fill", country_colors[this_country].active[colorNo(this_country)]);
    d3.select($("#happiness-legend-2 circle")[no_countries_mode])
        .transition().duration(500)
        .attr("fill", country_colors[this_country].hover[colorNo(this_country)]);

    if (no_countries_mode === 0) {
        d3.select($("#happiness-legend-1 circle")[1])
            .transition().duration(500)
            .attr("fill", "transparent");
        d3.select($("#happiness-legend-2 circle")[1])
            .transition().duration(500)
            .attr("fill", "transparent");
    }
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
        // update colors
        d3.selectAll($("g.slice[data-section=" + i + "]").toArray())
            .data(current_attendance[i])
            .join("g")
            .transition().duration(500)
            .attr("fill", function (d) {
                if (active_countries[parseInt(i/2)] !== "")
                    return country_colors[active_countries[parseInt(i/2)]].scale[active_countries_colors[parseInt(i/2)]](d);
                return "#666";
            });

        // update tooltip with the percentages
        d3.selectAll($("g.slice[data-section=" + i + "] title").toArray())
            .data(current_attendance[i])
            .join("g")
            .text(d => d >= 0 ? Math.round(d * 100) + "%" : "");
    }
}

// change stadium and scatterplot legend
function changeLegend(mode, country = "") {
    // if a delete was requested, removes the line
    if (mode === "delete") {
        // stadium legends
        $("#stadium #legend-line-" + (no_countries_mode + 1)).fadeOut(500)
            .children("circle").each(function (index) {
            d3.select(this)
                .transition().duration(500)
                .attr("fill", "transparent");
            });
        
        // scatterplot legends
        $("#scatterplot-legend-" + (no_countries_mode + 1)).fadeOut(500)
            .children("circle").each(function (index) {
            d3.select(this)
                .transition().duration(500)
                .attr("fill", "transparent");
            });
        $("#scatterplot-legend-" + (no_countries_mode + 1)).fadeOut(500)
            .children("circle").each(function (index) {
            d3.select(this)
                .transition().duration(500)
                .attr("fill", "transparent");
            });

        // players' bar chart legends
        d3.select($("#bar-chart-legend-nt rect")[no_countries_mode])
            .transition().duration(500)
            .attr("fill", "transparent");
        d3.select($("#bar-chart-legend-club rect")[no_countries_mode])
            .transition().duration(500)
            .attr("fill", "transparent");
       
        return;
    }

    // otherwise changes the legend line according to 'no_countries_mode'
    $("#stadium #legend-line-" + (no_countries_mode + 1) + " text").html(country);
    $("#scatterplot-legend-" + (no_countries_mode + 1) + " text").html(country);

    // update needed stadium legend line
    $("#stadium #legend").fadeIn(500)
        .children("#legend-line-" + (no_countries_mode + 1)).fadeIn(500)
        .children("circle").each(function (index) {
            d3.select(this)
                .transition().duration(500)
                .attr("fill",
                    country_colors[active_countries[no_countries_mode]]
                    .scale[active_countries_colors[no_countries_mode]]
                    ([0,0.5,1][index])
                );
        });

    // update needed scatterplot legend line
    d3.select(
        $("#scatterplot-legend").fadeIn(500)
            .children("#scatterplot-legend-" + (no_countries_mode + 1)).fadeIn(500)
            .children("circle")[0]
        )
        .transition().duration(500)
        .attr("fill",
            country_colors[active_countries[no_countries_mode]]
            .active[active_countries_colors[no_countries_mode]]
        );

    // update barchart legend
    d3.select($("#bar-chart-legend-nt rect")[no_countries_mode])
        .transition().duration(500)
        .attr("fill",
            country_colors[active_countries[no_countries_mode]]
            .active[active_countries_colors[no_countries_mode]]
        );
    d3.select($("#bar-chart-legend-club rect")[no_countries_mode])
        .transition().duration(500)
        .attr("fill",
            country_colors[active_countries[no_countries_mode]]
            .hover[active_countries_colors[no_countries_mode]]
        );
}

/* ================================================================ */
/*                           (5) PLAYER ID                          */
/* ================================================================ */
// create basis for the player ID idiom
function createPlayerStats() {
    // adding gpm line chart
    var margin = {top: 14, right: 14, bottom: 14, left: 14},
    width = 525 - margin.left - margin.right,
    height = 300 - margin.top - margin.bottom;

    var svg = d3.select("#player-line-gpm")
        .attr("viewBox", `0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`)
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom);

    // add "Club GPM" label
    svg.append("text")
        .attr("id", "player_years_label")
        .attr("x", 273 )
        .attr("y", height - 10 )
        .attr("fill", "white")
        .style("text-anchor", "middle")
        .text("Years");

    // add "NT GPM" label
    svg.append("text")
        .attr("id", "player_nt_label")
        .attr("transform", "rotate(-90)")
        .attr("y", - margin.left + 20)
        .attr("x", - (height / 2) + 5)
        .attr("dy", "1em")
        .attr("fill", "white")
        .style("text-anchor", "middle")
        .style("alignment-baseline", "baseline")
        .text("GPM");

    // add x axis
    svg.insert("g", ":first-child")
        .attr("transform", "translate(0," + (height - 50)  + ")")
        .attr("id", "players_x")
        .attr("color", "white");
    
    // add y axis
    svg.insert("g", ":first-child")
       .attr("transform", "translate(" + (2 * margin.left + 25) + ",0)")
       .attr("id", "players_y")
       .attr("color", "white");
}

// update player ID when needed
function updatePlayerStats(playerID) {
    bar_height = 131;
    corner_round = 0;

    var margin = {top: 14, right: 14, bottom: 14, left: 14},
    width = 560 - margin.left - margin.right,
    height = 300 - margin.top - margin.bottom;

    var player_club = players_data.filter(
        x => (x.id === playerID && x.type === "club")
    );

    var player_nt = players_data.filter(
        x => (x.id === playerID && x.type === "nt")
    );

    // set player image
    $("#player-id").show();
    $("#player-id .image").attr("src", "images/players/" + playerID + ".png")

    // add textual info
    var age = new Date(Date.now() - Date.parse(player_club[0].dob)).getFullYear() - 1970;
    $("#nat").html(player_club[0].country.replaceAll("-", " "));
    $("#player-flag").attr("src", "images/flags/flag-" + player_club[0].country + ".png");
    $("#player-underscore").html("<b>NT Proficiency: </b>" + player_club[0].category);
    $("#player-name").html("<b>Name: </b>"+ player_club[0].full_name);
    $("#player-birth").html("<b>Date of Birth: </b>"+ player_club[0].dob + " (" + age + " y.o.)");
    $("#player-years-active").html("<b>Years Active: </b>"+ player_club[0].years_active);

    var colorNo = function (country) {
        if (active_countries[0] === "") return 0;
        return active_countries_colors[active_countries.indexOf(country)];
    };

    var color_no = active_countries_colors[active_countries.indexOf(player_club[0].country)];

    // update legend colors
    d3.select($("#player-line-legend circle")[0])
        .transition().duration(500)
        .attr("fill", country_colors[player_club[0].country].active[colorNo(player_club[0].country)]);
    d3.select($("#player-line-legend circle")[1])
        .transition().duration(500)
        .attr("fill", country_colors[player_club[0].country].hover[colorNo(player_club[0].country)]);

    // NT GPM bar
    var gpm_scale = d3.scaleLinear()
        .domain([0, 1])
        .range([0, bar_height]);

    var gpm_club = gpm_scale(player_club[0].type_avg);
    var gpm_nat = gpm_scale(player_nt[0].type_avg);

    d3.select("#player-value-nt-gpm")
        .attr("x", 1)
        .attr("rx", corner_round)
        .transition().duration(500)
        .attr("fill", country_colors[player_club[0].country].active[colorNo(player_club[0].country)])
        .attr("height", gpm_nat)
        .attr("y", bar_height + 1 - gpm_nat)
        .attr("width", 28);
    d3.select("#player-bar-number-nt").text(player_nt[0].type_avg);

    // club GPM bar
    var gpm_club = gpm_scale(player_club[0].type_avg);

    d3.select("#player-value-club-gpm")
        .attr("x", 1)
        .attr("rx", corner_round)
        .transition().duration(500)
        .attr("fill", country_colors[player_club[0].country].hover[colorNo(player_club[0].country)])
        .attr("height", gpm_club)
        .attr("y", bar_height + 1 - gpm_club)
        .attr("width", 28);
    d3.select("#player-bar-number-club").text(player_club[0].type_avg);

    // axis
    var svg = d3.select("#player-line-gpm");
    
    // x (years) axis
    var nt_years = Array.from(player_nt[0].years);
    var nt_min_x = 1991 + nt_years.findIndex(x => x >= 0) - 1;
    var nt_max_x = 2020 - nt_years.reverse().findIndex(x => x >= 0) + 1;
    nt_years.slice(nt_min_x - 1991, 2020 - nt_max_x);

    var club_years = Array.from(player_club[0].years);
    var club_min_x = 1991 + club_years.findIndex(x => x >= 0) - 1;
    var club_max_x = 2020 - club_years.reverse().findIndex(x => x >= 0) + 1;
    club_years.slice(club_min_x - 1991, club_max_x + 2020);

    var min_x = Math.min(nt_min_x, club_min_x);
    var max_x = Math.max(nt_max_x, club_max_x);

    var x = d3.scaleLinear()
        .domain([min_x, max_x])
        .range([ 2 * margin.left + 25, width - 40 ]);

    svg.select("#players_x")
        .transition().duration(500)
        .call(d3.axisBottom(x)
            .tickFormat(d3.format("d"))
            .tickSizeOuter(0)
            .ticks(max_x - min_x > 16 ? Math.ceil((max_x - min_x) / 2) : max_x - min_x));

    // y (gpm) axis    
    var nt_max_y = Math.max.apply(Math, nt_years);
    var club_max_y = Math.max.apply(Math, club_years);
    var max_y = Math.ceil(Math.max(1, Math.max(nt_max_y, club_max_y)) * 10) / 10;
     
    var y = d3.scaleLinear()
        .domain([0, max_y])
        .range([height - 50, margin.bottom + 20]);

    svg.select("#players_y")
        .transition().duration(500)
        .call(d3.axisLeft(y));

    var nt_line = d3.line()
        .defined(function (d) { return d[1] !== -1; })
        .x(function (d) { return x(d[0] + nt_min_x) })
        .y(function (d) { return y(d[1]) });

    var club_line = d3.line()
        .defined(function (d) { return d[1] !== -1; })
        .x(function (d) { return x(d[0] + club_min_x) })
        .y(function (d) { return y(d[1]) });

    // filtering data for dashed lines
    var nt_data = player_nt[0].years.slice(nt_min_x - 1991, 30 - (2020 - nt_max_x));
    nt_data.forEach(function (data, index) {
        nt_data[index] = [index, parseFloat(data)];
    });
    var filtered_nt_data = nt_data.filter(nt_line.defined());

    var club_data = player_club[0].years.slice(club_min_x - 1991, 30 - (2020 - club_max_x));
    club_data.forEach(function (data, index) {
        club_data[index] = [index, parseFloat(data)];
    });
    var filtered_club_data = club_data.filter(club_line.defined());

    // markers
    svg.selectAll(".player-nt-line-marker")
        .data(filtered_nt_data)
        .join(
            enter => enter.append("circle")
                .attr("class", "player-nt-line-marker")
                .attr("cx", d => x(d[0] + nt_min_x))
                .attr("cy", d => y(d[1]))
                .attr("fill", country_colors[player_club[0].country].active[colorNo(player_club[0].country)])
                .attr("stroke", "white")
                .attr("stroke-width", "0")
                .call(enter => enter
                    .transition().duration(500)
                    .attr("r", 4)
                )                
                .append("title")
                .text(d => d[1]),
            
            update => update
                .attr("class", "player-nt-line-marker")
                .call(update => update
                    .transition().duration(500)
                    .attr("fill", country_colors[player_club[0].country].active[colorNo(player_club[0].country)])
                    .attr("stroke", "white")
                    .attr("stroke-width", "0")
                    .attr("cx", d => x(d[0] + nt_min_x))
                    .attr("cy", d => y(d[1]))
                )                
                .select("title")
                .text(d => d[1]),
            
            exit => exit
                .transition().duration(500)
                .attr("r", 0)
                .remove()
        );

        svg.selectAll(".player-club-line-marker")
        .data(filtered_club_data)
        .join(
            enter => enter.append("circle")
                .attr("class", "player-club-line-marker")
                .attr("cx", d => x(d[0] + club_min_x))
                .attr("cy", d => y(d[1]))
                .attr("fill", country_colors[player_club[0].country].hover[colorNo(player_club[0].country)])
                .attr("stroke", "white")
                .attr("stroke-width", "0")
                .call(enter => enter
                    .transition().duration(500)
                    .attr("r", 4)
                )                
                .append("title")
                .text(d => d[1]),
            
            update => update
                .attr("class", "player-club-line-marker")
                .call(update => update
                    .transition().duration(500)
                    .attr("fill", country_colors[player_club[0].country].hover[colorNo(player_club[0].country)])                    
                    .attr("stroke", "white")
                    .attr("stroke-width", "0")
                    .attr("cx", d => x(d[0] + club_min_x))
                    .attr("cy", d => y(d[1]))
                )                
                .select("title")
                .text(d => d[1]),
            
            exit => exit
                .transition().duration(500)
                .attr("r", 0)
                .remove()
        );

    // line chart, NT GPM
    svg.select("#player-nt-gpm-path")
        .data(nt_data)
        .attr("fill", "none")
        .attr("stroke-width", 2.5)
        .transition().duration(500)
        .attr("stroke", country_colors[player_club[0].country].active[colorNo(player_club[0].country)])
        .attr("d", nt_line(nt_data));

    svg.select("#player-nt-gpm-path-dashed")
        .data(filtered_nt_data)
        .attr("fill", "none")
        .attr("stroke-width", 2.5)
        .attr("stroke-dasharray", "4")
        .transition().duration(500)
        .attr("stroke", country_colors[player_club[0].country].active[colorNo(player_club[0].country)])
        .attr("d", nt_line(filtered_nt_data));
    
    // line chart, club GPM
    svg.select("#player-club-gpm-path")
        .data(club_data)
        .attr("fill", "none")
        .attr("stroke-width", 2.5)
        .transition().duration(500)
        .attr("stroke", country_colors[player_club[0].country].hover[colorNo(player_club[0].country)])
        .attr("d", club_line(club_data));

    svg.select("#player-club-gpm-path-dashed")
        .data(filtered_club_data)
        .attr("fill", "none")
        .attr("stroke-width", 2.5)
        .attr("stroke-dasharray", "4")
        .transition().duration(500)
        .attr("stroke", country_colors[player_club[0].country].hover[colorNo(player_club[0].country)])
        .attr("d", club_line(filtered_club_data));
    
    // guide lines for hover / click
    d3.selectAll(".phl").remove();
    d3.select("#player-line-gpm").insert("line",":first-child").attr("id","player-help-line-hover-x").attr("class","phl").attr("stroke","grey");
    d3.select("#player-line-gpm").insert("line",":first-child").attr("id","player-help-line-hover-y").attr("class","phl").attr("stroke","grey");
    d3.select("#player-line-gpm").insert("line",":first-child").attr("id","player-help-line-active-x").attr("class","phl").attr("stroke","grey");
    d3.select("#player-line-gpm").insert("line",":first-child").attr("id","player-help-line-active-y").attr("class","phl").attr("stroke","grey");

    // hover on circles
    $(".player-club-line-marker, .player-nt-line-marker").on("mouseover", function () {
        // if the hovered item is active, ignore all this
        if (this.dataset.yearActive === "true") return;
        d3.select(this)
            .attr("r", "6")
            .attr("stroke-width", "2");

        // set up the hover guide lines
        d3.select("#player-help-line-hover-y")
            .attr("x1", 53)
            .attr("x2", d3.select(this).attr("cx"))
            .attr("y1", d3.select(this).attr("cy"))
            .attr("y2", d3.select(this).attr("cy"));
        $("#player-help-line-hover-y").show();

        d3.select("#player-help-line-hover-x")
            .attr("y1", d3.select(this).attr("cy"))
            .attr("y2", 222)
            .attr("x1", d3.select(this).attr("cx"))
            .attr("x2", d3.select(this).attr("cx"));
        $("#player-help-line-hover-x").show();
    });

    // hnhover on circles
    $(".player-club-line-marker, .player-nt-line-marker").on("mouseout", function () {
        // if the hovered item is active, ignore all this
        if (this.dataset.yearActive === "true") return;
        d3.select(this)
            .attr("r", "4")
            .attr("stroke-width", "0");
        
        $("#player-help-line-hover-x").hide();
        $("#player-help-line-hover-y").hide();
    });

    // click on circles
    $(".player-club-line-marker, .player-nt-line-marker").on("click", function () {
        // if the hovered item is active, ignore all this
        if (this.dataset.yearActive === "true") return;
        $(".player-club-line-marker, .player-nt-line-marker")
            .attr("data-year-active", "false")
            .attr("r", "4")
            .attr("stroke-width", "0");
        d3.select(this)
            .attr("r", "6")
            .attr("data-year-active", "true")
            .attr("stroke-width", "2");

        // set up the active guide lines
        d3.select("#player-help-line-active-y")
            .attr("x1", 53)
            .attr("x2", d3.select(this).attr("cx"))
            .attr("y1", d3.select(this).attr("cy"))
            .attr("y2", d3.select(this).attr("cy"));
        $("#player-help-line-active-y").show();

        d3.select("#player-help-line-active-x")
            .attr("y1", d3.select(this).attr("cy"))
            .attr("y2", 202)
            .attr("x1", d3.select(this).attr("cx"))
            .attr("x2", d3.select(this).attr("cx"));
        $("#player-help-line-active-y").show();
    });
}

/* ================================================================ */
/*                      (6) PLAYER SCATTERPLOT                      */
/* ================================================================ */
// create scatterplot SVG
function createScatterPlot() {
    var margin = {top: 14, right: 14, bottom: 14, left: 14},
    width = 531 - margin.left - margin.right,
    height = 531 - margin.top - margin.bottom;

    var svg = d3.select("#gpm_scatterplot")
        .attr("width", width)
        .attr("height", height)
        .attr("viewBox", `0 0 ${width} ${height}`);

    // add Club GPM label
    svg.append("text")
        .attr("id", "club_label")
        .attr("x", 254)
        .attr("y", height - 36 )
        .attr("fill", "white")
        .style("text-anchor", "middle")
        .text("Club GPM");

    // add NT GPM label
    svg.append("text")
        .attr("id", "nt_label")
        .attr("transform", "rotate(-90)")
        .attr("y", - margin.left + 20)
        .attr("x", 0 - (height / 2))
        .attr("dy", "1em")
        .attr("fill", "white")
        .style("text-anchor", "middle")
        .style("alignment-baseline", "baseline")
        .text("NT GPM");

    // add x axis
    svg.insert("g", ":first-child")
        .attr("transform", "translate(0," + (height - 76)  + ")")
        .attr("id", "x_scale")
        .attr("color", "white");
    
    // add y axis
    svg.insert("g", ":first-child")
       .attr("transform", "translate(" + (2 * margin.left + 25) + ",0)")
       .attr("id", "y_scale")
       .attr("color", "white");

    updateScatterplot();
}

// update players' scatterplot when needed
function updateScatterplot() {
    var margin = {top: 14, right: 14, bottom: 14, left: 14},
    width = 495,
    height = 495 - margin.top - margin.bottom;

    // if there are no countries selected, select the best 25 of all countries
    if (active_countries[0] === "")
        var players = players_compact_data.sort(function (a, b) {
            var keyA = parseFloat(a.player_avg);
            var keyB = parseFloat(b.player_avg);

            if (keyA < keyB) return 1;
            if (keyA > keyB) return -1;
            return 0;
        }).slice(0, 25);

    // otherwise, business as usual
    else
        var players = players_compact_data.filter(
            x => (active_countries.includes(x.country))
        ).sort(function (a, b) {
            // order by id if same country
            if (a.country === b.country) {
                if (parseInt(a.id) < parseInt(b.id)) return -1;
                if (parseInt(a.id) > parseInt(b.id)) return 1;
                return 0;
            }
            // otherwise, order by the position of the country in the active_countries
            else {
                var a_i = active_countries.indexOf(a.country);
                var b_i = active_countries.indexOf(b.country);
                if (a_i < b_i) return -1;
                if (a_i > b_i) return 1;
                return 0;
            }
        });

    var svg = d3.select("#gpm_scatterplot");

    var max_club = Math.max.apply(Math, players.map(function (o) { return o.club_avg; }));
    var max_nt = Math.max.apply(Math, players.map(function (o) { return o.nt_avg; }));
    var max = Math.max(max_nt, max_club);
    var max_x_scale = Math.ceil(max * 10) / 10;

    var x = d3.scaleLinear()
        .domain([0, max_x_scale])
        .range([ 2 * margin.left + 25, width - 40 ]);
    var y = d3.scaleLinear()
        .domain([0, max_x_scale])
        .range([ height - 40, margin.bottom + 25]);

    svg.select("#x_scale")
        .transition().duration(500)
        .call(d3.axisBottom(x).tickSizeOuter(0).ticks(max_x_scale > 1 ? max_x_scale / 2 : max_x_scale * 10));

    svg.select("#y_scale")
        .transition().duration(500)
        .call(d3.axisLeft(y).tickSizeOuter(0).ticks(max_x_scale > 1 ? max_x_scale / 2 : max_x_scale * 10));

    var colorNo = function (country) {
        if (active_countries[0] === "") return 0;
        return active_countries_colors[active_countries.indexOf(country)];
    };

    // circle creation
    // needs to be a separate join to define different animations for each event
    svg.selectAll(".player-circle")
        .data(players)
        .join(
            enter => enter.append("circle")
                .attr("class", "player-circle")
                .attr("data-playerid", d => d.id)
                .attr("data-playeractive", "false")
                .attr("cx", d => x(d.club_avg))
                .attr("cy", d => y(d.nt_avg))
                .attr("fill", d => country_colors[d.country].active[colorNo(d.country)])
                .attr("style", "opacity: 0.85")
                .call(enter => enter
                    .transition().duration(500)
                    .attr("r", 8)
                )
                .append("title")
                .attr("class", "title-player-circle")
                .text(d => (d.first_name !== "" ? `${d.first_name[0]}. ` : "") + `${d.last_name}`),
            
            update => update
                .attr("class", "player-circle")
                .attr("data-playerid", d => d.id)
                .attr("data-playeractive", "false")
                .call(update => update
                    .transition().duration(500)
                    .attr("fill", d => country_colors[d.country].active[colorNo(d.country)])
                    .attr("stroke-width", 0)
                    .attr("cx", d => x(d.club_avg))
                    .attr("cy", d => y(d.nt_avg))
                )
                .select("title")
                .text(d => (d.first_name !== "" ? `${d.first_name[0]}. ` : "") + `${d.last_name}`),
            
            exit => exit
                .transition().duration(500)
                .attr("r", 0)
                .remove()
        );

    // creating and inserting before anything else makes it stay below all items
    var totLen = Math.sqrt(
        Math.pow((isNaN(x(max_x_scale)) ? 0 : x(max_x_scale)) - (isNaN(x(0)) ? 0 : x(0)), 2) +
        Math.pow((isNaN(y(max_x_scale)) ? 0 : y(max_x_scale)) - (isNaN(y(0)) ? 0 : y(0)), 2)
    );

    svg.selectAll("#scatterline")
        .data(totLen > 0 ? [totLen] : [])
        .join(
            enter => enter.insert("line", ":first-child")
                .attr("id", "scatterline")
                .attr("stroke", "red")
                .attr("x1", isNaN(x(0)) ? 0 : x(0))
                .attr("x2", isNaN(x(max_x_scale)) ? 0 : x(max_x_scale))
                .attr("y1", isNaN(y(0)) ? 0 : y(0))
                .attr("y2", isNaN(y(max_x_scale)) ? 0 : y(max_x_scale))
                .attr("stroke-dasharray", totLen + " " + totLen)
                .attr("stroke-dashoffset", totLen)
                .call(enter => enter
                    .transition().duration(500)
                    .attr("stroke-dashoffset", 0)
                ),
            
            update => update,
            
            exit => exit
                .transition().duration(500)
                .attr("stroke-dashoffset", function () {
                    if (exit !== undefined) return exit.attr("stroke-dasharray").split(" ")[0];
                })
                .remove()
        );

    // guide lines for hover / click
    d3.selectAll(".shl").remove();
    d3.select("#gpm_scatterplot").insert("line",":first-child").attr("id","scatter-help-line-hover-x").attr("class","shl").attr("stroke","grey");
    d3.select("#gpm_scatterplot").insert("line",":first-child").attr("id","scatter-help-line-hover-y").attr("class","shl").attr("stroke","grey");
    d3.select("#gpm_scatterplot").insert("line",":first-child").attr("id","scatter-help-line-active-x").attr("class","shl").attr("stroke","grey");
    d3.select("#gpm_scatterplot").insert("line",":first-child").attr("id","scatter-help-line-active-y").attr("class","shl").attr("stroke","grey");

    bindPlayerHover();
    bindPlayerUnhover();
    bindPlayerClick();
}

/* ================================================================ */
/*                      (7) PLAYERS' BAR CHART                      */
/* ================================================================ */
// players' bar chart
function createPlayersBarChart() {
    $("#bar-chart-div")[0].appendChild(d3.create("svg")
        .attr("id", "players-bar-chart")
        .attr("width", 368)
        .attr("height", 266)
        .node()
    );

    // create width axis
    d3.select("#players-bar-chart-axis")
        .append("g")
        .attr("transform", "translate(0,39)")
        .attr("id", "w_axis")
        .attr("color", "white");

    // create vertical axis
    d3.select("#players-bar-chart")
        .append("g")
        .attr("transform", "translate(14,-1)")
        .attr("id", "y_axis")
        .attr("color", "white");

    updatePlayersBarChart("total-gpm", "");
}

// with the SVG created, we now need to call this function to do the
// actual work when we click a country
// if ascdesc == undefined, ascending; if ascdesc != undefined, descending
function updatePlayersBarChart(mode, ascdesc) {
    var selected_id = $(".player-bar-text[data-playeractive=true]").attr("data-playerid");

    var decode = {
        "total-gpm": "player_avg",
        "nt-gpm": "nt_avg",
        "club-gpm": "club_avg",
    };

    // if there are no countries selected, select the best 25 of all countries
    if (active_countries[0] === "")
        players = players_compact_data
            .sort(function (a, b) {
                var keyA = parseFloat(a.player_avg);
                var keyB = parseFloat(b.player_avg);

                if (keyA < keyB) return 1;
                if (keyA > keyB) return -1;
                return 0;
            })
            .slice(0, 25)
            .sort(function (a, b) {
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

    // otherwise, business as usual
    else
        var players = players_compact_data.filter(
            x => (active_countries.includes(x.country))
        ).sort(function (a, b) {
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
        Math.max.apply(Math, players.map(function (o) { return o.nt_avg; })),
        Math.max.apply(Math, players.map(function (o) { return o.club_avg; }))
    );

    // maximum width tick value
    var max_w_scale = Math.ceil(max_w * 10) / 10;
    var y_scale_data = players.map((p) => p.full_name);

    var svg = d3.select("#players-bar-chart");
    if (players.length > 0) 
        svg
            .attr("height", players.length * 40 + 10)
            .attr("width", 368)
            .attr("viewBox", "0 0 368 " + (players.length * 40 + 10));
    var axis = d3.select("#players-bar-chart-axis");

    // discrete scale for the players axis
    var y_scale = d3.scaleBand()
        .domain(Array.from({length: players.length}, (v,k) => k))
        .range([15, players.length * 40]);

    // continuous linear scale for the values
    var w_scale = d3.scaleLinear()
        .domain([0, max_w_scale])
        .range([padding, 215]);

    var colorNo = function (country) {
        if (active_countries[0] === "") return 0;
        return active_countries_colors[active_countries.indexOf(country)];
    };

    // adding the nt gpm
    svg.selectAll(".player-bar-rect-nt")
        .data(players, (d,i) => i)
        .join(
            enter => enter.append("rect")
                .attr("class", "player-bar-rect-nt")
                .attr("data-playerid", d => d.id)
                .attr("data-playeractive", "false")
                .attr("fill", d => country_colors[d.country].active[colorNo(d.country)])
                .attr("x", padding)
                .attr("y", (d,i) => Math.floor(y_scale(i)))
                .attr("height", Math.floor((y_scale.bandwidth() - 14) / 2))
                .call(enter => enter
                    .transition().duration(500)
                    .attr("width", d => w_scale(d.nt_avg) - padding)
                )
                .append("title")
                .text(d => "NT GPM: " + d.nt_avg),
            
            update => update
                .attr("class", "player-bar-rect-nt")
                .attr("data-playerid", d => d.id)
                .attr("data-playeractive", "false")
                .call(update => update
                    .transition().duration(500)
                    .attr("fill", d => country_colors[d.country].active[colorNo(d.country)])
                    .attr("y", (d,i) => Math.floor(y_scale(i)))
                    .attr("width", d => w_scale(d.nt_avg) - padding)
                )
                .select("title")
                .text(d => "NT GPM: " + d.nt_avg),
            
            exit => exit
                .transition().duration(500)
                .attr("width", 0)
                .remove()
        );

    // adding the club gpm
    svg.selectAll(".player-bar-rect-club")
        .data(players, (d,i) => i)
        .join(
            enter => enter.append("rect")
                .attr("class", "player-bar-rect-club")
                .attr("data-playerid", d => d.id)
                .attr("data-playeractive", "false")
                .attr("fill", d => country_colors[d.country].hover[colorNo(d.country)])
                .attr("x", padding)
                .attr("y", (d,i) => Math.floor(y_scale(i) + (y_scale.bandwidth() - 14) / 2))
                .attr("height", Math.floor((y_scale.bandwidth() - 14) / 2))
                .call(enter => enter
                    .transition().duration(500)
                    .attr("width", d => w_scale(d.club_avg) - padding)
                )
                .append("title")
                .text(d => "Club GPM: " + d.club_avg),
            
            update => update
                .attr("class", "player-bar-rect-club")
                .attr("data-playerid", d => d.id)
                .attr("data-playeractive", "false")
                .call(update => update
                    .transition().duration(500)
                    .attr("y", (d,i) => Math.floor(y_scale(i)) + Math.floor((y_scale.bandwidth() - 14) / 2))
                    .attr("fill", d => country_colors[d.country].hover[colorNo(d.country)])
                    .attr("width", d => w_scale(d.club_avg) - padding)
                )
                .select("title")
                .text(d => "Club GPM: " + d.club_avg),
            
            exit => exit
                .transition().duration(500)
                .attr("width", 0)
                .remove()
        );

    // adding the red marker for total gpm
    svg.selectAll(".player-bar-rect-avg")
        .data(players, (d,i) => i)
        .join(
            enter => enter.append("path")
                .attr("class", "player-bar-rect-avg")
                .attr("data-playerid", d => d.id)
                .attr("data-playeractive", "false")
                .attr("d", ["M", 5, 5, "L", 0, 0, "L", 10, 0].join(" "))
                .attr("fill", "transparent")
                .attr("transform", (d,i) => `translate(${padding - 5},${Math.floor(y_scale(i)) - 5})`)
                .call(enter => enter
                    .transition().duration(500)
                    .attr("fill", "red")
                    .attr("transform", (d,i) => `translate(${w_scale(d.player_avg) - 5},${Math.floor(y_scale(i)) - 5})`)
                )
                .append("title")
                .text(d => "Average GPM: " + d.player_avg),
            
            update => update
                .attr("class", "player-bar-rect-avg")
                .attr("data-playerid", d => d.id)
                .attr("data-playeractive", "false")
                .call(update => update
                    .transition().duration(500)
                    .attr("transform", (d,i) => `translate(${w_scale(d.player_avg) - 5},${Math.floor(y_scale(i)) - 5})`)
                )
                .select("title")
                .text(d => "Average GPM: " + d.player_avg),
            
            exit => exit
                .transition().duration(500)
                .attr("fill", "transparent")
                .attr("transform", (d,i) => `translate(${padding - 5},${$(exit._groups[0][i]).attr("transform").split(", ")[1].split(")")[0]})`)
                .remove()
        );

    // putting the players' name on the right
    svg.selectAll(".player-bar-text")
        .data(players, (d,i) => i)
        .join(
            enter => enter.append("text")
                .attr("class", "player-bar-text")
                .attr("data-playerid", d => d.id)
                .attr("data-playeractive", "false")
                .attr("style", "text-anchor: start; alignment-baseline: middle")
                .attr("fill", "transparent")
                .attr("y", (d,i) => Math.floor(y_scale(i)) + (Math.floor(y_scale.bandwidth()) - 12) / 2)
                .text(function (d) {
                    return (d.first_name !== "" ? `${d.first_name[0]}. ` : "") +
                        `${d.last_name} - ${d[decode[mode]]}`;
                })
                .attr("textLength", function (d) {
                    // checks if compressing the player label is needed
                    if (this.getBoundingClientRect().width * 1.15 > 354 - w_scale(Math.max(d.club_avg, d.nt_avg)))
                        return 354 - 10 - w_scale(Math.max(d.club_avg, d.nt_avg));
                    return 0;
                })
                .call(enter => enter
                    .transition().duration(500)
                    .attr("fill", "white")
                    .attr("x", d => w_scale(Math.max(d.club_avg, d.nt_avg)) + 10)
                ),
            
            update => update
                .attr("data-playerid", d => d.id)
                .attr("data-playeractive", "false")
                .text(function (d) {
                    return (d.first_name !== "" ? `${d.first_name[0]}. ` : "") +
                        `${d.last_name} - ${d[decode[mode]]}`;
                })
                .attr("textLength", function (d) {
                    // checks if compressing the player label is needed
                    if (this.getBoundingClientRect().width * 1.15 > 354 - w_scale(Math.max(d.club_avg, d.nt_avg)))
                        return 354 - 10 - w_scale(Math.max(d.club_avg, d.nt_avg));
                    return 0;
                })
                .call(update => update
                    .transition().duration(500)
                    .attr("x", d => w_scale(Math.max(d.club_avg, d.nt_avg)) + 10)
                ),
            
            exit => exit
                .transition().duration(500)
                .attr("fill", "transparent")
                .attr("x", padding)
                .remove()
        );

    // transition into new width axis
    axis.select("#w_axis")
        .transition().duration(500)
        .call(d3.axisTop()
            .scale(d3.scaleLinear()
                .domain([0, max_w_scale])
                .range([3.5, 215]))
            .tickSizeOuter(0)
            .ticks(max_w_scale > 1 ? max_w_scale / 2 : max_w_scale * 10)
        );

    // remove previous width axis label and add new one
    axis.select("#axis-label").remove();
    axis.append("text")
        .attr("id", "axis-label")
        .attr("style", "text-anchor: middle; alignment-baseline: baseline; transform: translate(114px, 12px)")
        .attr("fill", "white")
        .attr("class", "label")
        .text($(`label[for=${mode}]`).text().slice(0,-2));

    // transition into new vertical axis
    svg.select("#y_axis")
        .transition().duration(500)
        .call(d3.axisLeft()
            .scale(d3.scaleBand()
            .range([0, players.length * 40]))
            .tickSizeOuter(0)
            .tickSize(0)
            .tickValues([])
        );

    bindPlayerHover();
    bindPlayerUnhover();
    bindPlayerClick();
    resizePlayersBarChart();

    // always have best player active
    setTimeout(function () {
        if ($(`text[data-playerid=${selected_id}]`).length === 0) {
            $(".player-bar-rect-nt:nth-of-type(1)").trigger("mouseover");
            $(".player-bar-rect-nt:nth-of-type(1)").trigger("click");
        }
        else {
            $(`text[data-playerid=${selected_id}]`).trigger("mouseover");
            $(`text[data-playerid=${selected_id}]`).trigger("click");
        }
    }, 600);
}

// binds hovering to a player's bars and dot
function bindPlayerHover() {
    $(".player-bar-rect-nt, .player-bar-rect-club, .player-bar-rect-avg, .player-bar-text, .player-circle, .gauge-circle").on("mouseover", function () {
        // if the hovered item is active, ignore all this
        if (this.dataset.playeractive === "true") return;

        var sc_circle = $(`.player-circle[data-playerid=${this.dataset.playerid}]`);
        var ga_circle = $(`.gauge-circle[data-playerid=${this.dataset.playerid}]`);
        var text = $(`.player-bar-text[data-playerid=${this.dataset.playerid}]`);

        // style the hovered player
        text.css("font-weight", 900);
        d3.select(sc_circle[0])
            .attr("stroke-width", 3)
            .attr("stroke", "white");
        d3.select(ga_circle[0])
            .attr("stroke-width", 3)
            .attr("stroke", "white");

        // scroll bar chart if player not in sight
        /*var top_el = $(`.player-bar-rect-avg[data-playerid=${this.dataset.playerid}]`).position().top;
        var top_dad = $("#bar-chart-div").position().top;
        var height_dad = $("#bar-chart-div").height();

        if (this.localName === "sc_circle")
            if (top_el < top_dad || top_el + 29 > top_dad + height_dad)
                $("#bar-chart-div").animate({ scrollTop: top_el - top_dad }, 0);*/

        // set up the hover guide lines
        d3.select("#scatter-help-line-hover-y")
            .attr("x1", sc_circle.attr("cx"))
            .attr("x2", sc_circle.attr("cx"))
            .attr("y1", parseInt(sc_circle.attr("cy")) + parseInt(sc_circle.attr("r")))
            .attr("y2", 427);
        $("#scatter-help-line-hover-y").show();

        d3.select("#scatter-help-line-hover-x")
            .attr("x1", parseInt(sc_circle.attr("cx")) - parseInt(sc_circle.attr("r")))
            .attr("x2", 53)
            .attr("y1", sc_circle.attr("cy"))
            .attr("y2", sc_circle.attr("cy"));
        $("#scatter-help-line-hover-x").show();
    });
}

// binds unhovering to a player's bars and dot
function bindPlayerUnhover() {
    $(".player-bar-rect-nt, .player-bar-rect-club, .player-bar-rect-avg, .player-bar-text, .player-circle, .gauge-circle").on("mouseout", function () {
        // if the unhovered item is active, ignore all this
        if (this.dataset.playeractive === "true") return;

        // remove the styling from the unhovered player
        $(`.player-bar-text[data-playerid=${this.dataset.playerid}]`).css("font-weight", "normal");
        d3.select($(`.player-circle[data-playerid=${this.dataset.playerid}]`)[0]).attr("stroke", "none");
        d3.select($(`.gauge-circle[data-playerid=${this.dataset.playerid}]`)[0]).attr("stroke", "black").attr("stroke-width", 2);

        // hide the hover lines
        $("#scatter-help-line-hover-y").hide();
        $("#scatter-help-line-hover-x").hide();
    });
}

// binds the clicking event to a circle or a bar
function bindPlayerClick() {
    $(".player-bar-rect-nt, .player-bar-rect-club, .player-bar-rect-avg, .player-bar-text, .player-circle, .gauge-circle").on("click", function (evt) {
        evt.stopImmediatePropagation();
        var sc_circle = $(`.player-circle[data-playerid=${this.dataset.playerid}]`);
        var ga_circle = $(`.gauge-circle[data-playerid=${this.dataset.playerid}]`);

        // remove the styling from all elements except the one clicked
        $(`.player-bar-text:not([data-playerid=${this.dataset.playerid}])`).css("font-weight", "normal");
        d3.selectAll($(`.player-circle:not([data-playerid=${this.dataset.playerid}])`)).attr("stroke", "none");
        d3.selectAll($(`.gauge-circle:not([data-playerid=${this.dataset.playerid}])`)).attr("stroke", "black").attr("stroke-width", 2);

        // remove the "active" tag from all elements and add it to the one clicked
        $(".player-bar-rect-nt, .player-bar-rect-club, .player-bar-rect-avg, .player-bar-text, .player-circle,.gauge-circle").attr("data-playeractive", "false");
        $(`[data-playerid=${this.dataset.playerid}]`).attr("data-playeractive", "true");

        // set up the active lines and remove the hover one
        d3.select("#scatter-help-line-active-y")
            .attr("x1", sc_circle.attr("cx"))
            .attr("x2", sc_circle.attr("cx"))
            .attr("y1", parseInt(sc_circle.attr("cy")) + parseInt(sc_circle.attr("r")))
            .attr("y2", 427);
        $("#scatter-help-line-active-y").show();
        $("#scatter-help-line-hover-y").hide();

        d3.select("#scatter-help-line-active-x")
            .attr("x1", parseInt(sc_circle.attr("cx")) - parseInt(sc_circle.attr("r")))
            .attr("x2", 53)
            .attr("y1", sc_circle.attr("cy"))
            .attr("y2", sc_circle.attr("cy"));
        $("#scatter-help-line-active-x").show();
        $("#scatter-help-line-hover-x").hide();

        // deal with player ID
        updatePlayerStats(this.dataset.playerid);

        $(".player-club-line-marker, .player-nt-line-marker")
            .attr("data-year-active", "false")
            .attr("r", "4")
            .attr("stroke-width", "0")
    });
}

/* ================================================================ */
/*                        (8) NT PROFICIENCY                        */
/* ================================================================ */
// creates gauge idim basis. way too much code, but ok
function createGauge() {
    var container = "#power-gauge";
    var configuration = {
        clipHeight: 470,
        clipWidth: 380,
        maxValue: 0.2,
        minValue: -0.2,
        ringWidth: 80,
        size: 380,
    };
    var that = {};
    var config = {
        arcColorFn: d3.interpolateHsl(d3.rgb('#bd5151'), d3.rgb('#51bd51')),
        clipHeight: 110,
        clipWidth: 200,
        labelFormat: d3.format(',g'),
        labelInset: 10,
        majorTicks: 5,
        maxAngle: 135,
        maxValue: 0.2,
        minAngle: -135,
        minValue: -0.2,
        pointerHeadLengthPercent: 0.9,
        pointerTailLength: 5,
        pointerWidth: 10,
        ringInset: 20,
        ringWidth: 20,
        size: 200,
    };
    var range = undefined;
    var r = undefined;
    var pointerHeadLength = undefined;
    var value = 0;
    
    var svg = undefined;
    var arc = undefined;
    var scale = undefined;
    var ticks = undefined;
    var tickData = undefined;
    var pointer = undefined;
    
    // convert from degrees to radians
    function deg2rad(deg) {
        return deg * Math.PI / 180;
    }
    
    // increments current angle by 'd'
    function newAngle(d) {
        var ratio = scale(d);
        var newAngle = config.minAngle + (ratio * range);
        return newAngle;
    }
    
    function configure(configuration) {
        var prop = undefined;

        for (prop in configuration)
            config[prop] = configuration[prop];
        
        range = config.maxAngle - config.minAngle;
        r = config.size / 2;
        pointerHeadLength = Math.round(r * config.pointerHeadLengthPercent);

        // a linear scale that maps domain values to a percent from 0..1
        scale = d3.scaleLinear()
            .range([0,1])
            .domain([config.minValue, config.maxValue]);
            
        ticks = [[-0.16,"Extreme Underscorer"], [-0.08,"Underscorer"], [0,"Neutral"], [0.08,"Top Scorer"], [0.16,"National Pride"]]
        tickData = d3.range(config.majorTicks).map(function() {return 1/config.majorTicks;});
        
        arc = d3.arc()
            .innerRadius(r - config.ringWidth - config.ringInset)
            .outerRadius(r - config.ringInset)
            .startAngle(function(d, i) {
                var ratio = d * i;
                return deg2rad(config.minAngle + (ratio * range));
            })
            .endAngle(function(d, i) {
                var ratio = d * (i+1);
                return deg2rad(config.minAngle + (ratio * range));
            });
    }
    that.configure = configure;
    configure(configuration);

    // generate svg and gauge sections
    svg = d3.select(container)
        .append('svg:svg')
        .attr('class', 'gauge')
        .attr('width', config.clipWidth)
        .attr('height', config.clipHeight)
        .attr("viewBox", `0 0 ${config.clipWidth} ${config.clipHeight}`);
    
    var arcs = svg.append('g')
        .attr('class', 'arc')
        .attr('transform', `translate(${r},${r})`);
    
    arcs.selectAll('path')
        .data(tickData)
        .enter().append('path')
        .attr('fill', (d,i) => config.arcColorFn(d * i))
        .attr('d', arc);

    // gauge pointers
    svg.append("g")
        .attr("transform", `translate(${r},${r})`)
        .append("path")
        .attr("class", "gauge-gauge")
        .attr("id", "gauge-gauge-1")
        .attr("fill", "#aaa")
        .attr("stroke", "black")
        .attr("stroke-width", 1)
        .attr("transform","rotate(0)")
        .attr("d", ["M", 0, 10, "L", 10, 0, "L", 0, -100, "L", -10, 0, "Z"].join(" "));

    svg.append("g")
        .attr("transform", `translate(${r},${r})`)
        .append("path")
        .attr("class", "gauge-gauge")
        .attr("id", "gauge-gauge-0")
        .attr("fill", "#aaa")
        .attr("stroke", "black")
        .attr("stroke-width", 1)
        .attr("transform","rotate(0)")
        .attr("d", ["M", 0, 10, "L", 10, 0, "L", 0, -100, "L", -10, 0, "Z"].join(" "));

    // pointer legend
    svg.append("g")
        .attr("id", "avg-underscore")
        .attr("transform", `translate(0,${r + 60})`)
        .call(o => o.append("text")
            .attr("x", r)
            .attr("fill", "white")
            .text("Average"))
        .call(o => o.append("text")
            .attr("id", "avg-underscore-0")
            .attr("x", r)
            .attr("y", 25)
            .attr("fill", "white")
            .attr("style", "display: none;"))
        .call(o => o.append("text")
            .attr("id", "avg-underscore-1")
            .attr("x", r)
            .attr("y", 50)
            .attr("fill", "white")
            .attr("style", "display: none;"));

    // gauge legend
    var gale = [
        ["Extreme Underscorer", "-∞ ➤ -0.12"],
        ["Underscorer", "-0.12 ➤ -0.04"],
        ["Neutral", "-0.04 ➤ 0.04"],
        ["Top Scorer", "0.04 ➤ 0.12"],
        ["National Pride", "0.12 ➤ +∞"]
    ];

    // add legend titles
    var g = svg.append("g")
        .attr("id", "gauge-legend")
        .attr("transform", `translate(45,${r + 160})`)
        .call(o => o.append("text")
            .text("Proficiency")
            .attr("style", "font-weight: bold;")
            .attr("x", 105)
            .attr("y", -8)
        ).call(o => o.append("text")
            .text("Range")
            .attr("style", "font-weight: bold;")
            .attr("x", 240)
            .attr("y", -8)
        );

    // create legend lines
    for (var i = 0; i < gale.length; i++)
        g.append("g")
            .attr("transform", `translate(0,${22 * i})`)
            .call(o => o.append("circle")
                .attr("cx", 10)
                .attr("cy", 10)
                .attr("fill", config.arcColorFn(i * .2))
                .attr("r", 8)
            ).call(o => o.append("text")
                .attr("x", 105)
                .attr("y", 11)
                .text(gale[i][0])
            ).call(o => o.append("text")
                .attr("x", 240)
                .attr("y", 11)
                .text(gale[i][1])
            );

    updateGauge();
};

// updates gauge idim when needed
function updateGauge() {
    var center = {"x": 190, "y": 190};
    var svg = d3.select(".gauge");
    var scores = ["Extreme Underscorer", "Underscorer", "Neutral", "Top Scorer", "National Pride"];
    var unders = [];
    let avg;

    // if there are no countries selected, select the best 25 of all countries
    if (active_countries[0] === "") {
        var players = players_compact_data.sort(function (a, b) {
            var keyA = parseFloat(a.player_avg);
            var keyB = parseFloat(b.player_avg);

            if (keyA < keyB) return 1;
            if (keyA > keyB) return -1;
            return 0;
        }).slice(0, 25);

        // calculate underscorability average
        for (var i = 0; i < players.length; i++) unders.push(parseFloat(players[i].score));
        avg = unders.reduce((a,v,i)=>(a*i+v)/(i+1));
    }

    // otherwise, business as usual
    else {
        var players = players_compact_data.filter(
            x => (active_countries.includes(x.country))
        ).sort(function (a, b) {
            // order by id if same country
            if (a.country === b.country) {
                if (parseInt(a.id) < parseInt(b.id)) return -1;
                if (parseInt(a.id) > parseInt(b.id)) return 1;
                return 0;
            }
            // otherwise, order by the position of the country in the active_countries
            else {
                var a_i = active_countries.indexOf(a.country);
                var b_i = active_countries.indexOf(b.country);
                if (a_i < b_i) return -1;
                if (a_i > b_i) return 1;
                return 0;
            }
        });

        // calculate underscorability average
        for (var i = 0; i < players.length; i++) {
            if (players[i].country === active_countries[no_countries_mode])
                unders.push(parseFloat(players[i].score));
        }
        avg = unders.reduce((a,v,i)=>(a*i+v)/(i+1));
    }

    var colorNo = function (country) {
        if (active_countries[0] === "") return 0;
        return active_countries_colors[active_countries.indexOf(country)];
    };

    var scale_radius = d3.scaleLinear()
        .domain([-0.2, 0.2])
        .range([-5*Math.PI/4, Math.PI/4])
        .clamp(true);

    var scale_gauge = d3.scaleLinear()
        .domain([-0.2, 0.2])
        .range([-135, 135])
        .clamp(true);

    // insert player circles
    svg.selectAll(".gauge-circle")
        .data(players)
        .join(
            enter => enter.append("circle")
                .attr("class", "gauge-circle")
                .attr("data-playerid", d => d.id)
                .attr("data-playeractive", "false")
                .attr("cx", d => polarToCartesian(center.x, center.y, d.id % 60 + 100, d.id % 60 + 100, scale_radius(d.score))["x"])
                .attr("cy", d => polarToCartesian(center.x, center.y, d.id % 60 + 100, d.id % 60 + 100, scale_radius(d.score))["y"])
                .attr("fill", d => country_colors[d.country].active[colorNo(d.country)])
                .attr("style", "opacity: 0.85")
                .attr("stroke", "black")
                .attr("stroke-width", 0)
                .call(enter => enter
                    .transition().duration(500)
                    .attr("stroke-width", 2)
                    .attr("r", 8)
                )
                .append("title")
                .attr("class", "title-gauge-circle")
                .text(d => (d.first_name !== "" ? `${d.first_name[0]}. ` : "") + `${d.last_name}: ${d.score} (${d.category})`),
            
            update => update
                .attr("class", "gauge-circle")
                .attr("data-playerid", d => d.id)
                .attr("data-playeractive", "false")
                .call(update => update
                    .transition().duration(500)
                    .attr("fill", d => country_colors[d.country].active[colorNo(d.country)])
                    .attr("stroke-width", 2)
                    .attr("stroke", "black")
                    .attr("cx", d => polarToCartesian(center.x, center.y, d.id % 60 + 100, d.id % 60 + 100, scale_radius(d.score))["x"])
                    .attr("cy", d => polarToCartesian(center.x, center.y, d.id % 60 + 100, d.id % 60 + 100, scale_radius(d.score))["y"])
                )
                .select("title")
                .text(d => (d.first_name !== "" ? `${d.first_name[0]}. ` : "") + `${d.last_name}: ${d.score} (${d.category})`),
            
            exit => exit
                .transition().duration(500)
                .attr("r", 0)
                .remove()
        );

    // rotate gauge
    if (no_countries_mode === 0)
        d3.selectAll(".gauge-gauge")
            .transition().duration(500)
            .attr("fill", d => active_countries[0] === "" ? "#aaa" : country_colors[active_countries[0]].hover[colorNo(active_countries[0])])
            .attr("transform", `rotate(${scale_gauge(avg)})`);
    else
        d3.selectAll("#gauge-gauge-1")
            .transition().duration(500)
            .attr("fill", d => active_countries[0] === "" ? "#aaa" : country_colors[active_countries[1]].hover[colorNo(active_countries[1])])
            .attr("transform", `rotate(${scale_gauge(avg)})`);

    // edit gauge legend
    d3.select($(`#avg-underscore-${no_countries_mode}`).fadeIn(500)[0])
        .transition().duration(500)
        .attr("fill", active_countries[0] === "" ? "#aaa" : country_colors[active_countries[no_countries_mode]].hover[colorNo(active_countries[no_countries_mode])])
        .text(Math.round(avg * 100) / 100);

    if (no_countries_mode == 0)
        $(`#avg-underscore-1`).fadeOut(500, function () {
            d3.select(this).text("");
        });

    bindPlayerHover();
    bindPlayerUnhover();
    bindPlayerClick();
}

/* ================================================================ */
/*                         GENERAL FUNCTIONS                        */
/* ================================================================ */
// calculate text color depending on background
function textcolor(color) {
    // convert from HEX to RGB if necessary
    if (color[0] === "#") {
        var value = [];
        value[0] = parseInt(color.substring(1,3), 16);
        value[1] = parseInt(color.substring(3,5), 16);
        value[2] = parseInt(color.substring(5,7), 16);
    }
    // convert from HSL to RGB
    else if (color[0] === "h") value = HSLtoRGB(color).replace(/[^\d,]/g, "").split(",");
    // in case it's RGB
    else value = color.replace(/[^\d,]/g, "").split(",");

    return 1 - (0.299 * value[0] + 0.587 * value[1] + 0.114 * value[2]) / 255 < 0.5 ? "black" : "white";
}

// change country state
function switchCountryState(no) {
    no_countries_mode = no - 1;
}

// function called when form receives a change
function formChange() {
    var form_values = $("form#player-barchart-form").serializeArray().reduce(function (obj, item) {
        obj[item.name] = item.value;
        return obj;
    }, {});

    updatePlayersBarChart(form_values.order, form_values.ascdesc);
}

// convert from HSL to RGB
function HSLtoRGB(color) {
    var hsl = color.replace(/[^\d,]/g, "").split(",");
    
    let a = (hsl[1] / 100) * Math.min((hsl[2] / 100), 1 - (hsl[2] / 100));
    let f = (n,k = (n + hsl[0] / 30) % 12) => (hsl[2] / 100) - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);                 
    value = [f(0) * 255, f(8) * 255, f(4) * 255];

    return `rgb(${Math.ceil(value[0])},${Math.ceil(value[1])},${Math.ceil(value[2])})`;
}

// see if it's possible to use the main color, or if the secondary it's needed
function getCountryColor(country) {
    // if there's no selected country, use the main color
    if (no_countries_mode === 0 || active_countries[0] === "") return 0;
    // otherwise, checks if the colors are the same
    if (country_colors[country].active[0] === country_colors[active_countries[0]].active[active_countries_colors[0]]) return 1;
    // otherwise, return the main color
    return 0;
}
