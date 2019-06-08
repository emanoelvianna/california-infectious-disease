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
    const COLORS = {
      INFECTED: '#ff6f69',
      FREE: '#88d8b0',
      UNDEFINED: '#cecece',
      SUSCEPTIBLE: '#ffcc5c'
    };
    var map;
    var bar;
    var ndx;
    var years;
    var spendHist;
    var dateFormat;
    var sex;
    var distributionPerYear;
    var spendHistChart;
    var moveChart;
    var volumeByYearsGroup;
    var spendPerYear;
    var yearFilterStart = 2000;
    var yearFilterEnd = 2005;
    var highestYValueGender = 0;
    var highestYValueCounty = 0;

    /* public variables */
    var self = this;
    self.diseases = [];
    self.diseaseSelected = undefined;
    self.yearSelected = undefined;
    self.simulateQuery = false;

    self.infectiousDiseaseData;
    self.distributionBySex;
    self.barSize;

    /* Lifecycle hooks */
    self.$onInit = onInit;
    self.filter = filter;
    self.querySearch = querySearch;
    self.selectedItemChange = selectedItemChange;
    self.searchTextChange = searchTextChange;

    function onInit() {
      LoadingScreenService.start();
      d3.csv('data/infectious-disease-data.csv').then(function (data) {
        self.infectiousDiseaseData = data;

        ndx = crossfilter(self.infectiousDiseaseData);

        _buildDistributionInMap();
        _setDiseaseList();
        filter('2005');
        _timeline();
        // _buildDistributionChartAboutSex();
        LoadingScreenService.finish();
      });
    }

    function querySearch(query) {
      var results = query ? self.diseases.filter(createFilterFor(query)) : self.diseases, deferred;
      if (self.simulateQuery) {
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
      filter('2005');
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

    function _buildDistributionInMap() {
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
          .on('mouseover', function (d) { //tooltip
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
            self.countySelected = d.properties.name;
            filter('2005');
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
      });
    }

    function _timeline() {
      var dataTime = d3.range(0, 17).map(function (d) {
        return new Date(2000 + d, 0, 1);
      });

      var sliderRange = d3
        .sliderBottom()
        .min(d3.min(dataTime))
        .max(d3.max(dataTime))
        .width(400)
        .tickFormat(d3.timeFormat('%Y'))
        .tickValues(dataTime)
        .default([new Date(2000, 0, 1), new Date(2005, 0, 1)])
        .fill('#2196f3')
        .on('onchange', val => {
          d3.select('p#value-range').text(val.map(d3.timeFormat('%Y')).join('-'));
          yearFilterStart = val.map(d3.timeFormat('%Y'))[0];
          yearFilterEnd = val.map(d3.timeFormat('%Y'))[1];
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

    function _buildDistributionChartAboutSex() {
      // Clear the last Chart
      self.sexDistributionChart = d3.select("#sex-distribution");
      self.sexDistributionChart.selectAll("*").remove();

      // Margin configuration
      var margin = { top: 10, right: 40, bottom: 30, left: 40 },
        width = 550 - margin.left - margin.right,
        height = 250 - margin.top - margin.bottom;

      // Append the SVG Object
      self.sexDistributionChart = d3.select("#sex-distribution")
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
      self.sexDistributionChart.append("g")
        .attr("transform", "translate(0," + height + ")")
        .call(d3.axisBottom(xAxis));
      self.sexDistributionChart.append("g")
        .call(d3.axisLeft(yAxis));


      // Male Plot
      self.sexDistributionChart
        .append("g")
        .selectAll("dot")
        .data(self.filteredData)
        .enter()
        .append("circle")
        .attr("cx", function (d) { return xAxis(d.year) })
        .attr("cy", function (d) { return yAxis(d.male) })
        .attr("r", 5)
        .attr("fill", maleColor)
      self.sexDistributionChart.append("path")
        .datum(self.filteredData)
        .attr("fill", "none")
        .attr("stroke", maleColor)
        .attr("stroke-width", 1.5)
        .attr("d", d3.line()
          .x(function (d) { return xAxis(d.year) })
          .y(function (d) { return yAxis(d.male) })
        );
      // Female Plot
      self.sexDistributionChart
        .append("g")
        .selectAll("dot")
        .data(self.filteredData)
        .enter()
        .append("circle")
        .attr("cx", function (d) { return xAxis(d.year) })
        .attr("cy", function (d) { return yAxis(d.female) })
        .attr("r", 5)
        .attr("fill", femaleColor);
      self.sexDistributionChart.append("path")
        .datum(self.filteredData)
        .attr("fill", "none")
        .attr("stroke", femaleColor)
        .attr("stroke-width", 1.5)
        .attr("d", d3.line()
          .x(function (d) { return xAxis(d.year) })
          .y(function (d) { return yAxis(d.female) })
        );
    }

    function filter(yearSelected) {
      var filteredDiseases;

      filteredDiseases = self.infectiousDiseaseData.filter(function (data) {
        if (_condition(self.diseaseSelected, yearSelected, data))
          return data;
      });

      _distributionFilterBySex(filteredDiseases);

      map.selectAll('.subunit')
        .style('fill', function (d) {
          for (var i = 0; i < filteredDiseases.length; i++) {
            if (filteredDiseases[i].County === d.properties.name) {
              if (filteredDiseases[i]['CI.upper'] < '0.898') {
                return '#cecece';
              } else if (filteredDiseases[i]['CI.upper'] < '2.801') {
                return '#ffcc5c'
              } else if (filteredDiseases[i]['CI.upper'] < '5.801') {
                return '#ff6f69';
              } else {
                return '#2db7e2';
              }
            }

            if (self.countySelected === d.properties.name) {
              return '#000000';
            }
          }
        });
    }

    function _distributionFilterBySex(filteredDiseases) {
      self.distributionBySex = [
        { sex: 'Male', value: 0 },
        { sex: 'Female', value: 0 }
      ];
      for (var i = 0; i < filteredDiseases.length; i++) {
        if (filteredDiseases[i].Sex === 'Male') {
          self.distributionBySex[0].value += Number(filteredDiseases[i].Count);
        } else if (filteredDiseases[i].Sex === 'Female') {
          self.distributionBySex[1].value += Number(filteredDiseases[i].Count);
        }
      }
      self.barSize = self.distributionBySex[0].value > self.distributionBySex[1].value ? self.distributionBySex[0].value : self.distributionBySex[1].value
      //_buildDistributionChartAboutSex();
    }

    function _condition(diseaseSelected, yearSelected, data) {
      return diseaseSelected === data.Disease && data.Year === yearSelected;
    }
  }
}());