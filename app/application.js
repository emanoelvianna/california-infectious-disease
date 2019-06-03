(function () {
  'use strict';
  angular
    .module('app')
    .controller('AppCtrl', Controller);

  Controller.$inject = [
    '$q',
    '$scope',
    'resource.LoadingScreenService'
  ];

  function Controller($q, $scope, LoadingScreenService) {
    const COLORS = {
      INFECTED: '#ff6f69',
      FREE: '#88d8b0',
      UNDEFINED: '#cecece',
      SUSCEPTIBLE: '#ffcc5c'
    };
    var svg;
    /* public variables */
    var self = this;
    self.diseases = [];
    self.diseaseSelected = undefined;
    self.yearSelected = undefined;

    /* Lifecycle hooks */
    self.$onInit = onInit;
    self.filteredSelected = filteredSelected;

    function onInit() {
      LoadingScreenService.start();
      $q.all([
        _loadDataOfDiseases()
      ]).then(
        _buildMap(),
        filteredSelected('2005'),
        LoadingScreenService.finish()
      );
    }

    function _loadDataOfDiseases() {
      d3.csv('data/infectious-disease-data.csv').then(function (data) {
        data.map(function (d) {
          if (!self.diseases.includes(d.Disease))
            self.diseases.push(d.Disease);
        });
        self.diseaseSelected = self.diseases[0];
        $scope.$apply();
      });
    }

    function _buildMap() {
      var width = 600;
      var height = 550;

      var projection = d3.geoMercator()
        .scale(1000 * 2)
        .center([-120, 36])
        .translate([width / 2, height / 2]);

      var path = d3.geoPath()
        .projection(projection);

      svg = d3.select('#map').append('svg')
        .attr('width', width)
        .attr('height', height);

      d3.json('data/california-map.json').then(function (ca) {
        svg.append('path')
          .datum(topojson.feature(ca, ca.objects.subunits))
          .attr('class', 'land')
          .attr('d', path);

        /* bind feature data to the map */
        svg.selectAll('.subunit')
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
              .style('left', (d3.event.pageX) + 10 + 'px')
              .style('top', (d3.event.pageY - 30) + 'px');
          })
          .on('mouseout', function (d) {
            div.transition()
              .duration(500)
              .style('opacity', 0.0);
          });

        /* exterior border */
        svg.append('path')
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

    function filteredSelected(yearSelected) {
      d3.csv('data/infectious-disease-data.csv').then(function (diseases) {
        var filteredDiseases = diseases.filter(function (data) {
          if (_condition(self.diseaseSelected, yearSelected, data))
            return data;
        });

        svg.selectAll('.subunit')
          .style("fill", function (d) {
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

      });
    }

    function _condition(diseaseSelected, yearSelected, data) {
      return diseaseSelected === data.Disease && data.Year === yearSelected && data.Sex === "Total";
    }
  }
}());