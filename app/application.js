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

    function _buildDistributionChartAboutSex() {

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
      _buildDistributionChartAboutSex();
    }

    function _preventableDiseasesByVaccines() {
      // TODO:
    }

    function _condition(diseaseSelected, yearSelected, data) {
      return diseaseSelected === data.Disease && data.Year === yearSelected;
    }
  }
}());