/**
 * hierarchicalBundlingChart - A reusable & responsive hierarchical bundling chart based on D3.js for flat JSON data
 *
 * @param  {string} parentNodeSelector name of the selector where you would like to put the chart svg in
 * @param  {string} jsonUrl            filepath for the JSON file
 * @param  {object} userStyles         a object of user defined styles, accepted keys and default values are as below
 */

function hierarchicalBundlingChart(parentNodeSelector, jsonUrl, userStyles) {

  var styles = {
    angle: 360,
    tension: 0.8,
    sort: 1, // accept 1, -1, or 0
    backgroundColor: "#434A54",

    rollupColName: "",
    rollupColNameTooltip: "#Links",
    groupColNames: [],
    groupColNamesAllExcept: ["salesAmount"],
    groupColNamesMap: {},
    groupColColorsMap: {},

    fontSizeDefault: "13px",
    fontWeightDefault: 700,

    textWidth: 130,
    barHeight: 50,
    barWidth: 20,

    linkColor: "#F5F7FA",
    linkStrokeWidthRange: [1, 8],
    opacityDefault: 0.5,
    opacityHighlight: 1,
    opacityBackground: 0.01,
  };

  for (var attr in userStyles) {
    styles[attr] = userStyles[attr];
  }

  injectCSSClass(
    "svg, .tooltip", {
      "font-family": "\"HelveticaNeue-Light\", \"Helvetica Neue Light\", \"Helvetica Neue\", Helvetica, Arial, \"Lucida Grande\", sans-serif",
    }
  );

  injectCSSClass(
    ".node", {
      "font-size": styles.fontSizeDefault,
      "font-weight": styles.fontWeightDefault,
      "cursor": "pointer"
    }
  );

  injectCSSClass(
    ".link", {
      "stroke": styles.linkColor,
      "opacity": styles.opacityDefault,
      "fill": "none",
      "pointer-events": "none"
    }
  );

  injectCSSClass(
    ".node:hover, .node-source, .node-target, .link-source, .link-target", {
      "opacity": styles.opacityHighlight
    }
  );

  injectCSSClass(
    ".node-bg, .link-bg", {
      "opacity": styles.opacityBackground
    }
  );

  injectCSSClass(
    ".node-colname", {
      "pointer-events": "none",
      "font-size": parseInt(styles.fontSizeDefault) * 1.5 + "px"
    }
  );

  injectCSSClass(
    ".tooltip", {
      "background-color": styles.linkColor,
      "opacity": 0.8,
      "position": "absolute",
      "padding": "10px",
      "border-radius": "5px",
      "box-shadow": "0 1px 2px rgba(0,0,0,0.1)",
      "color": styles.backgroundColor,
      "vertical-align": "middle",
      "font-size": styles.fontSizeDefault,
      "font-weight": styles.fontWeightDefault
    }
  );

  render();
  d3.select(window).on("resize.hbc", render); //rerender when window size changes

  function render() {
    var parentSelection = d3.select(parentNodeSelector),
      parentDivWidth = parentSelection[0][0].clientWidth,
      parentDivHeight = parentSelection[0][0].clientHeight,
      diameter = Math.min(parentDivWidth, parentDivHeight),
      radius = diameter / 2,
      innerRadius = radius - styles.textWidth - styles.barHeight,
      c10 = d3.scale.category10(),
      color = function(colName) {
        return colName in styles.groupColColorsMap ? styles.groupColColorsMap[colName] : c10(colName);
      };

    parentSelection.selectAll("svg").remove();

    var svg = parentSelection.append("svg");
    var sheet = svg.append("rect")
      .attr({
        x: 0,
        y: 0,
        width: "100%",
        height: "100%",
        fill: styles.backgroundColor
      });
    var rootG = svg.attr("width", "100%")
      .attr("height", "100%")
      .append("g")
      .attr("transform", "translate(" + parentDivWidth / 2 + "," + parentDivHeight / 2 + ")");

    var link = rootG.append("g").selectAll(".link"),
      node = rootG.append("g").selectAll(".node"),
      nodeBar = rootG.append("g").selectAll(".node-bar");

    var cluster = d3.layout.cluster()
      .children(function(d) {
        if (!isInt(d.values)) {
          return d.values;
        }
      })
      .size([styles.angle, innerRadius])
      .value(function(d) {
        if (isInt(d.values)) {
          return d.values;
        }
      });

    var bundle = d3.layout.bundle();

    var line = d3.svg.line.radial()
      .interpolate("bundle")
      .tension(styles.tension)
      .radius(function(d) {
        return d.y;
      })
      .angle(function(d) {
        return d.x / 180 * Math.PI;
      });

    d3.json(jsonUrl, function(error, _data) {

      var nodes = cluster.nodes(getNodes(_data)),
        links = getLinks(_data, nodes);

      var scaleBarHeight = d3.scale.linear()
        .domain([0, d3.max(nodes, function(d) {
          if (isInt(d.values)) {
            return d.values;
          }
        })])
        .range([0, styles.barHeight]);

      var scaleLinkWidth = d3.scale.linear()
        .domain([0, d3.max(links, function(d) {
          return d.value;
        })])
        .range(styles.linkStrokeWidthRange);

      link = link
        .data(bundle(links))
        .enter()
        .append("path")
        .attr("class", "link")
        .each(function(d) {
          d.source = d[0];
          d.target = d[d.length - 1];
        })
        .style("stroke-width", function(d, i) {
          return scaleLinkWidth(links[i].value);
        });

      link
        .transition()
        .delay(function(d, i) {
          return nodes.length * 25 + i * 15;
        })
        .attr("d", line);

      node = node
        .data(nodes.filter(function(n) {
          return isLeafNode(n) || isGroupColNode(n);
        }))
        .enter()
        .append("text")
        .attr("class", "node")
        .attr("dy", ".31em")
        .attr("transform", function(d) {
          return isGroupColNode(d) ?
            "rotate(" + (d.x - 90) + ")translate(" + (d.y - innerRadius / 2 + radius - styles.textWidth / 5) + ",0)" + "rotate(" + (d.x < 90 || d.x > 270 ? 90 : 270) + ")" :
            "rotate(" + (d.x - 90) + ")translate(" + (d.y + scaleBarHeight(d.value) + 5) + ",0)" + (d.x < 180 ? "" : "rotate(180)");
        })
        .style("text-anchor", function(d) {
          return isGroupColNode(d) ? "middle" : (d.x < 180 ? "start" : "end");
        })
        .style("fill", function(d) {
          return color(isGroupColNode(d) ? d.key : d.parent.key);
        })
        .classed("node-colname", isGroupColNode)
        .text("");

      node
        .transition()
        .delay(function(d, i) {
          return i * 25;
        })
        .text(function(d) {
          return isGroupColNode(d) ? styles.groupColNamesMap[d.key] || d.key : d.key;
        });

      nodeBar = nodeBar
        .data(nodes.filter(isLeafNode))
        .enter()
        .append("rect")
        .attr("class", "node-bar")
        .attr("transform", function(d) {
          return "rotate(" + (d.x - 90) + ")translate(" + (d.y) + ",-" + styles.barWidth / 2 + ")";
        })
        .attr({
          "height": 0,
          "width": 0
        });

      nodeBar
        .transition()
        .delay(function(d, i) {
          return i * 25;
        })
        .attr("width", function(d) {
          return scaleBarHeight(d.value);
        })
        .attr("height", styles.barWidth)
        .attr({
          "rx": 2,
          "ry": 2
        })
        .style({
          "cursor": "pointer",
          "fill": function(d) {
            return color(d.parent.key);
          }
        });

      rootG.selectAll(".node")
        .on("mouseover.hbcNode", mouseovered)
        .on("mouseout.hbcNode", mouseouted)
        .call(tooltip);

      rootG.selectAll(".node-bar")
        .on("mouseover.hbcNode", mouseovered)
        .on("mouseout.hbcNode", mouseouted)
        .call(tooltip);

      sheet.on("click.hbcrootg", mouseouted);
    });

    function mouseovered(d) {
      node
        .each(function(n) {
          n.target = n.source = false;
        });

      nodeBar
        .each(function(n) {
          n.target = n.source = false;
        });

      link
        .classed("link-target", function(l) {
          if (l.target === d) return l.source.source = true;
        })
        .classed("link-source", function(l) {
          if (l.source === d) return l.target.target = true;
        })
        .classed("link-bg", function(l) {
          return l.target !== d && l.source !== d;
        })
        .filter(function(l) {
          return l.target === d || l.source === d;
        })
        .each(function() {
          this.parentNode.appendChild(this);
        });

      node
        .classed("node-target", function(n) {
          return n.target;
        })
        .classed("node-source", function(n) {
          return n.source;
        })
        .classed("node-bg", function(n) {
          return !n.target && !n.source && n.key != d.key;
        });

      nodeBar
        .classed("node-target", function(n) {
          return n.target;
        })
        .classed("node-source", function(n) {
          return n.source;
        })
        .classed("node-bg", function(n) {
          return !n.target && !n.source && n.key != d.key;
        });
    }

    function mouseouted(d) {
      link
        .classed("link-target", false)
        .classed("link-source", false)
        .classed("link-bg", false);

      node
        .classed("node-target", false)
        .classed("node-source", false)
        .classed("node-bg", false);

      nodeBar
        .classed("node-target", false)
        .classed("node-source", false)
        .classed("node-bg", false);
    }
  }

  function getNodes(data) {
    var rootValues = [],
      groups = getGroups(data);
    groups.forEach(function(e) {
      rootValues.push({
        key: e,
        values: aggregateByCol(e, data, styles.rollupColName).sort(sortBy("values"))
      });
    });
    return {
      key: "",
      values: copyObj(rootValues.sort(sortBy("key")))
    };
  }

  function getLinks(data, nodes) {
    var links = [],
      mapNameNode = {};

    nodes.forEach(function(n) {
      mapNameNode[n.key] = n;
    });

    var pairs = getGroupPairs(data);
    pairs.forEach(function(pair) {
      var linksByNames = aggregateByCol(pair, data, styles.rollupColName);
      linksByNames.forEach(function(d) {
        var namePair = d.key.split(",");
        links.push({
          source: mapNameNode[namePair[0]],
          target: mapNameNode[namePair[1]],
          value: d.values
        });
      });
    });

    return links;
  }

  function getGroups(data) {
    if (styles.groupColNames.length > 0) {
      return styles.groupColNames;
    } else if (styles.groupColNamesAllExcept.length > 0) {
      var groups = Object.keys(data[0]);
      styles.groupColNamesAllExcept.forEach(function(col) {
        groups.splice(groups.indexOf(col), 1);
      });
      return groups;
    }
  }

  function getGroupPairs(data) {
    var groups = getGroups(data),
      pairs = [];
    for (var i = 0; i < groups.length - 1; i++) {
      for (var j = i + 1; j < groups.length; j++) {
        pairs.push([groups[i], groups[j]]);
      }
    }
    return pairs;
  }

  function isInGroupColNames(col) {
    if (styles.groupColNames.length >= 1) {
      return styles.groupColNames.indexOf(col) >= 0;
    } else if (styles.groupColNamesAllExcept) {
      return styles.groupColNamesAllExcept.indexOf(col) < 0;
    }
  }

  function isGroupColNode(n) {
    return n.parent && n.parent.key === "" && isInGroupColNames(n.key);
  }

  function isLeafNode(n) {
    return !n.children;
  }

  function aggregateByCol(colName, data, rollupColName) {
    return d3.nest()
      .key(function(d) {
        if (isString(colName)) {
          return d[colName];
        } else {
          return colName.map(function(f) {
            return d[f];
          });
        }
      })
      .rollup(function(leaves) {
        if (!rollupColName || rollupColName === "") {
          return leaves.length;
        } else {
          return d3.sum(leaves, function(d) {
            return parseInt(d[rollupColName]);
          });
        }
      })
      .entries(data);
  }

  function sortBy(key) {
    return function(a, b) {
      if (b[key] > a[key]) {
        return styles.sort;
      } else if (b[key] === a[key]) {
        return 0;
      } else {
        return -styles.sort;
      }
    };
  }

  function tooltip(selection) {
    var rootSelection = d3.select('body'),
      tooltipDiv;
    selection.on('mouseover.hbctooltip', function(d, i) {
        rootSelection.selectAll('div.tooltip').remove(); // clean up lost tooltips
        tooltipDiv = rootSelection.append('div')
          .attr('class', 'tooltip');
        positionTooltip();
        tooltipDiv.html(
          p(styles.rollupColNameTooltip + ": " + d.values)
        );
      })
      .on('mousemove.hbctooltip', function() {
        positionTooltip();
      })
      .on('mouseout.hbctooltip', function() {
        tooltipDiv.remove();
      });

    function positionTooltip() {
      var mousePosition = d3.mouse(rootSelection.node());
      tooltipDiv.style({
        left: (mousePosition[0] + 10) + 'px',
        top: (mousePosition[1] - 40) + 'px',
      });
    }

    function p(d, c) {
      return c ? "<p class=\"tooltip-" + c + "\">" + d + "</p>" : "<p>" + d + "</p>";
    }
  }

  function injectCSSClass(name, rules) {
    var style = document.createElement('style');
    style.type = 'text/css';
    document.getElementsByTagName('head')[0].appendChild(style);
    if (!(style.sheet || {}).insertRule) {
      (style.styleSheet || style.sheet).addRule(name, ruleObjectToRuleString(rules));
    } else {
      style.sheet.insertRule(name + "{" + ruleObjectToRuleString(rules) + "}", 0);
    }

    function ruleObjectToRuleString(rules) {
      var result = "";
      for (var key in rules) {
        result += gcs(key, rules[key]);
      }
      return result;
    }

    function gcs(name, val) { // generate css string
      return name + ":" + val + ";";
    }
  }

  function copyObj(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function isInt(a) {
    return typeof a === 'number' && (a % 1) === 0;
  }

  function isString(a) {
    return typeof a == 'string' || a instanceof String;
  }

}