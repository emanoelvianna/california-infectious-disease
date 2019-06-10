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
    var yearFilterEnd = 2005;
    var countySelected = 'Sierra';
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
    self.distributionBySex;

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
        _updateChart();
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
      _updateChart();
      $log.info('Item changed to ' + JSON.stringify(item));
    }

    function _setDiseaseList() {
      self.infectiousDiseaseData.map(function (d) {
        if (!self.diseases.includes(d.Disease))
          self.diseases.push(d.Disease);
      });
      self.diseaseSelected = self.diseases[0];
      $scope.$apply();
    }

    function _updateChart() {
      var filteredDiseases;

      filteredDiseases = self.infectiousDiseaseData.filter(function (data) {
        if (_condition(data))
          return data;
      });

      console.log('update!');

      _updateDistributionData(filteredDiseases);
      _updateDataToCharts();
      _updateColorsInMap(filteredDiseases);

      _buildDistributionChartAboutSex();
      _buildCountyTimelineChart();
    }

    function _condition(data) {
      return (self.diseaseSelected === data.Disease) &&
        (data.Year >= yearFilterStart && data.Year <= yearFilterEnd)
    }

    function _updateDistributionData(filteredDiseases) {
      // Create and Array[i][j], i = Year, j = object with gender and values for each one
      for (var currentYear = yearFilterStart; currentYear <= yearFilterEnd; currentYear++) {
        distributionData.set(currentYear, {
          male: 0,
          female: 0,
          county: 0
        });
      }

      filteredDiseases.filter(function (disease) {
        if (disease.County === countySelected) {
          if (disease.Sex === 'Male') {
            var data = distributionData.get(Number(disease.Year));
            data.male += Number(disease.Count);
            distributionData.set(Number(disease.Year), data);
          } else if (disease.Sex === 'Female') {
            var data = distributionData.get(Number(disease.Year));
            data.female += Number(disease.Count);
            distributionData.set(Number(disease.Year), data);
          } else {
            var data = distributionData.get(Number(disease.Year));
            data.county += Number(disease.Count);
            console.log(data.county);
            distributionData.set(Number(disease.Year), data);
          }
        }
      });
    }

    function _updateDataToCharts() {
      self.filteredData = new Array();
      for (var currentYear = yearFilterStart; currentYear <= yearFilterEnd; currentYear++) {
        self.filteredData.push({
          year: currentYear,
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
      map.selectAll('.subunit')
        .style('fill', function (d) {
          for (var i = 0; i < filteredDiseases.length; i++) {
            if (filteredDiseases[i].County === d.properties.name) {
              if (filteredDiseases[i].upper < '0.898') {
                return MAP_COLORS.FREE;
              } else if (filteredDiseases[i].upper < '2.801') {
                return MAP_COLORS.SUSCEPTIBLE;
              } else {
                return MAP_COLORS.INFECTED;
              }
            }

            if (countySelected === d.properties.name) {
              return MAP_COLORS.SELECTED;
            }
          }
        });
    }


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
        .default([new Date(2001, 0, 1), new Date(2005, 0, 1)])
        .fill('#2196f3')
        .on('onchange', val => {
          d3.select('p#value-range').text(val.map(d3.timeFormat('%Y')).join('-'));
          yearFilterStart = val.map(d3.timeFormat('%Y'))[0];
          yearFilterEnd = val.map(d3.timeFormat('%Y'))[1];
          _updateChart();
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
      var margin = { top: 10, right: 40, bottom: 30, left: 40 },
        width = 550 - margin.left - margin.right,
        height = 250 - margin.top - margin.bottom;

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
        .call(d3.axisBottom(xAxis));
      countyTimelineChart.append("g")
        .call(d3.axisLeft(yAxis));

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
      var margin = { top: 10, right: 40, bottom: 30, left: 40 },
        width = 550 - margin.left - margin.right,
        height = 250 - margin.top - margin.bottom;

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
        .domain([0, highestYValueGender])
        .range([height, 0]);
      sexDistributionChart.append("g")
        .attr("transform", "translate(0," + height + ")")
        .call(d3.axisBottom(xAxis));
      sexDistributionChart.append("g")
        .call(d3.axisLeft(yAxis));


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
            _updateChart();
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

        _updateChart();
      });
    }
  }
}());
