var map;
var no_countries_mode = 1;
var country_colours = {"hover": "#72de78", "active": " #4bc551", "normal": "#aaa"}

// holds the current active countries
var active_countries = ["",""];

function resizeMap() {
    var map_container = map.parent();
    map.attr("height", map_container.height() + 2);
    map.attr("width", (map_container.height() + 2) * 1.45);
}

// keeps the body element at 16:9
function resizeBody(win) {
    var w_height = win.height();
    var w_width = win.width();
    var new_height = w_width * 9/16;
    var new_width = w_height * 16/9;

    if (new_height <= w_height) $("body").width(w_width).height(new_height);
    else $("body").width(new_width).height(w_height);
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

function bindCountryHover() {
    // hover on country (map or list)
    $("svg#map-svg path:not(.greyed-out), ul#country-pick li").on("mouseover", function () {
        // this way, it deals with all the country's paths, along with the list item
        $("svg#map-svg path[data-country=" + this.dataset.country + "], ul#country-pick li#li-" + this.dataset.country).each(function () {
            // if it's the path, just changes its color
            if (this.localName == "path" && $(this).attr("fill") != country_colours.active)
                $(this).attr("fill", country_colours.hover);

            // if it's the list item, only "hovers" it if item not active
            // important because list item may be "hovered" (temporary highlight) or "active" (permanent highlight)
            else if (!this.dataset.active || this.dataset.active === "false") {
                this.dataset.hovered = true;
            }
        });
    });
}

function bindCountryUnhover() {
    // taking the mouse off the country (map or list)
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
}

// what to do when he page loads
$(window).on("load", function() {
    loadMapStuff();
    resizeBody($(this));
    resizeMap();

    bindCountryHover();
    bindCountryUnhover();
    bindCountryClick();
<<<<<<< Updated upstream
=======
    createStadium();

    $.ajax({
        type: "GET",
        url: "data/attendances.csv",
        dataType: "text",
        success: function (response) {
            data = $.csv.toObjects(response);
            console.log(data)
        }
    });
>>>>>>> Stashed changes
});

// what to  do on window resize
$(window).on("resize", function() {
    resizeBody($(this));
    resizeMap();
});