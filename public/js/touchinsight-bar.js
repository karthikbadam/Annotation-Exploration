/*
 Input is an object containing parentId, cols, width, height
 */

function BarChart(options) {

    var cols, parentId, aggregates, groupbyDim, width, height, xAxis, bxAxis, backgroundData = null;

    var type = "barchart";

    var filters = [];

    var filters2D = [];

    var margin = {
        top: 25,
        right: 10,
        bottom: 20,
        left: 10
    };

    var label, ticks = 2, log = false;

    var yValue = function (d) {
            return d["key"];
        },
        xValue = function (d) {
            return d["value"] >= 1 ? d["value"] : 1;
        };

    var x = d3.scaleLinear(), y = d3.scaleLinear();

    var barH = 25;

    var myFormat = d3.format(',');

    function showAnnotation(data) {




    }

    function addAnnotation(d, i, selection) {

        if (!d3.event.altKey) {
            return;
        }

        // add annotation textbox
        $(".annotationObject").remove();

        var inputWrapper = d3.select("body").append("div")
            .attr("class", "annotationObject")
            .style("left", (d3.event.pageX - 20) + "px")
            .style("top", (d3.event.pageY - 40) + "px")
            .style("width", 200)
            .style("height", 200)
            .style("position", "absolute")
            .style("z-index", 100);

        inputWrapper = inputWrapper.append("fieldset").attr("id", "annotation-form")
            .style("background-color", "rgba(255, 255, 255, 0.7)");

        inputWrapper.append("legend")
            .html("Annotation");

        var inputDiv = inputWrapper.append("div")
            .attr("class", "mdl-textfield mdl-js-textfield");

        inputDiv.append("textarea")
            .attr("class", "mdl-textfield__input")
            .attr("id", parentId + "annotation")
            .attr("type", "text")
            .attr("width", 180)
            .attr("rows", "3")
            .on("change", function () {
                //Handle entered data here
                console.log(this.value);
                if (this.value && this.value.length > 0) {
                    d3.select("#" + parentId + "annotation-button").html("Add");
                } else {
                    d3.select("#" + parentId + "annotation-button").html("Close");
                }
            });

        inputDiv.append("label")
            .attr("class", "mdl-textfield__label")
            .attr("for", parentId + "annotation");

        componentHandler.upgradeElement(document.getElementById(parentId + "annotation"));

        inputWrapper.append("button")
            .attr("id", parentId + "annotation-button")
            .attr("class", "mdl-button mdl-js-button mdl-button--raised mdl-js-ripple-effect")
            .html("Close")
            .on('click', function () {

                console.log("Final annotation: " + document.getElementById(parentId + "annotation").value);

                if (document.getElementById(parentId + "annotation").value.length > 0) {
                    //do something
                }

                $(".annotationObject").remove();

                if (selection) {
                    selection.attr("fill", function () {
                        return this.tagName.toLowerCase() == "text" ? "#AAA" : THEME.fillColor;
                    });
                }
            });

        componentHandler.upgradeElement(document.getElementById(parentId + "annotation-button"));
    }

    function hover2 (d, i) {

        // Based on hierarchical clustering from the server

        $(".labelObject").remove();

        var inputWrapper = d3.select("body").append("div")
            .attr("class", "labelObject")
            .style("left", (d3.event.pageX - 20) + "px")
            .style("top", (d3.event.pageY - 40) + "px")
            .style("width", 400)
            .style("height", 200)
            .style("position", "absolute")
            .style("z-index", 100)
            .style("pointer-events", "none");

        inputWrapper = inputWrapper.append("fieldset").attr("id", "annotation-form")
            .style("background-color", "rgba(255, 255, 255, 0.7)");

        inputWrapper.append("legend")
            .html("Annotation");

        inputWrapper.append("div")
            .html(function () {
                // if (filtered.length > 0) {
                //     return filtered[0].purpose;
                // }
                // return "";
            });
    }

    function hover (d, i) {

        // Based on traditional binning algorithms

        var dataArray = aggregates.top(Infinity);
        var filtered = [];
        dataArray.forEach(function (datum) {
            var key = d["key"];
            if (datum[cols[0]] == key) {
                filtered.push(datum);
            }
        });

        $(".labelObject").remove();

        var inputWrapper = d3.select("body").append("div")
            .attr("class", "labelObject")
            .style("left", (d3.event.pageX - 20) + "px")
            .style("top", (d3.event.pageY - 40) + "px")
            .style("width", 400)
            .style("height", 200)
            .style("position", "absolute")
            .style("z-index", 100)
            .style("pointer-events", "none");

        inputWrapper = inputWrapper.append("fieldset").attr("id", "annotation-form")
            .style("background-color", "rgba(255, 255, 255, 0.7)");

        inputWrapper.append("legend")
            .html("Annotation");

        inputWrapper.append("div")
            .html(function () {
                if (filtered.length > 0) {
                    return filtered[0].purpose;
                }
                return "";
            });

    }

    function hoverend(d, i) {

        $(".labelObject").remove();

    }

    function click(d, i) {

        d3.event.stopPropagation();

        var filterKey = d["key"];
        var dimensionName = cols[0];

        if (d3.event.altKey) {
            var selection = d3.select(this).attr("fill", THEME.selection);
            console.log(d);
            addAnnotation(d, i, selection);
            return;
        }

        var query = queryManager.createQuery({
            index: dimensionName,
            value: filterKey,
            operator: "equal"
        });

        if (filters.indexOf(filterKey) >= 0) {
            var index = filters.indexOf(filterKey);
            filters.splice(index, 1);
            $(".labelObject").remove();

        } else {
            filters.push(filterKey);
            hover(d, i);
        }

        if (filters.length == 0) {
            aggregates.filterAll();
        } else {
            var filterDim = aggregates.filter(function (d) {
                return filters.indexOf(d) >= 0;
            });
        }

        queryManager.setGlobalQuery(query, true);
    }


    function chart(selection) {
        selection.each(function () {

            var data = [];
            groupbyDim.top(Infinity).forEach(function (d) {
                var datum = {};
                datum.key = d.key;
                datum.value = d.value;
                data.push(datum);
            });

            var unique = data.filter(function (d) {
                return d.value > 0;
            })

            var numClusters = unique.length;

            // TODO: Ask server for annotation data
            var metaAnnotation = {
                cols: cols,
                clusters: numClusters,
                filters: unique
            };

            //QueryManager.requestAnnotations(metaAnnotation);


            if (!backgroundData) {
                backgroundData = data;
            }

            x = log ? d3.scaleLog() : d3.scaleLinear();

            width = $("#" + parentId).width() - margin.left - margin.right;
            height = $("#" + parentId).height() - margin.top - margin.bottom;

            var actualheight = ((barH) * data.length < height ? height : (barH) * data.length) + 50 - margin.top - margin.bottom;

            // Update the x-scale.
            // Note: the domain for x is based on the current data
            x.domain(d3.extent(data, function (d) {
                return xValue(d);
            }));

            // Update the y-scale
            // Note: the domain for y is based on the entire data
            y.domain(d3.extent(backgroundData, function (d) {
                return yValue(d);
            }));

            x.range([0, width]);
            y.range([height, 0]);

            xAxis = d3.axisTop(x)
                .tickSizeInner(-height)
                .tickSizeOuter(0)
                .tickFormat(d3.format(".1s"))
                .tickPadding(10)
                .ticks(ticks);

            d3.select("#" + parentId)
                .style("overflow", "scroll");

            // Select the svg element, if it exists.
            var svg = d3.select(this).selectAll("svg");

            // Otherwise, create the skeletal chart.
            var gEnter = svg.data([data]).enter().append("svg")
                .attr("id", parentId + "bar")
                .on("click", addAnnotation)
                .append("g")
                .attr("id", "container");

            gEnter.append("g").attr("class", "x axis");
            gEnter.append("g").attr("class", "x baxis");

            // Update the outer dimensions.
            d3.select(this).selectAll("svg").attr("width", width + margin.left + margin.right)
                .attr("height", actualheight + margin.top + margin.bottom);

            // Update the inner dimensions.
            var g = d3.select(this).select("#container").attr("transform", "translate(0,0)");

            // Background view showing the current data
            var backgroundBarElements = d3.select(this).select("#container").selectAll(".background")
                .data(backgroundData, function name(d) {
                    return d["key"];
                });

            var backgroundBars = backgroundBarElements.enter().append("g")
                .attr("class", "background")
                .attr("transform", function (d, i) {
                    return "translate(" + margin.left + "," + (margin.top + i * barH) + ")";
                });

            backgroundBars.append("rect")
                .attr("width", function (d) {
                    return (x(d["value"]) + 1) > width ? width : (x(d["value"]) + 1);
                })
                .attr("height", barH - 5)
                .attr("fill", THEME.backgroundFillColor)
                .attr("fill-opacity", 0.1)
                .attr("stroke", THEME.backgroundFillColor)
                .attr("stroke-opacity", 0.1)
                .style("mouse-events", "none");

            // backgroundBarElements.select("rect")
            //     .attr("width", function (d) {
            //         return x(Math.pow(d["value"], 1)) > width ? width : x(Math.pow(d["value"], 1));
            //     })
            //     .attr("height", barH - 5);

            backgroundBarElements.exit().remove();

            // Foreground view showing the current data
            var foregroundBarElements = d3.select(this).select("#container").selectAll(".foreground")
                .data(data, function name(d) {
                    return d["key"];
                });

            var foregroundBars = foregroundBarElements.enter().append("g")
                .attr("class", "foreground")
                .attr("transform", function (d, i) {
                    return "translate(" + margin.left + "," + (margin.top + i * barH) + ")";
                });

            foregroundBars.append("rect")
                .attr("width", function (d) {
                    return x(d["value"]) + 1;
                })
                .attr("height", barH - 5)
                .attr("fill", THEME.fillColor)
                .attr("fill-opacity", 0.5)
                .attr("stroke", THEME.fillColor)
                .attr("stroke-opacity", 0.7)
                .style("cursor", "pointer")
                .style("display", function (d) {
                    if (filters.length > 0 && filters.indexOf(d.key) < 0) {
                        return "none";
                    } else {
                        return "block";
                    }
                })
                .on('mouseover', hover)
                .on("click", click)
                .on('mouseout', hoverend);

            foregroundBarElements.select("g rect")
                .attr("width", function (d) {
                    return x(d["value"]) + 1;
                })
                .attr("height", barH - 5)
                .style("display", function (d) {
                    if (filters.length > 0 && filters.indexOf(d.key) < 0) {
                        return "none";
                    } else {
                        return "block";
                    }
                });

            foregroundBars.append("text")
                .attr("x", function (d) {
                    return 5;
                })
                .attr("y", barH / 3)
                .attr("fill-opacity", 1)
                .attr("fill", "#222")
                .attr("text-anchor", "start")
                .attr("dy", ".35em")
                .text(function (d) {
                    return myFormat(Math.round(d["value"]));
                })
                .style("display", function (d) {
                    if (filters.length > 0 && filters.indexOf(d.key) < 0) {
                        return "none";
                    } else {
                        return "block";
                    }
                })
                .style("pointer-events", "none");

            foregroundBarElements.select("g text")
                .attr("x", function (d) {
                    return 5;
                })
                .attr("y", barH / 3)
                .text(function (d) {
                    return myFormat(Math.round(d["value"]));
                })
                .style("display", function (d) {
                    if (filters.length > 0 && filters.indexOf(d.key) < 0) {
                        return "none";
                    } else {
                        return "block";
                    }
                });

            foregroundBarElements.exit().remove();

            d3.select(this).selectAll("svg").selectAll("text.name")
                .data(data)
                .enter().append("text")
                .style("width", margin.left)
                .attr("x", margin.left - 5)
                .attr("y", function (d, i) {
                    return margin.top + i * barH + barH / 2;
                })
                .attr("fill", "#AAA")
                .attr("text-anchor", "end")
                .attr('class', 'name')
                .style('text-overflow', 'ellipsis')
                .style("cursor", "pointer")
                .text(function (d) {
                    if (d["key"].length * 3 > margin.left) {
                        return d["key"].substr(0, 12) + "...";
                    }
                    return d["key"];
                })
                //.on('mouseover', hover)
                .on("click", click)
                //.on('mouseout', hoverend);

            g.select(".x.axis")
                .attr("transform", "translate(" + margin.left + "," + margin.top + ")")
                .call(xAxis);

            if (!bxAxis) {
                bxAxis = d3.axisBottom(x)
                    .tickFormat(d3.format(".1s"))
                    .ticks(ticks);

                g.select(".x.baxis")
                    .attr("transform", "translate(" + margin.left + "," + (margin.top + actualheight) + ")")
                    .call(bxAxis);
            }

            // axis labels
            // text label for the y axis
            // svg.append("text")
            //     .attr("transform", "rotate(-90)")
            //     .attr("y", 0 - margin.left)
            //     .attr("x", 0 - (height / 2))
            //     .attr("dy", "1em")
            //     .style("text-anchor", "middle")
            //     .text("Value");

            gEnter.append("text")
                .attr("x", margin.left - 20)
                .attr("y", margin.top - 10)
                .attr("fill", "#222")
                .attr("text-anchor", "end")
                .attr("font-size", "14px")
                .text(label + " " + cols[0]);

        });
    }


    chart.render = function () {
        d3.select("#" + parentId).call(this);
        return chart;
    };

    chart.log = function (_) {
        if (!arguments.length) return log;
        log = _;
        return chart;
    };

    chart.ticks = function (_) {
        if (!arguments.length) return ticks;
        ticks = _;
        return chart;
    };

    chart.label = function (_) {
        if (!arguments.length) return label;
        label = _;
        return chart;
    };

    chart.filters = function (_) {
        if (!arguments.length) return filters;
        filters = _;
        return chart;
    };

    chart.filters2D = function (_) {
        if (!arguments.length) return filters2D;
        filters2D = _;
        return chart;
    };

    chart.cols = function (_) {
        if (!arguments.length) return cols;
        cols = _;
        return chart;
    };

    chart.parent = function (_) {
        if (!arguments.length) return parentId;
        parentId = _;
        return chart;
    };

    chart.aggregates = function (_) {
        if (!arguments.length) return aggregates;
        aggregates = _;
        return chart;
    };

    chart.groupbyDim = function (_) {
        if (!arguments.length) return groupbyDim;
        groupbyDim = _;
        return chart;
    };

    chart.backgroundData = function (_) {
        if (!arguments.length) return backgroundData;
        backgroundData = _;
        return chart;
    };

    chart.margin = function (_) {
        if (!arguments.length) return margin;
        margin = _;
        return chart;
    };

    chart.marginLeft = function (_) {
        if (!arguments.length) return margin.left;
        margin.left = _;
        return chart;
    };

    chart.marginTop = function (_) {
        if (!arguments.length) return margin.top;
        margin.top = _;
        return chart;
    };

    chart.width = function (_) {
        if (!arguments.length) return width;
        width = _;
        return chart;
    };

    chart.height = function (_) {
        if (!arguments.length) return height;
        height = _;
        return chart;
    };

    chart.x = function (_) {
        if (!arguments.length) return x;
        x = _;
        return chart;
    };

    chart.y = function (_) {
        if (!arguments.length) return y;
        y = _;
        return chart;
    };

    return chart;
}
