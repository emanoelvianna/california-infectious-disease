(function () {
  'use strict';
  angular
    .module('app')
    .controller('AppCtrl', Controller);

  Controller.$inject = [
    '$q',
    '$log',
    '$scope',
    'resource.LoadingScreenService'
  ];

  function Controller($q, $log, $scope, LoadingScreenService) {
    const MAP_COLORS = {
      SELECTED: '#000000',
      INFECTED: '#ff6f69',
      SUSCEPTIBLE: '#ffcc5c',
      FREE: '#88d8b0'
    };
    const MALE_COLOR = '#357df2';
    const FEMALE_COLOR = '#db2e3c';
    const COUNTY_COLOR = '#40ce66';

    var map;
    var yearFilterStart = 2001;
    var yearFilterEnd = 2010;
    var countySelected = 'Siskiyou';
    var highestYValueGender = 0;
    var highestYValueCounty = 0;
    var simulateQuery = false;
    var distributionData = new Map();
    var filteredData = undefined;

    /* public variables */
    var self = this;
    self.diseases = [];
    self.diseaseSelected = undefined;
    self.infectiousDiseaseData;
    self.totalAmount = 0;

    /* Lifecycle hooks */
    self.$onInit = onInit;
    self.querySearch = querySearch;
    self.selectedItemChange = selectedItemChange;
    self.searchTextChange = searchTextChange;

    function onInit() {
      LoadingScreenService.start();
      d3.csv('data/infectious-disease-data.csv').then(function (data) {
        self.infectiousDiseaseData = data;
        _buildDistributionInMap();
        _timeline();
        _setDiseaseList();
        _buildDistributionChartAboutSex();
        _buildCountyTimelineChart();
        _update();
        LoadingScreenService.finish();
      });
    }

    function querySearch(query) {
      var results = query ? self.diseases.filter(createFilterFor(query)) : self.diseases, deferred;
      if (simulateQuery) {
        deferred = $q.defer();
        $timeout(function () { deferred.resolve(results); }, Math.random() * 1000, false);
        return deferred.promise;
      } else {
        return results;
      }
    }

    function createFilterFor(query) {
      var lowercaseQuery = query.toLowerCase();
      return function filterFn(disease) {
        return (disease.toLowerCase().indexOf(lowercaseQuery) === 0);
      };
    }

    function searchTextChange(text) {
      $log.info('Text changed to ' + text);
    }

    function selectedItemChange(item) {
      _update();
      $log.info('Item changed to ' + JSON.stringify(item));
    }

    function _setDiseaseList() {
      self.infectiousDiseaseData.map(function (d) {
        if (!self.diseases.includes(d.Disease))
          self.diseases.push(d.Disease);
      });
      self.diseaseSelected = self.diseases[8];
      $scope.$apply();
    }

    function _update() {
      var filteredDiseases;

      filteredDiseases = self.infectiousDiseaseData.filter(function (data) {
        if (_condition(data))
          return data;
      });

      _updateStatisticsData(filteredDiseases);
      _updateDataToCharts();
      _updateColorsInMap(filteredDiseases);
      /* update charts */
      _buildDistributionChartAboutSex();
      _buildCountyTimelineChart();
    }

    function _condition(data) {
      return (self.diseaseSelected === data.Disease) &&
        (data.Year >= yearFilterStart && data.Year <= yearFilterEnd)
    }

    function _updateStatisticsData(filteredDiseases) {
      // Create and Array[i][j], i = Year, j = object with gender and values for each one
      for (var currentYear = yearFilterStart; currentYear <= yearFilterEnd; currentYear++) {
        distributionData.set(currentYear, {
          male: 0,
          female: 0,
          county: 0
        });
      }

      self.totalAmount = 0;
      filteredDiseases.filter(function (disease) {
        if (disease.County === countySelected) {
          /* gender statistics */
           if (disease.Sex === 'Total') {
            var data = distributionData.get(Number(disease.Year));
            data.county += Number(disease.Count);
            distributionData.set(Number(disease.Year), data);

            /*  other stats */
            self.totalAmount += Number(disease.Count);
          }
        }
        else if (disease.County === 'California')
        {
          if (disease.Sex === 'Male') {
            var data = distributionData.get(Number(disease.Year));
            data.male += Number(disease.Count);
            distributionData.set(Number(disease.Year), data);
          } else if (disease.Sex === 'Female') {
            var data = distributionData.get(Number(disease.Year));
            data.female += Number(disease.Count);
            distributionData.set(Number(disease.Year), data);
          }
        }
      });
    }

    function _updateDataToCharts() {
      highestYValueGender = 0;
      highestYValueCounty = 0;

      self.filteredData = new Array();
      for (var currentYear = yearFilterStart; currentYear <= yearFilterEnd; currentYear++) {
        self.filteredData.push({
          year: Number(currentYear),
          male: distributionData.get(currentYear).male,
          female: distributionData.get(currentYear).female,
          county: distributionData.get(currentYear).county
        });

        // Find the Highest Y Value
        if (distributionData.get(currentYear).male > highestYValueGender)
          highestYValueGender = distributionData.get(currentYear).male;
        if (distributionData.get(currentYear).female > highestYValueGender)
          highestYValueGender = distributionData.get(currentYear).female;
        if (distributionData.get(currentYear).county > highestYValueCounty) {
          highestYValueCounty = distributionData.get(currentYear).county;
        }
      }
    }

    function _updateColorsInMap(filteredDiseases) {
      var highestCount = 0;
      var countyCounts = {};
      // Create a Dic with the sums for each county
      for (var i = 0; i < filteredDiseases.length; i++) {
        if (filteredDiseases[i].County != 'California' && filteredDiseases[i].Sex === 'Total')
        {
          if (countyCounts[filteredDiseases[i].County] == undefined)
            countyCounts[filteredDiseases[i].County] = Number(0);
          countyCounts[filteredDiseases[i].County] += Number(filteredDiseases[i].Count);
        }
      }
      // Find the county with the higher number of cases
      for (var key in countyCounts) {
        if (countyCounts.hasOwnProperty(key)) { 
          if(countyCounts[key] > highestCount)
            highestCount = countyCounts[key];
        }
      }
      map.selectAll('.subunit')
        .style('fill', function (d) {
          if (countySelected === d.properties.name) {
            return MAP_COLORS.SELECTED;
          }
          
          for (var i = 0; i < filteredDiseases.length; i++) {
            if (filteredDiseases[i].Sex === 'Total' && filteredDiseases[i].County === d.properties.name) {
              //var percent = ((filteredDiseases[i].Count / filteredDiseases[i].Population) * 100);
              var percent = ((countyCounts[filteredDiseases[i].County] / highestCount));
              return _getColour('#ffffff', '#ff0000', percent.toFixed(5));
            }
          }
        });
    }

    function _getColour(start_color, end_color, percent) {
      // strip the leading # if it's there
      start_color = start_color.replace(/^\s*#|\s*$/g, '');
      end_color = end_color.replace(/^\s*#|\s*$/g, '');

      // convert 3 char codes --> 6, e.g. `E0F` --> `EE00FF`
      if (start_color.length == 3) {
        start_color = start_color.replace(/(.)/g, '$1$1');
      }

      if (end_color.length == 3) {
        end_color = end_color.replace(/(.)/g, '$1$1');
      }

      // get colors
      var start_red = parseInt(start_color.substr(0, 2), 16),
        start_green = parseInt(start_color.substr(2, 2), 16),
        start_blue = parseInt(start_color.substr(4, 2), 16);

      var end_red = parseInt(end_color.substr(0, 2), 16),
        end_green = parseInt(end_color.substr(2, 2), 16),
        end_blue = parseInt(end_color.substr(4, 2), 16);

      // calculate new color
      var diff_red = end_red - start_red;
      var diff_green = end_green - start_green;
      var diff_blue = end_blue - start_blue;

      diff_red = ((diff_red * percent) + start_red).toString(16).split('.')[0];
      diff_green = ((diff_green * percent) + start_green).toString(16).split('.')[0];
      diff_blue = ((diff_blue * percent) + start_blue).toString(16).split('.')[0];

      // ensure 2 digits by color
      if (diff_red.length == 1) diff_red = '0' + diff_red
      if (diff_green.length == 1) diff_green = '0' + diff_green
      if (diff_blue.length == 1) diff_blue = '0' + diff_blue

      //console.log('#' + diff_red + diff_green + diff_blue);
      return '#' + diff_red + diff_green + diff_blue;
    };

    function _timeline() {
      var dataTime = d3.range(0, 16).map(function (d) {
        return new Date(2001 + d, 0, 1);
      });

      var sliderRange = d3
        .sliderBottom()
        .min(d3.min(dataTime))
        .max(d3.max(dataTime))
        .width(400)
        .tickFormat(d3.timeFormat('%Y'))
        .tickValues(dataTime)
        .default([new Date(2001, 0, 1), new Date(2010, 0, 1)])
        .fill('#2196f3')
        .on('onchange', val => {
          d3.select('p#value-range').text(val.map(d3.timeFormat('%Y')).join('-'));
          yearFilterStart = Number(val.map(d3.timeFormat('%Y'))[0]);
          yearFilterEnd = Number(val.map(d3.timeFormat('%Y'))[1]);
          _update();
        });
      var gRange = d3
        .select('div#slider-range')
        .append('svg')
        .attr('width', 500)
        .attr('height', 100)
        .append('g')
        .attr('transform', 'translate(30,30)');

      gRange.call(sliderRange);

      d3.select('p#value-range').text(
        sliderRange
          .value()
          .map(d3.timeFormat('%Y'))
          .join('-')
      );
    }

    function _buildCountyTimelineChart() {
      // Clear the last Chart
      d3.select('#timeline-distribution').selectAll("*").remove();
      var countyTimelineChart = d3.select("#timeline-distribution");

      // Margin configuration
      var margin = { top: 10, right: 40, bottom: 40, left: 70 },
        width = 550 - margin.left - margin.right,
        height = 280 - margin.top - margin.bottom;

      // Append the SVG Object
      countyTimelineChart = d3.select("#timeline-distribution")
        .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform",
          "translate(" + margin.left + "," + margin.top + ")");

      // Axis Setup
      var xAxis = d3.scaleLinear()
        .domain([yearFilterStart, yearFilterEnd])
        .range([0, width]);
      var yAxis = d3.scaleLinear()
        .domain([0, highestYValueCounty])
        .range([height, 0]);
      countyTimelineChart.append("g")
        .attr("transform", "translate(0," + height + ")")
        .call(d3.axisBottom(xAxis)
          .ticks(yearFilterEnd - yearFilterStart + 1));
      countyTimelineChart.append("g")
        .call(d3.axisLeft(yAxis));
      countyTimelineChart.append("text")             
        .attr("transform",
              "translate(" + (width/2) + " ," + 
                            (height + margin.top + 25) + ")")
        .style("text-anchor", "middle")
        .style("fill", 'white')
        .text("Year");
      // Axis Labels
      countyTimelineChart.append("text")
        .attr("transform", "rotate(-90)")
        .attr("y", 0 - margin.left)
        .attr("x",0 - (height / 2))
        .attr("dy", "1em")
        .style("text-anchor", "middle")
        .style("fill", 'white')
        .text("Number of Cases"); 

      // County Plot
      countyTimelineChart
        .append("g")
        .selectAll("dot")
        .data(self.filteredData)
        .enter()
        .append("circle")
        .attr("cx", function (d) { return xAxis(d.year) })
        .attr("cy", function (d) { return yAxis(d.county) })
        .attr("r", 5)
        .attr("fill", COUNTY_COLOR)
      countyTimelineChart.append("path")
        .datum(self.filteredData)
        .attr("fill", "none")
        .attr("stroke", COUNTY_COLOR)
        .attr("stroke-width", 1.5)
        .attr("d", d3.line()
          .x(function (d) { return xAxis(d.year) })
          .y(function (d) { return yAxis(d.county) })
        );
    }

    function _buildDistributionChartAboutSex() {
      d3.select('#sex-distribution').selectAll("*").remove();
      // Clear the last Chart
      var sexDistributionChart = d3.select("#sex-distribution");

      // Margin configuration
      var margin = { top: 10, right: 40, bottom: 40, left: 70 },
        width = 550 - margin.left - margin.right,
        height = 280 - margin.top - margin.bottom;

      // Append the SVG Object
      sexDistributionChart = d3.select("#sex-distribution")
        .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform",
          "translate(" + margin.left + "," + margin.top + ")");
      // Axis Setup
      var xAxis = d3.scaleLinear()
        .domain([yearFilterStart, yearFilterEnd])
        .range([0, width]);
      var yAxis = d3.scaleLinear()
        .domain([0, highestYValueGender * 1.2])
        .range([height, 0]);
      sexDistributionChart.append("g")
        .attr("transform", "translate(0," + height + ")")
        .call(d3.axisBottom(xAxis)
          .ticks(yearFilterEnd - yearFilterStart + 1));
      sexDistributionChart.append("g")
        .call(d3.axisLeft(yAxis));
      // Axis Labels
      sexDistributionChart.append("text")             
        .attr("transform",
              "translate(" + (width/2) + " ," + 
                            (height + margin.top + 25) + ")")
        .style("text-anchor", "middle")
        .style("fill", 'white')
        .text("Year");
      sexDistributionChart.append("text")
        .attr("transform", "rotate(-90)")
        .attr("y", 0 - margin.left)
        .attr("x",0 - (height / 2))
        .attr("dy", "1em")
        .style("text-anchor", "middle")
        .style("fill", 'white')
        .text("Number of Cases"); 

      // Male Plot
      sexDistributionChart
        .append("g")
        .selectAll("dot")
        .data(self.filteredData)
        .enter()
        .append("circle")
        .attr("cx", function (d) { return xAxis(d.year) })
        .attr("cy", function (d) { return yAxis(d.male) })
        .attr("r", 5)
        .attr("fill", MALE_COLOR)
      sexDistributionChart.append("path")
        .datum(self.filteredData)
        .attr("fill", "none")
        .attr("stroke", MALE_COLOR)
        .attr("stroke-width", 1.5)
        .attr("d", d3.line()
          .x(function (d) { return xAxis(d.year) })
          .y(function (d) { return yAxis(d.male) })
        );
      // Female Plot
      sexDistributionChart
        .append("g")
        .selectAll("dot")
        .data(self.filteredData)
        .enter()
        .append("circle")
        .attr("cx", function (d) { return xAxis(d.year) })
        .attr("cy", function (d) { return yAxis(d.female) })
        .attr("r", 5)
        .attr("fill", FEMALE_COLOR);
      sexDistributionChart.append("path")
        .datum(self.filteredData)
        .attr("fill", "none")
        .attr("stroke", FEMALE_COLOR)
        .attr("stroke-width", 1.5)
        .attr("d", d3.line()
          .x(function (d) { return xAxis(d.year) })
          .y(function (d) { return yAxis(d.female) })
        );
      // Legend
      sexDistributionChart.append("rect")
        .attr("x", 10)
        .attr("y", -10)
        .attr("width", 75)
        .attr("height", 40)
        .attr("fill", "#303030")
        .attr("id", "rectLabel");
      sexDistributionChart.append("circle")
        .attr("cx",20).attr("cy",0)
        .attr("r", 6).style("fill", MALE_COLOR)
      sexDistributionChart.append("circle")
        .attr("cx",20).attr("cy",20)
        .attr("r", 6).style("fill", FEMALE_COLOR)
      sexDistributionChart.append("text")
        .attr("x", 30).attr("y", 1)
        .text("Male").style("font-size", "15px")
        .attr("alignment-baseline","middle")
        .style("fill", MALE_COLOR)
      sexDistributionChart.append("text")
        .attr("x", 30).attr("y", 21)
        .text("Female").style("font-size", "15px")
        .attr("alignment-baseline","middle")
        .style("fill", FEMALE_COLOR)

    }

    function _buildDistributionInMap() {
      d3.select('#map').selectAll("*").remove();
      var width = 550;
      var height = 460;

      var projection = d3.geoMercator()
        .scale(1000 * 2)
        .center([-122, 37])
        .translate([width / 2, height / 2]);

      var path = d3.geoPath()
        .projection(projection);

      map = d3.select('#map').append('svg')
        .attr('width', width)
        .attr('height', height);

      d3.json('data/california-map.json').then(function (ca) {
        map.append('path')
          .datum(topojson.feature(ca, ca.objects.subunits))
          .attr('class', 'land')
          .attr('d', path);

        /* bind feature data to the map */
        map.selectAll('.subunit')
          .data(topojson.feature(ca, ca.objects.subunits).features)
          .enter()
          .append('path')
          .attr('class', function (d) {
            return 'subunit ' + d.properties.name;
          })
          .attr('d', path)
          .on('mouseover', function (d) {
            div.transition()
              .duration(200)
              .style('opacity', .9);
            div.html(d.properties.fullName)
              .style('left', (d3.event.pageX - 100) + 'px')
              .style('top', (d3.event.pageY - 30) + 'px');
          })
          .on('mouseout', function (d) {
            div.transition()
              .duration(500)
              .style('opacity', 0.0);
          })
          .on('click', function (d) {
            countySelected = d.properties.name;
            _update();
          });

        /* exterior border */
        map.append('path')
          .datum(topojson.mesh(ca, ca.objects.subunits, function (a, b) { return a === b; }))
          .attr('d', path)
          .attr('class', 'exterior-boundary');

        /* tooltop declaration */
        var div = d3.select('#map').append('div')
          .attr('class', 'tooltip')
          .style('opacity', 0);

        /* legend to the map */
        // TODO:

        _update();
      });
    }
  }
}());
