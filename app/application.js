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
    var maleColor = '#357df2';
    var femaleColor = '#db2e3c';
    var yearFilterStart = 2000;
    var yearFilterEnd = 2018;
    /* public variables */
    var self = this;
    self.diseases = [];
    self.diseaseSelected = undefined;
    self.yearSelected = undefined;
    self.simulateQuery = false;

    self.infectiousDiseaseData;
    self.distributionBySexRange;
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
        filter();
        _buildDistributionChartAboutSex();
        _timeline();
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
    function _buildDistributionChartAboutSex() {
      // Margin configuration
      var margin = {top: 10, right: 40, bottom: 30, left: 40},
        width = 550 - margin.left - margin.right,
        height = 250 - margin.top - margin.bottom;

      // Append the SVG Object
      var svg = d3.select("#sex-distribution")
        .append("svg")
          .attr("width", width + margin.left + margin.right)
          .attr("height", height + margin.top + margin.bottom)
        .append("g")
          .attr("transform",
                "translate(" + margin.left + "," + margin.top + ")");

      // Axis Setup
      var xAxis = d3.scaleLinear()
        .domain([yearFilterStart,yearFilterEnd])
        .range([ 0, width ]);
      var yAxis = d3.scaleLinear()
        .domain( [0, 1000])
        .range([ height, 0 ]);
      svg.append("g")
        .attr("transform", "translate(0," + height + ")")
        .call(d3.axisBottom(xAxis));
      svg.append("g")
        .call(d3.axisLeft(yAxis));

      // Data Adjustment
      var dataTemp2 = new Array();
      for (var i = yearFilterStart; i < yearFilterEnd; i ++)
      {
        dataTemp2.push({year: i, 
          male: self.distributionBySexRange[i - yearFilterStart][0].value,
          female: self.distributionBySexRange[i - yearFilterStart][1].value})
      }
      // Male Plot
      svg
        .append("g")
        .selectAll("dot")
        .data(dataTemp2)
        .enter()
        .append("circle")
          .attr("cx", function(d) { return xAxis(d.year) } )
          .attr("cy", function(d) { return yAxis(d.male) } )
          .attr("r", 5)
          .attr("fill", maleColor)
      svg.append("path")
        .datum(dataTemp2)
          .attr("fill", "none")
          .attr("stroke", maleColor)
          .attr("stroke-width", 1.5)
          .attr("d", d3.line()
            .x(function(d) { return xAxis(d.year) })
            .y(function(d) { return yAxis(d.male) })
            );
      // Female Plot
      svg
        .append("g")
        .selectAll("dot")
        .data(dataTemp2)
        .enter()
        .append("circle")
          .attr("cx", function(d) { return xAxis(d.year) } )
          .attr("cy", function(d) { return yAxis(d.female) } )
          .attr("r", 5)
          .attr("fill", femaleColor);
      svg.append("path")
        .datum(dataTemp2)
          .attr("fill", "none")
          .attr("stroke",   femaleColor)
          .attr("stroke-width", 1.5)
          .attr("d", d3.line()
            .x(function(d) { return xAxis(d.year) })
            .y(function(d) { return yAxis(d.female) })
            );
    }
    function _buildDistributionInMap() {
      var width = 550;
      var height = 470;

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
      var moveYears = ndx.dimension(function (d) {
        return d.Year;
      });

      var totalByYear = moveYears.group().reduceSum(function (d) {
        if (d.Sex === "Total" && d.Disease === self.diseaseSelected)
          return + d.Count;
        return + 0;
      });

      var volumeChart = dc.barChart('#time-chart');
      volumeChart
        .width(400)
        .height(100)
        .margins({ top: 0, right: 50, bottom: 20, left: 50 })
        .dimension(moveYears)
        .group(totalByYear)
        .centerBar(true)
        .gap(1)
        .x(d3.scaleLinear()
          .domain([2000, 2018]))
        .elasticY(true)
        // .round(d3.timeYear.round)
        // .alwaysUseRounding(true)
        .xUnits(d3.timeYears);

      dc.renderAll();
    }

    

    function filter() {
      var filteredDiseases;

      filteredDiseases = self.infectiousDiseaseData.filter(function (data) {
        if (_conditionRange(self.diseaseSelected, data))
          return data;
      });

      _distributionFilterBySexRange(filteredDiseases);

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
          }
        });
    }
    function _distributionFilterBySexRange(filteredDiseases) {
      self.distributionBySexRange = new Array (yearFilterEnd - yearFilterStart);
      for (var i=0; i <self.distributionBySexRange.length; i++)
      {
        self.distributionBySexRange[i]=new Array(2);
        self.distributionBySexRange[i][0] = { sex: 'Male', value: 0 };
        self.distributionBySexRange[i][1] = { sex: 'Female', value: 0 };
      }

      for (var i = 0; i < filteredDiseases.length; i++) {
        if (filteredDiseases[i].Sex === 'Male') {
          self.distributionBySexRange[Number(filteredDiseases[i].Year) - yearFilterStart][0].value += Number(filteredDiseases[i].Count);
        } else if (filteredDiseases[i].Sex === 'Female') {
          self.distributionBySexRange[Number(filteredDiseases[i].Year) - yearFilterStart][1].value += Number(filteredDiseases[i].Count);
        }
      }
      // ??? Não sei o que isso faz - Gabriel
      //self.barSize = self.distributionBySex[0].value > self.distributionBySex[1].value ? self.distributionBySex[0].value : self.distributionBySex[1].value 
    }

    function _preventableDiseasesByVaccines() {
      // TODO:
    }

    function _condition(diseaseSelected, yearSelected, data) {
      return diseaseSelected === data.Disease && data.Year === yearSelected;
    }
    function _conditionRange(diseaseSelected, data) {
      return diseaseSelected === data.Disease && data.Year >= yearFilterStart && data.Year <= yearFilterEnd;
    }
    function _conditionRangeCounty(diseaseSelected,  data) {
      return diseaseSelected === data.Disease && data.Year >= yearFilterStart && data.Year <= yearFilterEnd;
    }
  }
}());